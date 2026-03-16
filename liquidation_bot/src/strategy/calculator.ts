import type winston from "winston";
import type { BotConfig, Auction, MarketInfo } from "../types.js";
import { WAD } from "../types.js";
import type { PriceMonitor } from "../monitor/priceMonitor.js";

/**
 * ProfitabilityCalculator — Determines if a liquidation is worth executing.
 *
 * WHY PROFITABILITY MATTERS
 * ─────────────────────────
 * Every transaction costs gas. On Base, gas is cheap (~$0.001-0.01), but
 * on Ethereum mainnet it can be $5-50+. A liquidation that earns $3 of
 * collateral discount but costs $5 in gas is a net loss.
 *
 * The bot should only execute when: expectedProfit > minProfitUsd + gasCost
 *
 * HOW LIQUIDATION PROFIT WORKS
 * ─────────────────────────────
 * In a Dutch auction, collateral is sold at a price that decays over time:
 *
 *   t=0:   price = 105% of oracle (START_PREMIUM)  → LOSS for liquidator
 *   t=10m: price = 100% of oracle                   → BREAKEVEN
 *   t=20m: price = 95% of oracle (END_DISCOUNT)     → 5% PROFIT
 *
 * The liquidator buys collateral at the auction price using borrow tokens.
 * If the auction price < oracle price, the difference is profit.
 *
 * Example:
 *   Oracle says 1 ETH = $2,000
 *   Auction price at t=15m: 1 ETH = $1,950 (97.5% of oracle)
 *   Collateral for sale: 3 ETH
 *   Debt to repay: 5,850 USDC
 *
 *   Liquidator pays: 5,850 USDC
 *   Liquidator receives: 3 ETH (worth $6,000 at oracle price)
 *   Gross profit: $6,000 - $5,850 = $150
 *   Gas cost: ~$0.01 (Base L2)
 *   Net profit: ~$149.99 ✓
 *
 * TWO TYPES OF OPPORTUNITIES
 * ──────────────────────────
 * 1. START_AUCTION: Starting an auction costs gas but doesn't earn money
 *    directly. However, starting auctions is necessary to later profit
 *    from liquidations. The bot starts auctions when gas cost is low enough.
 *
 * 2. LIQUIDATE: Executing a liquidation at a favorable auction price.
 *    This is where the profit happens. We calculate the exact price point
 *    where the auction becomes profitable after gas.
 */

/** Gas estimates for different operations (in gas units) */
const GAS_ESTIMATES = {
  /** Estimated gas for startAuction() */
  START_AUCTION: 250_000n,
  /** Estimated gas for liquidate() */
  LIQUIDATE: 350_000n,
  /** Extra buffer for ERC20 approval (if needed) */
  APPROVE: 50_000n,
};

export class ProfitabilityCalculator {
  private config: BotConfig;
  private priceMonitor: PriceMonitor;
  private logger: winston.Logger;

  constructor(
    config: BotConfig,
    priceMonitor: PriceMonitor,
    logger: winston.Logger,
  ) {
    this.config = config;
    this.priceMonitor = priceMonitor;
    this.logger = logger;
  }

  /**
   * Evaluate whether starting an auction is worth the gas.
   *
   * Starting an auction doesn't directly profit the caller. But:
   * 1. On a quiet testnet, if nobody else starts auctions, underwater
   *    positions just sit there. The bot must start them to later liquidate.
   * 2. The gas cost on Base is very low (~$0.001), so it's almost always
   *    worth it if the position is genuinely liquidatable.
   *
   * Returns whether to proceed and the estimated gas cost.
   */
  evaluateStartAuction(gasPrice: bigint): {
    shouldExecute: boolean;
    gasCostUsd: number;
    reason: string;
  } {
    // Calculate gas cost in USD
    const gasCostWei = GAS_ESTIMATES.START_AUCTION * gasPrice;
    const gasCostUsd = this.weiToUsd(gasCostWei);

    // Check gas price isn't too high
    if (gasPrice > this.config.maxGasPrice) {
      return {
        shouldExecute: false,
        gasCostUsd,
        reason: `Gas price too high: ${this.formatGwei(gasPrice)} gwei > ${this.formatGwei(this.config.maxGasPrice)} gwei max`,
      };
    }

    // On L2s like Base, gas is cheap enough that starting auctions
    // is almost always worthwhile. We only gate on gas price.
    return {
      shouldExecute: true,
      gasCostUsd,
      reason: `Gas cost acceptable: $${gasCostUsd.toFixed(4)}`,
    };
  }

