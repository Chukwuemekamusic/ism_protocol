import { ethers } from "ethers";
import type winston from "winston";
import type { Position, MarketInfo } from "../types.js";
import { WAD } from "../types.js";
import type { PositionStore } from "../state/positionStore.js";
import type { PriceMonitor } from "./priceMonitor.js";
import { LENDING_POOL_ABI } from "../contracts/abis.js";

/**
 * HealthMonitor — Evaluates position health and identifies liquidation targets.
 *
 * WHAT IS A HEALTH FACTOR?
 * ────────────────────────
 * The health factor (HF) measures how "safe" a borrower's position is:
 *
 *   HF = (collateralValue × liquidationThreshold) / debtValue
 *
 * Examples:
 *   HF = 2.0  → Very safe. Collateral is 2x what's needed.
 *   HF = 1.5  → Comfortable. 50% buffer before liquidation.
 *   HF = 1.1  → Danger zone. Close to liquidation.
 *   HF = 1.0  → At the threshold. Any price drop triggers liquidation.
 *   HF < 1.0  → LIQUIDATABLE. Anyone can start an auction.
 *   HF = 0.5  → Deeply underwater. Bad debt may occur.
 *
 * WHY THE BOT CALCULATES ITS OWN HF
 * ──────────────────────────────────
 * Our LendingPool contract has a healthFactor(user) view function.
 * We COULD just call it for every user. But:
 *
 *   1. RPC calls are slow (~100ms each). 50 positions = 5 seconds.
 *   2. RPC calls have rate limits. Too many = throttled or banned.
 *   3. We already have the data (positions + prices) in memory.
 *
 * So we calculate locally first, then only call the contract to VERIFY
 * positions that look liquidatable. This is much faster:
 *   - Local calculation: ~0.01ms per position
 *   - RPC call: ~100ms per position
 *   - 50 positions locally: ~0.5ms total
 *   - 50 positions via RPC: ~5000ms total
 *
 * THE BORROWINDEX PROBLEM
 * ───────────────────────
 * Our PositionStore tracks borrowShares, not actual debt. To get actual debt:
 *   actualDebt = borrowShares × borrowIndex / 1e18
 *
 * The borrowIndex increases every time interest accrues. If we use a stale
 * borrowIndex, our HF calculation will be slightly optimistic (real debt
 * is higher than we think). This means:
 *   - We might MISS positions that just became liquidatable (false negative)
 *   - We will NEVER falsely flag a healthy position (no false positives)
 *
 * This is an acceptable trade-off. We fetch the latest borrowIndex once
 * per market per cycle (1 RPC call per market, not per position).
 */

/** Result of evaluating all positions */
export interface HealthCheckResult {
  /** Positions with HF < 1.0 — can be liquidated NOW */
  liquidatable: Array<{ position: Position; healthFactor: bigint }>;
  /** Positions with HF < threshold (e.g. 1.1) — watch closely */
  atRisk: Array<{ position: Position; healthFactor: bigint }>;
  /** Total positions evaluated */
  totalEvaluated: number;
  /** Positions skipped (missing prices, etc.) */
  skipped: number;
}

export class HealthMonitor {
  private positionStore: PositionStore;
  private priceMonitor: PriceMonitor;
  private marketInfos: Map<string, MarketInfo>;
  private provider: ethers.JsonRpcProvider;
  private logger: winston.Logger;
  private healthFactorThreshold: bigint;

  /** Cache of borrowIndex per market — refreshed each cycle */
  private borrowIndexCache: Map<string, bigint> = new Map();

  constructor(
    positionStore: PositionStore,
    priceMonitor: PriceMonitor,
    marketInfos: Map<string, MarketInfo>,
    provider: ethers.JsonRpcProvider,
    healthFactorThreshold: bigint,
    logger: winston.Logger
  ) {
    this.positionStore = positionStore;
    this.priceMonitor = priceMonitor;
    this.marketInfos = marketInfos;
    this.provider = provider;
    this.healthFactorThreshold = healthFactorThreshold;
    this.logger = logger;
  }

  /**
   * Main evaluation loop — check all positions with active borrows.
   *
   * FLOW:
   * 1. Refresh borrowIndex for each market (1 RPC call per market)
   * 2. For each position with borrowShares > 0:
   *    a. Look up market info (LTV, threshold, decimals)
   *    b. Look up cached prices (collateral + borrow tokens)
   *    c. Calculate health factor locally
   *    d. Categorize: liquidatable / at-risk / healthy
   * 3. For liquidatable positions, verify with on-chain call
   */
  async evaluate(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      liquidatable: [],
      atRisk: [],
      totalEvaluated: 0,
      skipped: 0,
    };

