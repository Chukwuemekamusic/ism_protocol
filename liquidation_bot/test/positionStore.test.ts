import { describe, it, expect, beforeEach } from "vitest";
import { PositionStore } from "../src/state/positionStore.js";

/**
 * PositionStore Tests
 *
 * These tests verify the in-memory position tracking works correctly.
 * We test the same operations the EventIndexer and EventListener will
 * use to build and update positions.
 */

// Test constants — fake addresses
const MARKET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MARKET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";

describe("PositionStore", () => {
  let store: PositionStore;

  beforeEach(() => {
    store = new PositionStore();
  });

  // ============================================
  // BASIC CRUD
  // ============================================

  describe("upsert and get", () => {
    it("should create a new position", () => {
      store.upsert(MARKET_A, ALICE, {
        collateralAmount: 10n * 10n ** 18n, // 10 ETH
        borrowShares: 5000n * 10n ** 6n, // 5000 USDC worth of shares
        lastUpdated: 100,
      });

      const position = store.get(MARKET_A, ALICE);
      expect(position).toBeDefined();
      expect(position!.collateralAmount).toBe(10n * 10n ** 18n);
      expect(position!.borrowShares).toBe(5000n * 10n ** 6n);
      expect(position!.lastUpdated).toBe(100);
    });

    it("should update an existing position", () => {
      store.upsert(MARKET_A, ALICE, {
        collateralAmount: 10n,
        lastUpdated: 100,
      });
      store.upsert(MARKET_A, ALICE, {
        collateralAmount: 20n,
        lastUpdated: 200,
      });

      const position = store.get(MARKET_A, ALICE);
      expect(position!.collateralAmount).toBe(20n);
      expect(position!.lastUpdated).toBe(200);
    });

    it("should return undefined for non-existent position", () => {
      const position = store.get(MARKET_A, ALICE);
      expect(position).toBeUndefined();
    });

    it("should preserve fields not included in update", () => {
      store.upsert(MARKET_A, ALICE, {
        collateralAmount: 10n,
        borrowShares: 5n,
        lastUpdated: 100,
      });

      // Update only collateral — borrowShares should be preserved
      store.upsert(MARKET_A, ALICE, { collateralAmount: 20n });

      const position = store.get(MARKET_A, ALICE);
      expect(position!.collateralAmount).toBe(20n);
      expect(position!.borrowShares).toBe(5n); // unchanged
    });
  });

  // ============================================
  // ADDRESS NORMALIZATION
  // ============================================

  describe("address normalization", () => {
    it("should treat addresses as case-insensitive", () => {
      // This is critical — Ethereum addresses are case-insensitive
      // but JavaScript strings are not. Without normalization:
      //   "0xAbC" !== "0xabc" → same user appears as two positions
      const mixedCase = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";

      store.upsert(mixedCase, ALICE, { collateralAmount: 10n, lastUpdated: 1 });

      // Should find it with lowercase
      const position = store.get(MARKET_A, ALICE);
      expect(position).toBeDefined();
      expect(position!.collateralAmount).toBe(10n);
    });
  });

  // ============================================
  // COLLATERAL OPERATIONS
  // ============================================

  describe("collateral operations", () => {
    it("should add collateral to a new position", () => {
      store.addCollateral(MARKET_A, ALICE, 5n * 10n ** 18n, 100);

      const position = store.get(MARKET_A, ALICE);
      expect(position!.collateralAmount).toBe(5n * 10n ** 18n);
      expect(position!.borrowShares).toBe(0n); // default
    });

    it("should accumulate collateral across multiple deposits", () => {
      store.addCollateral(MARKET_A, ALICE, 5n * 10n ** 18n, 100);
      store.addCollateral(MARKET_A, ALICE, 3n * 10n ** 18n, 200);

      const position = store.get(MARKET_A, ALICE);
      expect(position!.collateralAmount).toBe(8n * 10n ** 18n);
      expect(position!.lastUpdated).toBe(200);
    });

    it("should remove collateral", () => {
      store.addCollateral(MARKET_A, ALICE, 10n * 10n ** 18n, 100);
      store.removeCollateral(MARKET_A, ALICE, 3n * 10n ** 18n, 200);

      const position = store.get(MARKET_A, ALICE);
      expect(position!.collateralAmount).toBe(7n * 10n ** 18n);
    });

    it("should floor collateral at zero", () => {
      store.addCollateral(MARKET_A, ALICE, 5n, 100);
      store.removeCollateral(MARKET_A, ALICE, 10n, 200); // more than available

      const position = store.get(MARKET_A, ALICE);
      expect(position!.collateralAmount).toBe(0n);
    });
  });

  // ============================================
  // BORROW OPERATIONS
  // ============================================

  describe("borrow operations", () => {
    it("should add borrow shares", () => {
      store.addBorrowShares(MARKET_A, ALICE, 1000n * 10n ** 6n, 100);

      const position = store.get(MARKET_A, ALICE);
      expect(position!.borrowShares).toBe(1000n * 10n ** 6n);
    });

    it("should accumulate borrow shares across multiple borrows", () => {
      store.addBorrowShares(MARKET_A, ALICE, 1000n, 100);
      store.addBorrowShares(MARKET_A, ALICE, 500n, 200);

      const position = store.get(MARKET_A, ALICE);
      expect(position!.borrowShares).toBe(1500n);
    });

    it("should remove borrow shares on repay", () => {
      store.addBorrowShares(MARKET_A, ALICE, 1000n, 100);
      store.removeBorrowShares(MARKET_A, ALICE, 400n, 200);

      const position = store.get(MARKET_A, ALICE);
      expect(position!.borrowShares).toBe(600n);
    });

    it("should floor borrow shares at zero", () => {
      store.addBorrowShares(MARKET_A, ALICE, 100n, 100);
      store.removeBorrowShares(MARKET_A, ALICE, 200n, 200);

      const position = store.get(MARKET_A, ALICE);
      expect(position!.borrowShares).toBe(0n);
    });
  });

  // ============================================
  // MULTI-MARKET ISOLATION
  // ============================================

  describe("market isolation", () => {
    it("should track positions independently per market", () => {
      // Alice has different positions in Market A and Market B
      // This is the core of "isolated markets" — they don't interfere
      store.addCollateral(MARKET_A, ALICE, 10n, 100);
      store.addBorrowShares(MARKET_A, ALICE, 5n, 100);

      store.addCollateral(MARKET_B, ALICE, 20n, 100);
      store.addBorrowShares(MARKET_B, ALICE, 15n, 100);

      const posA = store.get(MARKET_A, ALICE);
      const posB = store.get(MARKET_B, ALICE);

      expect(posA!.collateralAmount).toBe(10n);
      expect(posA!.borrowShares).toBe(5n);
      expect(posB!.collateralAmount).toBe(20n);
      expect(posB!.borrowShares).toBe(15n);
    });

    it("should return only positions for a specific market", () => {
      store.addCollateral(MARKET_A, ALICE, 10n, 100);
      store.addCollateral(MARKET_A, BOB, 20n, 100);
      store.addCollateral(MARKET_B, ALICE, 30n, 100);

      const marketAPositions = store.getAllForMarket(MARKET_A);
      expect(marketAPositions.length).toBe(2);

      const marketBPositions = store.getAllForMarket(MARKET_B);
      expect(marketBPositions.length).toBe(1);
    });
  });

  // ============================================
  // QUERY METHODS
  // ============================================

  describe("queries", () => {
    beforeEach(() => {
      // Set up: Alice borrows in Market A, Bob only deposits collateral
      store.addCollateral(MARKET_A, ALICE, 10n, 100);
      store.addBorrowShares(MARKET_A, ALICE, 5n, 100);

      store.addCollateral(MARKET_A, BOB, 20n, 100);
      // Bob has no borrows — just collateral
    });

    it("getWithBorrows should only return positions with active debt", () => {
      const borrowers = store.getWithBorrows();

      // Only Alice has borrowShares > 0
      expect(borrowers.length).toBe(1);
      expect(borrowers[0].user).toBe(ALICE.toLowerCase());
    });

    it("getAll should return all positions", () => {
      const all = store.getAll();
      expect(all.length).toBe(2); // Alice + Bob
    });
  });

  // ============================================
  // CLEANUP
  // ============================================

  describe("cleanup", () => {
    it("should remove a position", () => {
      store.addCollateral(MARKET_A, ALICE, 10n, 100);

      const removed = store.remove(MARKET_A, ALICE);
      expect(removed).toBe(true);
      expect(store.get(MARKET_A, ALICE)).toBeUndefined();
    });

    it("should return false when removing non-existent position", () => {
      const removed = store.remove(MARKET_A, ALICE);
      expect(removed).toBe(false);
    });

    it("pruneEmpty should remove zero-balance positions", () => {
      store.addCollateral(MARKET_A, ALICE, 10n, 100);
      store.addBorrowShares(MARKET_A, ALICE, 5n, 100);

      // Bob: zero collateral, zero borrows (created then fully withdrawn)
      store.addCollateral(MARKET_A, BOB, 10n, 100);
      store.removeCollateral(MARKET_A, BOB, 10n, 200);

      expect(store.getTotalPositions()).toBe(2);

      const pruned = store.pruneEmpty();
      expect(pruned).toBe(1); // Bob pruned
      expect(store.getTotalPositions()).toBe(1); // Only Alice remains
    });
  });

  // ============================================
  // STATS
  // ============================================

  describe("stats", () => {
    it("should count correctly", () => {
      store.addCollateral(MARKET_A, ALICE, 10n, 100);
      store.addBorrowShares(MARKET_A, ALICE, 5n, 100);
      store.addCollateral(MARKET_A, BOB, 20n, 100);
      store.addCollateral(MARKET_B, ALICE, 30n, 100);

      expect(store.getTotalPositions()).toBe(3);
      expect(store.getActiveBorrowerCount()).toBe(1); // Only Alice in Market A
      expect(store.getMarketCount()).toBe(2); // Market A + Market B
    });
  });
});