  /**
   * Evaluate whether executing a liquidation is profitable.
   *
   * THE CORE PROFITABILITY FORMULA
   * ──────────────────────────────
   * profit = collateralValue(atOracle) - debtToRepay(inUsd) - gasCost
   *
   * More precisely:
   *   collateralValueUsd = collateralForSale × oraclePrice / 10^collateralDecimals
   *   debtValueUsd = debtToRepay × borrowPrice / 10^borrowDecimals
   *   gasCostUsd = gasEstimate × gasPrice × ethPrice (converted to USD)
   *   profit = collateralValueUsd - debtValueUsd - gasCostUsd
   *
   * WHY USE ORACLE PRICE FOR COLLATERAL (NOT AUCTION PRICE)?
   * ────────────────────────────────────────────────────────
   * The auction price is what we PAY. The oracle price is what the
   * collateral is WORTH on the open market. The difference is our profit.
   *
   * If we sell the collateral immediately at market price (oracle), we
   * receive collateralValueUsd. We paid debtValueUsd. The difference
   * minus gas is our net profit.
   */
  evaluateLiquidation(
    auction: Auction,
    market: MarketInfo,
    currentAuctionPrice: bigint,
    gasPrice: bigint,
  ): { shouldExecute: boolean; estimatedProfitUsd: number; reason: string } {
    // Get oracle prices for both tokens
    const collateralPriceData = this.priceMonitor.getPrice(
      market.collateralToken,
    );
    const borrowPriceData = this.priceMonitor.getPrice(market.borrowToken);

    if (!collateralPriceData || !borrowPriceData) {
      return {
        shouldExecute: false,
        estimatedProfitUsd: 0,
        reason: "Missing price data for profit calculation",
      };
    }

    // Step 1: What is the collateral worth at oracle price?
    const collateralValueUsd = this.priceMonitor.getValueUsd(
      market.collateralToken,
      auction.collateralForSale,
      market.collateralDecimals,
    );

    // Step 2: What does the debt cost us to repay?
    const debtValueUsd = this.priceMonitor.getValueUsd(
      market.borrowToken,
      auction.debtToRepay,
      market.borrowDecimals,
    );

    if (collateralValueUsd === undefined || debtValueUsd === undefined) {
      return {
        shouldExecute: false,
        estimatedProfitUsd: 0,
        reason: "Could not calculate USD values",
      };
    }

    // Step 3: But we're not paying oracle price — we're paying the AUCTION price
    // The auction price determines how much collateral we get per unit of debt repaid.
    //
    // auctionPrice = price per unit of collateral in borrow token terms
    // If auctionPrice < oraclePrice → we get collateral cheaper → profit
    //
    // Actually, let's think about this differently:
    // We pay: debtToRepay in borrow tokens
    // We get: collateralForSale in collateral tokens
    //
    // The effective price we pay per collateral unit:
    //   effectivePrice = debtToRepay / collateralForSale (in borrow token per collateral)
    //
    // The oracle price per collateral unit:
    //   oraclePrice = collateralOraclePrice / borrowOraclePrice (in borrow token per collateral)
    //
    // Our profit per collateral unit:
    //   profitPerUnit = oraclePrice - effectivePrice (in borrow token per collateral)
    //
    // In USD:
    //   grossProfitUsd = collateralValueUsd - debtValueUsd

    const grossProfitUsd = collateralValueUsd - debtValueUsd;

    // Step 4: Subtract gas cost
    const gasCostWei = GAS_ESTIMATES.LIQUIDATE * gasPrice;
    const gasCostUsd = this.weiToUsd(gasCostWei);

    const netProfitUsd = grossProfitUsd - gasCostUsd;

    // Step 5: Check against minimum profit threshold
    if (gasPrice > this.config.maxGasPrice) {
      return {
        shouldExecute: false,
        estimatedProfitUsd: netProfitUsd,
        reason: `Gas price too high: ${this.formatGwei(gasPrice)} gwei`,
      };
    }

    if (netProfitUsd < this.config.minProfitUsd) {
      return {
        shouldExecute: false,
        estimatedProfitUsd: netProfitUsd,
        reason: `Profit too low: $${netProfitUsd.toFixed(2)} < $${this.config.minProfitUsd} minimum`,
      };
    }

    return {
      shouldExecute: true,
      estimatedProfitUsd: netProfitUsd,
      reason: `Profitable! Gross: $${grossProfitUsd.toFixed(2)}, Gas: $${gasCostUsd.toFixed(4)}, Net: $${netProfitUsd.toFixed(2)}`,
    };
  }