    // Step 1: Refresh borrowIndex for all active markets
    await this.refreshBorrowIndices();

    // Step 2: Get all positions with active borrows
    const borrowers = this.positionStore.getWithBorrows();

    for (const position of borrowers) {
      // Look up market config
      const market = this.marketInfos.get(position.market.toLowerCase());
      if (!market) {
        this.logger.warn("Unknown market for position", {
          market: position.market.slice(0, 10),
          user: position.user.slice(0, 10),
        });
        result.skipped++;
        continue;
      }

      // Check we have prices for both tokens
      const collateralPrice = this.priceMonitor.getPrice(market.collateralToken);
      const borrowPrice = this.priceMonitor.getPrice(market.borrowToken);

      if (!collateralPrice || !borrowPrice) {
        this.logger.debug("Missing price data, skipping position", {
          user: position.user.slice(0, 10),
          hasCollateralPrice: !!collateralPrice,
          hasBorrowPrice: !!borrowPrice,
        });
        result.skipped++;
        continue;
      }

      // Get cached borrowIndex for this market
      const borrowIndex = this.borrowIndexCache.get(position.market.toLowerCase());
      if (!borrowIndex) {
        result.skipped++;
        continue;
      }

      // Calculate health factor locally
      const hf = this.calculateHealthFactor(
        position,
        market,
        collateralPrice.price,
        borrowPrice.price,
        borrowIndex
      );

      result.totalEvaluated++;

      // Categorize
      if (hf < WAD) {
        // HF < 1.0 — liquidatable!
        result.liquidatable.push({ position, healthFactor: hf });
      } else if (hf < this.healthFactorThreshold) {
        // HF < 1.1 (or whatever threshold) — at risk
        result.atRisk.push({ position, healthFactor: hf });
      }
      // HF >= threshold → healthy, no action needed
    }

    // Step 3: Verify liquidatable positions on-chain
    // This catches any discrepancy between our local calculation
    // and the contract's (rounding, timing, etc.)
    if (result.liquidatable.length > 0) {
      result.liquidatable = await this.verifyOnChain(result.liquidatable);
    }

    // Log summary
    if (result.liquidatable.length > 0) {
      this.logger.info("⚠️  Liquidatable positions found!", {
        count: result.liquidatable.length,
        positions: result.liquidatable.map((p) => ({
          user: p.position.user.slice(0, 10),
          market: p.position.market.slice(0, 10),
          hf: this.formatHF(p.healthFactor),
        })),
      });
    }

    if (result.atRisk.length > 0) {
      this.logger.debug("At-risk positions", {
        count: result.atRisk.length,
      });
    }

