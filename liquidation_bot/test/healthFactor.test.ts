import { describe, it, expect } from "vitest";
import type { Position, MarketInfo } from "../src/types.js";
import { WAD } from "../src/types.js";

/**
 * Health Factor Calculation Tests
 *
 * We test the math directly without needing a blockchain connection.
 * The HealthMonitor.calculateHealthFactor() method is the core formula,
 * but since it's a class method that requires constructor dependencies,
 * we extract the pure math into a standalone function for testing.
 *
 * This is a common pattern: test the LOGIC separately from the WIRING.
 *
 * THE FORMULA
 * ───────────
 * HF = (collateralValue × liquidationThreshold) / debtValue
 *
 * Where:
 *   collateralValue = collateralAmount × collateralPrice / 10^collateralDecimals
 *   debtAmount = borrowShares × borrowIndex / 1e18
 *   debtValue = debtAmount × borrowPrice / 10^borrowDecimals
 */

// Extract the pure math for testability
function calculateHealthFactor(
  collateralAmount: bigint,
  collateralPrice: bigint,
  collateralDecimals: number,
  borrowShares: bigint,
  borrowPrice: bigint,
  borrowDecimals: number,
  borrowIndex: bigint,
  liquidationThreshold: bigint,
): bigint {
  if (borrowShares === 0n) return WAD * 1000n;

  const collateralValue =
    (collateralAmount * collateralPrice) / 10n ** BigInt(collateralDecimals);

  const debtAmount = (borrowShares * borrowIndex) / WAD;

  const debtValue = (debtAmount * borrowPrice) / 10n ** BigInt(borrowDecimals);

  if (debtValue === 0n) return WAD * 1000n;

  return (collateralValue * liquidationThreshold) / debtValue;
}

// ============================================
// TEST CONSTANTS
// ============================================

// Prices (WAD scaled — 18 decimals)
const ETH_PRICE = 2000n * WAD; // $2,000
const USDC_PRICE = 1n * WAD; // $1.00
const BTC_PRICE = 40000n * WAD; // $40,000

// Standard parameters
const LIQ_THRESHOLD_80 = (WAD * 80n) / 100n; // 80% = 0.8e18
const LIQ_THRESHOLD_75 = (WAD * 75n) / 100n; // 75%
const BORROW_INDEX_FRESH = WAD; // 1.0 = no interest yet
const BORROW_INDEX_2PCT = WAD + (WAD * 2n) / 100n; // 1.02 = 2% interest

