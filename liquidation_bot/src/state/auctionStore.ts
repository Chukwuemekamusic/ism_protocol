import { Auction } from "../types";

/**
 * AuctionStore — In-memory tracker of all Dutch auctions.
 *
 * WHY TRACK AUCTIONS SEPARATELY?
 * ───────────────────────────────
 * The bot has TWO ways to make money:
 *   1. START an auction for an underwater position (costs gas, no direct profit)
 *   2. EXECUTE a liquidation on an existing auction (earns collateral discount)
 *
 * To find type-2 opportunities, we need to know what auctions are currently
 * active and what their current price is. The AuctionStore maintains this.
 *
 * AUCTION LIFECYCLE
 * ─────────────────
 * 1. AuctionStarted event → add() — store the auction details
 * 2. Time passes → price decays from startPrice toward endPrice
 * 3a. LiquidationExecuted event → markCompleted() — auction fulfilled
 * 3b. AuctionCancelled event → markCompleted() — auction expired/cancelled
 * 3c. endTime passes → removeExpired() cleans it up
 *
 * COMPOSITE KEY FOR USER LOOKUP
 * ─────────────────────────────
 * We maintain a secondary index: "pool:user" → auctionId
 * This lets us quickly check "does this user already have an active auction
 * in this market?" — which we need before trying to start a new one.
 * Our contract enforces one auction per user per market, so we must too.
 */

export class AuctionStore {
  private auctions: Map<string, Auction> = new Map(); // auctionId => Auction
  private activeByUser: Map<string, string> = new Map(); // "pool:user" => auctionId

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Add a new auction to the store.
   */
  add(auction: Auction): void {
    const auctionKey = auction.auctionId.toString();
    const userKey = this.makeUserKey(auction.pool, auction.user);

    this.auctions.set(auctionKey, { ...auction });
    this.activeByUser.set(userKey, auctionKey);
  }

  /**
   * Mark an auction as completed (either by liquidation or expiration).
   * We don't delete it immediately — we mark isActive = false.
   * This way, if we see a late event referencing this auction, we won't
   * be confused. Expired auctions get cleaned up by removeExpired().
   */
  markCompleted(auctionId: bigint): void {
    const auctionKey = auctionId.toString();
    const auction = this.auctions.get(auctionKey);
    if (!auction) return;
    auction.isActive = false;

    // Remove from the user index
    const userKey = this.makeUserKey(auction.pool, auction.user);
    this.activeByUser.delete(userKey);
  }

  /**
   * Remove all expired auctions from the store.
   * Marks them as inactive rather than deleting immediately.
   */
  removeExpired(currentTimestamp: number): Auction[] {
    const expired: Auction[] = [];
    for (const [auctionKey, auction] of this.auctions.entries()) {
      if (auction.endTime < currentTimestamp && auction.isActive) {
        // Mark as inactive instead of deleting
        auction.isActive = false;
        expired.push(auction);

        // Remove from the user index
        const userKey = this.makeUserKey(auction.pool, auction.user);
        this.activeByUser.delete(userKey);
      }
    }

    // Also purge very old inactive auctions to prevent memory growth
    // Keep them for 1 hour after they became inactive, then delete
    const oneHourAgo = currentTimestamp - 3600;
    for (const [auctionKey, auction] of this.auctions.entries()) {
      if (!auction.isActive && auction.endTime < oneHourAgo) {
        this.auctions.delete(auctionKey);
      }
    }
    return expired;
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get an auction by its ID.
   */
  get(auctionId: bigint): Auction | undefined {
    return this.auctions.get(auctionId.toString());
  }

  /**
   * Check if a user already has an active auction in a specific market.
   *
   * This is critical before calling startAuction() — the contract will
   * revert with AuctionAlreadyExists if we try to start a second one.
   * Checking locally first saves us the gas of a failed transaction.
   */
  getActiveForUser(pool: string, user: string): Auction | undefined {
    const userKey = this.makeUserKey(pool, user);
    const auctionKey = this.activeByUser.get(userKey);

    if (!auctionKey) return undefined;

    const auction = this.auctions.get(auctionKey);
    // Double-check it's actually active (defensive)
    if (auction && auction.isActive) return auction;

    // Index was stale — clean it up
    this.activeByUser.delete(userKey);
    return undefined;
  }

  /**
   * Get all currently active auctions.
   *
   * The bot iterates over these each cycle to check if any have decayed
   * to a profitable price point for liquidation.
   */
  getAllActive(): Auction[] {
    const active: Auction[] = [];
    for (const auction of this.auctions.values()) {
      if (auction.isActive) {
        active.push(auction);
      }
    }
    return active;
  }

  /**
   * Check if a user has any active auction in any market.
   * Useful for logging and debugging.
   */
  hasActiveAuction(pool: string, user: string): boolean {
    return this.getActiveForUser(pool, user) !== undefined;
  }

  // ============================================
  // STATS
  // ============================================

  /** Total auctions tracked (active + inactive) */
  getTotalCount(): number {
    return this.auctions.size;
  }

  /** Currently active auctions only */
  getActiveCount(): number {
    let count = 0;
    for (const auction of this.auctions.values()) {
      if (auction.isActive) count++;
    }
    return count;
  }

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  /**
   * Create a composite key for the user-lookup index.
   * Format: "poolAddress:userAddress" (both lowercase)
   */
  private makeUserKey(pool: string, user: string): string {
    return `${pool.toLowerCase()}:${user.toLowerCase()}`;
  }
}