    return result;
  }

  /**
   * Calculate health factor for a single position.
   *
   * THE FORMULA
   * ───────────
   * healthFactor = (collateralValue × liquidationThreshold) / debtValue
   *
   * Where:
   *   collateralValue = collateralAmount × collateralPrice / 10^collateralDecimals
   *   debtAmount      = borrowShares × borrowIndex / 10^18 (WAD)
   *   debtValue       = debtAmount × borrowPrice / 10^borrowDecimals
   *
   * All intermediate values use WAD (1e18) precision to avoid truncation.
   *
   * EXAMPLE
   * ───────
   * Alice has:
   *   collateralAmount = 10e18 (10 ETH, 18 decimals)
   *   borrowShares = 15000e6 (15000 USDC shares, 6 decimals)
   *   borrowIndex = 1.02e18 (2% interest has accrued)
   *
   * Prices:
   *   ETH = 2000e18 ($2,000)
   *   USDC = 1e18 ($1.00)
   *
   * Liquidation threshold = 0.80e18 (80%)
   *
   * Step 1: collateralValue = 10e18 × 2000e18 / 1e18 = 20000e18 ($20,000)
   * Step 2: debtAmount = 15000e6 × 1.02e18 / 1e18 = 15300e6 (15,300 USDC)
   * Step 3: debtValue = 15300e6 × 1e18 / 1e6 = 15300e18 ($15,300)
   * Step 4: HF = (20000e18 × 0.80e18 / 1e18) / 15300e18
   *            = 16000e18 / 15300e18
   *            = 1.045e18
   *            → HF ≈ 1.045, position is healthy (but watch closely!)
   */
  calculateHealthFactor(
    position: Position,
    market: MarketInfo,
    collateralPrice: bigint,
    borrowPrice: bigint,
    borrowIndex: bigint
  ): bigint {
    // Guard: no borrows = infinitely healthy
    if (position.borrowShares === 0n) return WAD * 1000n; // Return a very large number

    // Step 1: Collateral value in USD (WAD scaled)
    // collateralValue = collateralAmount × collateralPrice / 10^collateralDecimals
    const collateralValue =
      (position.collateralAmount * collateralPrice) /
      10n ** BigInt(market.collateralDecimals);

    // Step 2: Actual debt amount (converting shares → assets via borrowIndex)
    // debtAmount = borrowShares × borrowIndex / 1e18
    const debtAmount = (position.borrowShares * borrowIndex) / WAD;

    // Step 3: Debt value in USD (WAD scaled)
    // debtValue = debtAmount × borrowPrice / 10^borrowDecimals
    const debtValue =
      (debtAmount * borrowPrice) / 10n ** BigInt(market.borrowDecimals);

    // Guard: zero debt value (shouldn't happen after borrowShares check, but defensive)
    if (debtValue === 0n) return WAD * 1000n;

    // Step 4: Health factor
    // HF = (collateralValue × liquidationThreshold) / debtValue
    const healthFactor =
      (collateralValue * market.liquidationThreshold) / debtValue;

    return healthFactor;
  }

  /**
   * Fetch the latest borrowIndex from each market contract.
   *
   * WHY ONCE PER MARKET, NOT PER POSITION?
   * ──────────────────────────────────────
   * borrowIndex is a market-level value, not per-user. Every borrower
   * in the same market shares the same borrowIndex. So if we have
   * 50 borrowers across 3 markets, we only need 3 RPC calls (not 50).
   *
   * Interest accrues on every interaction (deposit, borrow, repay, etc.)
   * or when accrueInterest() is called explicitly. Between calls, the
   * index stays constant. So our fetched value is accurate as of the
   * last on-chain interaction — close enough for liquidation detection.
   */
  private async refreshBorrowIndices(): Promise<void> {
    const activeMarkets = this.positionStore.getActiveMarkets();

    const results = await Promise.allSettled(
      activeMarkets.map(async (marketAddress) => {
        const contract = new ethers.Contract(
          marketAddress,
          LENDING_POOL_ABI,
          this.provider
        );
        const borrowIndex: bigint = await contract.borrowIndex();
        return { marketAddress, borrowIndex };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        this.borrowIndexCache.set(
          result.value.marketAddress.toLowerCase(),
          result.value.borrowIndex
        );
      } else {
        this.logger.warn("Failed to fetch borrowIndex", {
          error: result.reason?.message,
        });
      }
    }
  }

  /**
   * Verify locally-flagged positions by calling the on-chain healthFactor().
   *
   * WHY DOUBLE-CHECK?
   * ─────────────────
   * Our local calculation might differ from the contract's due to:
   *   - Rounding differences (bigint division truncates differently)
   *   - borrowIndex updated between our fetch and the actual check
   *   - Edge cases in oracle price normalization
   *
   * By verifying on-chain, we avoid submitting transactions that would
   * revert (wasting gas). This is cheap because we only verify the
   * few positions we think are liquidatable (usually 0-3), not all 50+.
   */
  private async verifyOnChain(
    candidates: Array<{ position: Position; healthFactor: bigint }>
  ): Promise<Array<{ position: Position; healthFactor: bigint }>> {
    const verified: Array<{ position: Position; healthFactor: bigint }> = [];

    for (const candidate of candidates) {
      try {
        const contract = new ethers.Contract(
          candidate.position.market,
          LENDING_POOL_ABI,
          this.provider
        );

        // Call the contract's isLiquidatable — this is the source of truth
        const liquidatable: boolean = await contract.isLiquidatable(
          candidate.position.user
        );

        if (liquidatable) {
          // Also get the on-chain HF for accurate logging
          const onChainHF: bigint = await contract.healthFactor(
            candidate.position.user
          );
          verified.push({
            position: candidate.position,
            healthFactor: onChainHF,
          });
        } else {
          this.logger.debug("Position not liquidatable on-chain (false positive)", {
            user: candidate.position.user.slice(0, 10),
            localHF: this.formatHF(candidate.healthFactor),
          });
        }
      } catch (error) {
        // If the on-chain check fails, include the candidate anyway
        // (better to attempt and have the tx simulation catch it)
        this.logger.warn("On-chain verification failed, including candidate", {
          user: candidate.position.user.slice(0, 10),
          error: (error as Error).message,
        });
        verified.push(candidate);
      }
    }

    return verified;
  }

  /**
   * Format a health factor bigint for human-readable logging.
   * 1.05e18 → "1.050"
   */
  private formatHF(hf: bigint): string {
    // Convert to a decimal with 3 places
    // hf is WAD scaled (1e18), so divide to get the integer part and remainder
    const integer = hf / WAD;
    const remainder = ((hf % WAD) * 1000n) / WAD; // 3 decimal places
    return `${integer}.${remainder.toString().padStart(3, "0")}`;
  }
}