  /**
   * Calculate at what auction price a liquidation becomes profitable.
   *
   * USEFUL FOR TIMING
   * ─────────────────
   * Instead of checking profitability every second, we can calculate
   * the exact breakeven price and compare against the Dutch auction's
   * linear decay. This tells us WHEN to execute:
   *
   *   breakeven time = startTime + duration × (startPrice - breakevenPrice) / (startPrice - endPrice)
   */
  calculateBreakevenPrice(
    auction: Auction,
    market: MarketInfo,
    gasPrice: bigint,
  ): bigint | undefined {
    const borrowPriceData = this.priceMonitor.getPrice(market.borrowToken);
    const collateralPriceData = this.priceMonitor.getPrice(
      market.collateralToken,
    );

    if (!borrowPriceData || !collateralPriceData) return undefined;

    // Gas cost in borrow token terms
    const gasCostWei = GAS_ESTIMATES.LIQUIDATE * gasPrice;
    const gasCostUsd = this.weiToUsd(gasCostWei);
    const minProfitUsd = this.config.minProfitUsd;
    const totalCostUsd = gasCostUsd + minProfitUsd;

    // Convert cost to borrow token amount
    // totalCostBorrow = totalCostUsd × 10^borrowDecimals / borrowPrice(inUsd)
    if (borrowPriceData.price === 0n) return undefined;

    const totalCostBorrow =
      (BigInt(Math.ceil(totalCostUsd * 10000)) *
        10n ** BigInt(market.borrowDecimals) *
        WAD) /
      (borrowPriceData.price * 10000n);

    // The liquidator pays debtToRepay and receives collateralForSale.
    // For the liquidation to be profitable:
    //   collateralValue(oracle) - debtToRepay > totalCost
    //   collateralForSale × (oraclePrice - auctionPrice) / oraclePrice > totalCost
    //
    // The breakeven auction price is where profit exactly = totalCost
    // This is approximate — good enough for timing decisions.
    if (auction.collateralForSale === 0n) return undefined;

    const oracleRatio =
      (collateralPriceData.price * 10n ** BigInt(market.borrowDecimals)) /
      (borrowPriceData.price * 10n ** BigInt(market.collateralDecimals));

    // breakevenPrice ≈ oracleRatio - (totalCostBorrow × WAD / collateralForSale)
    const costPerCollateral =
      (totalCostBorrow * WAD) / auction.collateralForSale;

    if (oracleRatio <= costPerCollateral) return 0n; // Never profitable

    return oracleRatio - costPerCollateral;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Convert wei to USD.
   *
   * On Base (L2), the native token is ETH. Gas is priced in ETH.
   * We need the ETH/USD price to convert gas cost to dollars.
   *
   * SIMPLIFICATION: For Base Sepolia (testnet), gas is essentially free.
   * In production, you'd fetch the real ETH price. Here we use a
   * reasonable estimate.
   */
  private weiToUsd(wei: bigint): number {
    // Try to get ETH price from oracle
    // We look for WETH price since that's what our oracle tracks
    const prices = this.priceMonitor.getAllPrices();
    let ethPriceUsd = 2000; // Fallback estimate

    // Find any price that looks like ETH (high value, likely WETH)
    for (const p of prices) {
      const priceNum = Number(p.price) / 1e18;
      if (priceNum > 1000 && priceNum < 100000) {
        // Probably ETH or BTC — use it as approximation
        ethPriceUsd = priceNum;
        break;
      }
    }

    // wei to ETH: divide by 1e18
    // ETH to USD: multiply by ethPriceUsd
    const ethAmount = Number(wei) / 1e18;
    return ethAmount * ethPriceUsd;
  }

  /**
   * Format gas price in gwei for human-readable logging.
   */
  private formatGwei(wei: bigint): string {
    return (Number(wei) / 1e9).toFixed(2);
  }
}
