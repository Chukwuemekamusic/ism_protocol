import { describe, it, expect, beforeEach } from "vitest";
import { AuctionStore } from "../src/state/auctionStore.js";
import type { Auction } from "../src/types.js";

/**
 * AuctionStore Tests
 *
 * Tests the auction lifecycle:
 *   add → track → markCompleted or expire → cleanup
 */

const MARKET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";

/** Helper to create a test auction */
function makeAuction(overrides: Partial<Auction> = {}): Auction {
  const now = Math.floor(Date.now() / 1000);
  return {
    auctionId: 1n,
    user: ALICE.toLowerCase(),
    pool: MARKET_A.toLowerCase(),
    debtToRepay: 5000n * 10n ** 6n, // 5000 USDC
    collateralForSale: 3n * 10n ** 18n, // 3 ETH
    startTime: now,
    endTime: now + 20 * 60, // 20 minutes from now
    startPrice: 1050n * 10n ** 6n, // 105% of oracle
    endPrice: 950n * 10n ** 6n, // 95% of oracle
    isActive: true,
    ...overrides,
  };
}

describe("AuctionStore", () => {
  let store: AuctionStore;

  beforeEach(() => {
    store = new AuctionStore();
  });

  // ============================================
  // BASIC OPERATIONS
  // ============================================

  describe("add and get", () => {
    it("should store and retrieve an auction", () => {
      const auction = makeAuction();
      store.add(auction);

      const retrieved = store.get(1n);
      expect(retrieved).toBeDefined();
      expect(retrieved!.auctionId).toBe(1n);
      expect(retrieved!.debtToRepay).toBe(5000n * 10n ** 6n);
      expect(retrieved!.isActive).toBe(true);
    });

    it("should return undefined for non-existent auction", () => {
      const retrieved = store.get(999n);
      expect(retrieved).toBeUndefined();
    });
  });

  // ============================================
  // USER LOOKUP (SECONDARY INDEX)
  // ============================================

  describe("user lookup", () => {
    it("should find active auction for a user in a market", () => {
      store.add(makeAuction({ auctionId: 1n, user: ALICE, pool: MARKET_A }));

      const active = store.getActiveForUser(MARKET_A, ALICE);
      expect(active).toBeDefined();
      expect(active!.auctionId).toBe(1n);
    });

    it("should return undefined when user has no active auction", () => {
      const active = store.getActiveForUser(MARKET_A, BOB);
      expect(active).toBeUndefined();
    });

    it("should return undefined after auction is completed", () => {
      store.add(makeAuction({ auctionId: 1n, user: ALICE, pool: MARKET_A }));
      store.markCompleted(1n);

      const active = store.getActiveForUser(MARKET_A, ALICE);
      expect(active).toBeUndefined();
    });

    it("hasActiveAuction should reflect current state", () => {
      expect(store.hasActiveAuction(MARKET_A, ALICE)).toBe(false);

      store.add(makeAuction({ auctionId: 1n, user: ALICE, pool: MARKET_A }));
      expect(store.hasActiveAuction(MARKET_A, ALICE)).toBe(true);

      store.markCompleted(1n);
      expect(store.hasActiveAuction(MARKET_A, ALICE)).toBe(false);
    });
  });

  // ============================================
  // AUCTION LIFECYCLE
  // ============================================

  describe("lifecycle", () => {
    it("should mark auction as completed", () => {
      store.add(makeAuction({ auctionId: 1n }));

      store.markCompleted(1n);

      const auction = store.get(1n);
      expect(auction!.isActive).toBe(false);
    });

    it("should handle marking non-existent auction as completed", () => {
      // Should not throw — defensive programming
      store.markCompleted(999n);
      expect(store.getActiveCount()).toBe(0);
    });
  });

  // ============================================
  // EXPIRY
  // ============================================

  describe("expiry", () => {
    it("should detect and return expired auctions", () => {
      const pastEndTime = Math.floor(Date.now() / 1000) - 100; // ended 100 seconds ago
      store.add(
        makeAuction({
          auctionId: 1n,
          startTime: pastEndTime - 1200,
          endTime: pastEndTime,
        }),
      );

      const now = Math.floor(Date.now() / 1000);
      const expired = store.removeExpired(now);

      expect(expired.length).toBe(1);
      expect(expired[0].auctionId).toBe(1n);

      // Should no longer be active
      const auction = store.get(1n);
      expect(auction!.isActive).toBe(false);
    });

    it("should not expire auctions that are still running", () => {
      const futureEndTime = Math.floor(Date.now() / 1000) + 600; // 10 min from now
      store.add(
        makeAuction({
          auctionId: 1n,
          endTime: futureEndTime,
        }),
      );

      const now = Math.floor(Date.now() / 1000);
      const expired = store.removeExpired(now);

      expect(expired.length).toBe(0);
      expect(store.get(1n)!.isActive).toBe(true);
    });

    it("should clean up very old inactive auctions", () => {
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
      store.add(
        makeAuction({
          auctionId: 1n,
          startTime: twoHoursAgo - 1200,
          endTime: twoHoursAgo,
        }),
      );
      // Mark as completed (not just expired)
      store.markCompleted(1n);

      const now = Math.floor(Date.now() / 1000);
      store.removeExpired(now);

      // Should be fully deleted (not just inactive)
      expect(store.getTotalCount()).toBe(0);
    });
  });

  // ============================================
  // MULTIPLE AUCTIONS
  // ============================================

  describe("multiple auctions", () => {
    it("should track auctions across different users", () => {
      store.add(makeAuction({ auctionId: 1n, user: ALICE, pool: MARKET_A }));
      store.add(makeAuction({ auctionId: 2n, user: BOB, pool: MARKET_A }));

      expect(store.getActiveCount()).toBe(2);
      expect(store.getActiveForUser(MARKET_A, ALICE)!.auctionId).toBe(1n);
      expect(store.getActiveForUser(MARKET_A, BOB)!.auctionId).toBe(2n);
    });

    it("getAllActive should return only active auctions", () => {
      store.add(makeAuction({ auctionId: 1n, user: ALICE }));
      store.add(makeAuction({ auctionId: 2n, user: BOB }));
      store.markCompleted(1n); // Alice's is done

      const active = store.getAllActive();
      expect(active.length).toBe(1);
      expect(active[0].auctionId).toBe(2n); // Only Bob's
    });
  });

  // ============================================
  // STATS
  // ============================================

  describe("stats", () => {
    it("should count correctly", () => {
      store.add(makeAuction({ auctionId: 1n }));
      store.add(makeAuction({ auctionId: 2n, user: BOB }));

      expect(store.getTotalCount()).toBe(2);
      expect(store.getActiveCount()).toBe(2);

      store.markCompleted(1n);
      expect(store.getTotalCount()).toBe(2); // still tracked
      expect(store.getActiveCount()).toBe(1); // only one active
    });
  });
});