describe("Health Factor Calculation", () => {
  // ============================================
  // BASIC SCENARIOS
  // ============================================

  describe("basic scenarios", () => {
    it("should return very large HF when no borrows", () => {
      const hf = calculateHealthFactor(
        10n * 10n ** 18n, // 10 ETH
        ETH_PRICE,
        18,
        0n, // No borrows
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );

      expect(hf).toBe(WAD * 1000n); // Effectively infinite
    });

    it("should calculate healthy position correctly", () => {
      // 10 ETH collateral ($20,000) + 80% threshold = $16,000 effective
      // 10,000 USDC debt = $10,000
      // HF = $16,000 / $10,000 = 1.6
      const hf = calculateHealthFactor(
        10n * 10n ** 18n, // 10 ETH (18 decimals)
        ETH_PRICE, // $2,000
        18,
        10_000n * 10n ** 6n, // 10,000 USDC shares (6 decimals)
        USDC_PRICE, // $1.00
        6,
        BORROW_INDEX_FRESH, // 1.0 (no interest)
        LIQ_THRESHOLD_80, // 80%
      );

      // Expected: 1.6e18
      expect(hf).toBe((WAD * 16n) / 10n);
    });

    it("should detect liquidatable position (HF < 1.0)", () => {
      // 10 ETH collateral ($20,000) + 80% threshold = $16,000 effective
      // 18,000 USDC debt = $18,000
      // HF = $16,000 / $18,000 ≈ 0.888
      const hf = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE,
        18,
        18_000n * 10n ** 6n, // 18,000 USDC debt
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );

      // HF should be < 1.0 (< WAD)
      expect(hf).toBeLessThan(WAD);

      // More precisely: 16000/18000 = 0.8888...
      // In WAD: ~888888888888888888
      const expected = (WAD * 16000n) / 18000n;
      expect(hf).toBe(expected);
    });

    it("should detect position exactly at threshold", () => {
      // 10 ETH ($20,000) × 80% = $16,000 effective
      // 16,000 USDC debt = $16,000
      // HF = 1.0 exactly
      const hf = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE,
        18,
        16_000n * 10n ** 6n,
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );

      // HF should be exactly 1.0 = WAD
      expect(hf).toBe(WAD);
    });
  });

  // ============================================
  // INTEREST ACCRUAL IMPACT
  // ============================================

  describe("interest accrual", () => {
    it("should reduce HF when interest accrues", () => {
      // Same position, but borrowIndex has increased by 2%
      // This means actual debt is 2% higher than the share amount

      const hfFresh = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE,
        18,
        15_000n * 10n ** 6n, // 15,000 shares
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH, // 1.0 → debt = 15,000
        LIQ_THRESHOLD_80,
      );

      const hfWithInterest = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE,
        18,
        15_000n * 10n ** 6n, // Same 15,000 shares
        USDC_PRICE,
        6,
        BORROW_INDEX_2PCT, // 1.02 → debt = 15,300
        LIQ_THRESHOLD_80,
      );

      // With interest, HF should be lower
      expect(hfWithInterest).toBeLessThan(hfFresh);

      // Fresh: HF = (20000 * 0.8) / 15000 = 1.0666...
      // With 2% interest: HF = (20000 * 0.8) / 15300 = 1.0457...
    });

    it("interest can push healthy position into liquidation", () => {
      // Position that's healthy at 1.0 borrowIndex but underwater at 1.02
      // 10 ETH ($20,000) × 80% = $16,000 effective
      // 15,800 USDC shares

      // At index 1.0: debt = 15,800, HF = 16000/15800 = 1.0126 (healthy)
      const hfFresh = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE,
        18,
        15_800n * 10n ** 6n,
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );
      expect(hfFresh).toBeGreaterThan(WAD); // Healthy

      // At index 1.02: debt = 15,800 × 1.02 = 16,116, HF = 16000/16116 = 0.9928 (liquidatable!)
      const hfWithInterest = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE,
        18,
        15_800n * 10n ** 6n,
        USDC_PRICE,
        6,
        BORROW_INDEX_2PCT,
        LIQ_THRESHOLD_80,
      );
      expect(hfWithInterest).toBeLessThan(WAD); // Now liquidatable!
    });
  });

  // ============================================
  // PRICE MOVEMENT SCENARIOS
  // ============================================

  describe("price movements", () => {
    it("collateral price drop should reduce HF", () => {
      const hfNormal = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE, // $2,000
        18,
        12_000n * 10n ** 6n,
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );
      // HF = (20000 * 0.8) / 12000 = 1.333

      const ethPriceCrash = 1500n * WAD; // ETH drops to $1,500 (-25%)
      const hfCrash = calculateHealthFactor(
        10n * 10n ** 18n,
        ethPriceCrash, // $1,500
        18,
        12_000n * 10n ** 6n,
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );
      // HF = (15000 * 0.8) / 12000 = 1.0

      expect(hfCrash).toBeLessThan(hfNormal);
      expect(hfCrash).toBe(WAD); // Exactly at threshold
    });

    it("borrow token price increase should reduce HF", () => {
      // If USDC depegged upward to $1.05, debt is worth more in USD
      const usdcUp = WAD + WAD / 20n; // $1.05

      const hf = calculateHealthFactor(
        10n * 10n ** 18n,
        ETH_PRICE,
        18,
        15_000n * 10n ** 6n,
        usdcUp, // USDC at $1.05
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );

      // Normal: HF = (20000 * 0.8) / 15000 = 1.0666
      // With USDC at $1.05: debt = 15000 * 1.05 = $15,750
      // HF = 16000 / 15750 = 1.0158
      expect(hf).toBeLessThan((WAD * 107n) / 100n); // Less than 1.07
      expect(hf).toBeGreaterThan(WAD); // But still healthy
    });
  });

  // ============================================
  // DIFFERENT DECIMAL PAIRS
  // ============================================

  describe("different decimal tokens", () => {
    it("should handle WBTC (8 decimals) as collateral", () => {
      // WBTC has 8 decimals, USDC has 6
      // 1 WBTC = $40,000
      const hf = calculateHealthFactor(
        1n * 10n ** 8n, // 1 WBTC (8 decimals)
        BTC_PRICE, // $40,000
        8, // BTC decimals
        20_000n * 10n ** 6n, // 20,000 USDC debt
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_75, // 75% threshold for BTC
      );

      // collateralValue = 1e8 × 40000e18 / 1e8 = 40000e18 ($40,000)
      // effective = 40000 × 0.75 = $30,000
      // HF = 30000 / 20000 = 1.5
      expect(hf).toBe((WAD * 15n) / 10n);
    });

    it("should handle 18-decimal collateral and 6-decimal borrow", () => {
      // This is the most common pair: WETH(18) / USDC(6)
      const hf = calculateHealthFactor(
        5n * 10n ** 18n, // 5 ETH
        ETH_PRICE, // $2,000
        18,
        8_000n * 10n ** 6n, // 8,000 USDC
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );

      // collateralValue = 5e18 × 2000e18 / 1e18 = 10000e18 ($10,000)
      // effective = 10000 × 0.80 = $8,000
      // HF = 8000 / 8000 = 1.0
      expect(hf).toBe(WAD);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("edge cases", () => {
    it("should handle very small positions", () => {
      // Dust amounts — 0.001 ETH collateral, 1 USDC debt
      const hf = calculateHealthFactor(
        10n ** 15n, // 0.001 ETH
        ETH_PRICE,
        18,
        1n * 10n ** 6n, // 1 USDC
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );

      // collateralValue = 0.001 × $2000 = $2
      // effective = $2 × 0.80 = $1.60
      // HF = 1.60 / 1.00 = 1.6
      expect(hf).toBe((WAD * 16n) / 10n);
    });

    it("should handle very large positions without overflow", () => {
      // Whale: 10,000 ETH collateral, $15M debt
      // This tests that our bigint math doesn't overflow
      const hf = calculateHealthFactor(
        10_000n * 10n ** 18n, // 10,000 ETH ($20M)
        ETH_PRICE,
        18,
        15_000_000n * 10n ** 6n, // $15M USDC
        USDC_PRICE,
        6,
        BORROW_INDEX_FRESH,
        LIQ_THRESHOLD_80,
      );

      // effective = $20M × 0.80 = $16M
      // HF = $16M / $15M = 1.0666...
      const expected = (WAD * 16_000_000n) / 15_000_000n;
      expect(hf).toBe(expected);
    });
  });
});
