import { ethers } from "ethers";
import type winston from "winston";
import type { Opportunity, MarketInfo } from "../types.js";
import { OpportunityType } from "../types.js";
import type { HealthMonitor } from "../monitor/healthMonitor.js";
import type { AuctionStore } from "../state/auctionStore.js";
import type { ProfitabilityCalculator } from "./calculator.js";
import { LIQUIDATOR_ABI } from "../contracts/abis.js";

/**
 * OpportunityDetector — Finds actionable liquidation opportunities.
 *
 * This is the "brain" that combines all the data we've gathered:
 *   - HealthMonitor tells us WHO is liquidatable
 *   - AuctionStore tells us WHAT auctions are active
 *   - ProfitabilityCalculator tells us IF it's worth doing
 *
 * TWO TYPES OF OPPORTUNITIES
 * ──────────────────────────
 *
 * 1. START_AUCTION
 *    Condition: Position has HF < 1.0 AND no active auction exists
 *    Action: Call liquidator.startAuction(pool, user)
 *    Profit: None directly — but necessary to enable type 2
 *
 *    Why would we do something unprofitable? Because:
 *    a) Gas is very cheap on Base L2 (~$0.001)
 *    b) We're the ones who will later liquidate at a profit
 *    c) On a quiet testnet, nobody else may start auctions
 *
 * 2. LIQUIDATE
 *    Condition: Active auction exists AND current price is profitable
 *    Action: Call liquidator.liquidate(auctionId, maxDebtToRepay)
 *    Profit: collateralValue(oracle) - debtRepaid - gasCost
 *
 *    The Dutch auction price decays linearly:
 *    t=0    →  105% of oracle (we'd LOSE money)
 *    t=10m  →  100% of oracle (breakeven)
 *    t=15m  →  97.5% of oracle (2.5% profit)
 *    t=20m  →  95% of oracle (5% profit, maximum)
 *
 *    The sweet spot: execute when profit > minProfitThreshold + gasCost.
 *    Don't wait too long — other bots might beat us to it.
 *
 * OPPORTUNITY PRIORITIZATION
 * ──────────────────────────
 * When multiple opportunities exist, we sort by estimated profit
 * (highest first). Since we execute sequentially (to manage nonces),
 * we want to capture the most valuable ones first.
 */
export class OpportunityDetector {
  private healthMonitor: HealthMonitor;
  private auctionStore: AuctionStore;
  private calculator: ProfitabilityCalculator;
  private liquidatorContract: ethers.Contract;
  private marketInfos: Map<string, MarketInfo>;
  private logger: winston.Logger;

  constructor(
    healthMonitor: HealthMonitor,
    auctionStore: AuctionStore,
    calculator: ProfitabilityCalculator,
    liquidatorAddress: string,
    provider: ethers.JsonRpcProvider,
    marketInfos: Map<string, MarketInfo>,
    logger: winston.Logger,
  ) {
    this.healthMonitor = healthMonitor;
    this.auctionStore = auctionStore;
    this.calculator = calculator;
    this.liquidatorContract = new ethers.Contract(
      liquidatorAddress,
      LIQUIDATOR_ABI,
      provider,
    );
    this.marketInfos = marketInfos;
    this.logger = logger;
  }

  /**
   * Find all actionable opportunities in this cycle.
   *
   * FLOW:
   * 1. Run health check → find liquidatable positions
   * 2. For each liquidatable position, check if auction already exists
   *    - No auction → START_AUCTION opportunity
   *    - Has auction → skip (already being handled)
   * 3. Check all active auctions for profitable prices
   *    - Price profitable → LIQUIDATE opportunity
   *    - Price still too high → wait (log for monitoring)
   * 4. Sort all opportunities by estimated profit (descending)
   */
  async findOpportunities(gasPrice: bigint): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    // ── Phase 1: Find positions that need new auctions ──

    const healthCheck = await this.healthMonitor.evaluate();

