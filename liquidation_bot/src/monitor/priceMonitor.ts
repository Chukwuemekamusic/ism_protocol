import { ethers } from "ethers";
import type winston from "winston";
import type { PriceData } from "../types.js";
import { ORACLE_ROUTER_ABI } from "../contracts/abis.js";

/**
 * PriceMonitor — Fetches and caches token prices from the OracleRouter.
 *
 * WHY CACHE PRICES?
 * ─────────────────
 * During each monitoring cycle, the bot needs prices to calculate health
 * factors for EVERY position with active borrows. If there are 50 borrowers
 * across 3 markets, we'd need prices for maybe 4 unique tokens. Without
 * caching, we'd call getPrice() hundreds of times per cycle (once per
 * position × tokens involved). With caching, we call it once per token
 * per cycle and reuse the result.
 *
 * HOW ORACLE PRICES WORK IN OUR PROTOCOL
 * ───────────────────────────────────────
 * The OracleRouter returns prices in USD with 18 decimals (WAD):
 *   - ETH: ~2000_000000000000000000 (2000e18 = $2,000)
 *   - BTC: ~40000_000000000000000000 (40000e18 = $40,000)
 *   - USDC: ~1_000000000000000000 (1e18 = $1.00)
 *
 * This standardized format makes cross-token value comparisons easy.
 * To get the USD value of an amount:
 *   valueUsd = amount × price / 10^tokenDecimals / 10^18
 *
 * Or more precisely using WAD math:
 *   valueWad = amount × price / 10^tokenDecimals
 *   valueUsd = Number(valueWad) / 1e18
 */
export class PriceMonitor {
  private oracleContract: ethers.Contract;
  private logger: winston.Logger;

  /** Cached prices: token address (lowercase) → PriceData */
  private prices: Map<string, PriceData> = new Map();

  constructor(
    oracleRouterAddress: string,
    provider: ethers.JsonRpcProvider,
    logger: winston.Logger
  ) {
    this.oracleContract = new ethers.Contract(
      oracleRouterAddress,
      ORACLE_ROUTER_ABI,
      provider
    );
    this.logger = logger;
  }

  /**
   * Fetch fresh prices for a list of tokens.
   *
   * Called once at the start of each monitoring cycle.
   * We use Promise.allSettled (not Promise.all) so that one failed
   * price fetch doesn't crash the entire cycle. If ETH price fails
   * but USDC price succeeds, we can still monitor USDC-only markets.
   *
   * WHY allSettled vs all?
   * ──────────────────────
   * Promise.all: If ANY promise rejects, the entire batch fails.
   *   → One flaky oracle feed kills ALL monitoring for this cycle.
   *
   * Promise.allSettled: All promises run to completion. We check each result.
   *   → One flaky feed only affects markets using that token.
   *
   * In production, oracle feeds can occasionally fail (stale data, sequencer
   * downtime on L2s). We want the bot to gracefully degrade, not crash.
   */
  async updatePrices(tokens: string[]): Promise<void> {
    // Deduplicate tokens (same token might appear in multiple markets)
    const uniqueTokens = [...new Set(tokens.map((t) => t.toLowerCase()))];

    const results = await Promise.allSettled(
      uniqueTokens.map(async (token) => {
        const price: bigint = await this.oracleContract.getPrice(token);
        return { token, price };
      })
    );

    let successCount = 0;
    let failCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { token, price } = result.value;
        this.prices.set(token.toLowerCase(), {
          token: token.toLowerCase(),
          price,
          decimals: 18, // Oracle always returns WAD-scaled
          timestamp: Math.floor(Date.now() / 1000),
        });
        successCount++;
      } else {
        failCount++;
        this.logger.warn("Failed to fetch price", {
          error: result.reason?.message ?? "Unknown error",
        });
      }
    }

    this.logger.debug("Prices updated", {
      success: successCount,
      failed: failCount,
      tokens: uniqueTokens.length,
    });
  }

  /**
   * Get the cached price for a token.
   * Returns undefined if not yet fetched or if the last fetch failed.
   */
  getPrice(token: string): PriceData | undefined {
    return this.prices.get(token.toLowerCase());
  }

  /**
   * Convert a token amount to its USD value.
   *
   * THE MATH EXPLAINED
   * ──────────────────
   * Say we have 10 ETH and ETH price is $2,000:
   *   amount = 10_000000000000000000 (10e18, 18 decimals)
   *   price  = 2000_000000000000000000 (2000e18, WAD)
   *
   * Naive: amount × price = 10e18 × 2000e18 = 20000e36 (overflow risk!)
   *
   * Better: (amount × price) / 10^tokenDecimals / 10^18
   *   = (10e18 × 2000e18) / 1e18 / 1e18
   *   = 20000e36 / 1e36
   *   = 20000
   *   = $20,000 ✓
   *
   * We return a regular number (not bigint) because USD values
   * are only used for profitability thresholds ($5 minimum profit),
   * where floating-point precision is fine.
   */
  getValueUsd(token: string, amount: bigint, tokenDecimals: number): number | undefined {
    const priceData = this.getPrice(token);
    if (!priceData) return undefined;

    // amount × price / 10^tokenDecimals / 10^18 (WAD)
    // We do this in bigint first, then convert to Number at the end
    // to avoid intermediate floating-point errors on large values.
    const numerator = amount * priceData.price;
    const denominator = 10n ** BigInt(tokenDecimals) * 10n ** 18n;

    // Convert to float — safe here because USD amounts are reasonable
    return Number(numerator * 10000n / denominator) / 10000;
  }

  /**
   * Check if we have a recent price for a token.
   * "Recent" means fetched within the last 60 seconds.
   */
  hasRecentPrice(token: string, maxAgeSeconds: number = 60): boolean {
    const priceData = this.getPrice(token);
    if (!priceData) return false;

    const now = Math.floor(Date.now() / 1000);
    return now - priceData.timestamp < maxAgeSeconds;
  }

  /**
   * Get all cached prices (for logging/debugging).
   */
  getAllPrices(): PriceData[] {
    return Array.from(this.prices.values());
  }
}