    for (const { position, healthFactor } of healthCheck.liquidatable) {
      // Check if an auction already exists for this user in this market
      const existingAuction = this.auctionStore.getActiveForUser(
        position.market,
        position.user,
      );

      if (existingAuction) {
        this.logger.debug("Liquidatable position already has active auction", {
          user: position.user.slice(0, 10),
          auctionId: existingAuction.auctionId.toString(),
        });
        continue; // Will be handled as a LIQUIDATE opportunity below
      }

      // Evaluate if starting an auction is worth the gas
      const evaluation = this.calculator.evaluateStartAuction(gasPrice);

      if (evaluation.shouldExecute) {
        const market = this.marketInfos.get(position.market.toLowerCase());
        // Estimate the debt involved (for logging/sorting)
        // We don't know exact amounts until the contract calculates them,
        // but we can approximate for priority sorting
        opportunities.push({
          type: OpportunityType.START_AUCTION,
          market: position.market,
          user: position.user,
          estimatedProfitUsd: 0, // No direct profit from starting
          collateralAmount: position.collateralAmount,
          debtAmount: position.borrowShares, // Approximate
          healthFactor,
        });

        this.logger.info("📋 START_AUCTION opportunity found", {
          user: position.user.slice(0, 10),
          market: position.market.slice(0, 10),
          healthFactor: this.formatHF(healthFactor),
          gasCost: `$${evaluation.gasCostUsd.toFixed(4)}`,
        });
      } else {
        this.logger.debug("Skipping START_AUCTION", {
          user: position.user.slice(0, 10),
          reason: evaluation.reason,
        });
      }
    }

    // ── Phase 2: Check active auctions for profitable liquidations ──

    const activeAuctions = this.auctionStore.getAllActive();

    for (const auction of activeAuctions) {
      const market = this.marketInfos.get(auction.pool.toLowerCase());
      if (!market) {
        this.logger.warn("Active auction in unknown market", {
          auctionId: auction.auctionId.toString(),
          pool: auction.pool.slice(0, 10),
        });
        continue;
      }

      // Get the current auction price from the contract
      // This is an on-chain call because the price depends on block.timestamp
      let currentPrice: bigint;
      try {
        currentPrice = await this.liquidatorContract.getCurrentPrice(
          auction.auctionId,
        );
      } catch (error) {
        this.logger.debug("Could not get auction price (may have ended)", {
          auctionId: auction.auctionId.toString(),
          error: (error as Error).message,
        });
        continue;
      }

      // Evaluate profitability
      const evaluation = this.calculator.evaluateLiquidation(
        auction,
        market,
        currentPrice,
        gasPrice,
      );

      if (evaluation.shouldExecute) {
        opportunities.push({
          type: OpportunityType.LIQUIDATE,
          market: auction.pool,
          user: auction.user,
          auctionId: auction.auctionId,
          estimatedProfitUsd: evaluation.estimatedProfitUsd,
          collateralAmount: auction.collateralForSale,
          debtAmount: auction.debtToRepay,
          currentPrice,
        });

        this.logger.info("💰 LIQUIDATE opportunity found!", {
          auctionId: auction.auctionId.toString(),
          user: auction.user.slice(0, 10),
          profit: `$${evaluation.estimatedProfitUsd.toFixed(2)}`,
          auctionPrice: currentPrice.toString(),
        });
      } else {
        // Log why we're not executing yet (useful for monitoring the auction decay)
        const elapsed = Math.floor(Date.now() / 1000) - auction.startTime;
        const remaining = auction.endTime - Math.floor(Date.now() / 1000);

        this.logger.debug("Auction not yet profitable", {
          auctionId: auction.auctionId.toString(),
          elapsed: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`,
          remaining: `${Math.floor(remaining / 60)}m ${remaining % 60}s`,
          reason: evaluation.reason,
        });
      }
    }

    // ── Phase 3: Sort by profit (highest first) ──
    // START_AUCTION opportunities get priority over low-profit LIQUIDATE
    // since we need auctions to exist before we can liquidate
    opportunities.sort((a, b) => {
      // START_AUCTION first (they enable future liquidations)
      if (
        a.type === OpportunityType.START_AUCTION &&
        b.type !== OpportunityType.START_AUCTION
      ) {
        return -1;
      }
      if (
        b.type === OpportunityType.START_AUCTION &&
        a.type !== OpportunityType.START_AUCTION
      ) {
        return 1;
      }
      // Within same type, sort by profit descending
      return b.estimatedProfitUsd - a.estimatedProfitUsd;
    });

    if (opportunities.length > 0) {
      this.logger.info(`Found ${opportunities.length} total opportunities`, {
        startAuctions: opportunities.filter(
          (o) => o.type === OpportunityType.START_AUCTION,
        ).length,
        liquidations: opportunities.filter(
          (o) => o.type === OpportunityType.LIQUIDATE,
        ).length,
      });
    }

    return opportunities;
  }

  /**
   * Format health factor for logging.
   */
  private formatHF(hf: bigint): string {
    const integer = hf / 10n ** 18n;
    const remainder = ((hf % 10n ** 18n) * 1000n) / 10n ** 18n;
    return `${integer}.${remainder.toString().padStart(3, "0")}`;
  }
}
