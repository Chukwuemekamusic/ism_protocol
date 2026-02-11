import { Position } from "../types";

/**
 * PositionStore — In-memory tracker of all user positions across all markets.
 * - Stores positions by user address for fast lookups
 * - Maintains a list of all markets for easy iteration
 * DATA STRUCTURE
 * ──────────────
 * We use a nested Map:
 *   market address → user address → Position
 */

export class PositionStore {
  /** market address (lowercase) → user address (lowercase) → Position */
  private positions: Map<string, Map<string, Position>> = new Map();

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create or update a position.
   */
  upsert(market: string, user: string, update: Partial<Position>): Position {
    const marketKey = market.toLowerCase();
    const userKey = user.toLowerCase();

    // Get or create the market's position map
    let marketPositions = this.positions.get(marketKey);
    if (!marketPositions) {
      marketPositions = new Map();
      this.positions.set(marketKey, marketPositions);
    }

    // Get existing position or create default
    const existing = marketPositions.get(userKey);
    const position: Position = {
      user: userKey,
      market: marketKey,
      collateralAmount: existing?.collateralAmount ?? 0n,
      borrowShares: existing?.borrowShares ?? 0n,
      lastUpdated: existing?.lastUpdated ?? 0,
      ...update,
    };

    // Update the store
    marketPositions.set(userKey, position);
    return position;
  }

  /**
   * Add to a position's collateral amount.
   *
   * Why a separate method instead of just upsert?
   * Because events give us *deltas* ("+5 ETH deposited"), not absolute values.
   * We need to add/subtract from the existing amount.
   */
  addCollateral(
    market: string,
    user: string,
    amount: bigint,
    blockNumber: number,
  ): Position {
    const existing = this.get(market, user);
    const currentCollateral = existing?.collateralAmount ?? 0n;

    return this.upsert(market, user, {
      collateralAmount: currentCollateral + amount,
      lastUpdated: blockNumber,
    });
  }

  /**
   * Subtract from a position's collateral amount.
   * Floors at 0 to handle any edge cases with event ordering.
   */
  removeCollateral(
    market: string,
    user: string,
    amount: bigint,
    blockNumber: number,
  ): Position {
    const existing = this.get(market, user);
    const currentCollateral = existing?.collateralAmount ?? 0n;

    // Floor at 0 — shouldn't happen with correct events, but defensive
    const newCollateral =
      currentCollateral > amount ? currentCollateral - amount : 0n;

    return this.upsert(market, user, {
      collateralAmount: newCollateral,
      lastUpdated: blockNumber,
    });
  }

  /**
   * Add borrow shares to a position.
   */
  addBorrowShares(
    market: string,
    user: string,
    shares: bigint,
    blockNumber: number,
  ): Position {
    const existing = this.get(market, user);
    const currentShares = existing?.borrowShares ?? 0n;

    return this.upsert(market, user, {
      borrowShares: currentShares + shares,
      lastUpdated: blockNumber,
    });
  }

  /**
   * Subtract borrow shares from a position (on repay or liquidation).
   * Floors at 0 defensively.
   */
  removeBorrowShares(
    market: string,
    user: string,
    shares: bigint,
    blockNumber: number,
  ): Position {
    const existing = this.get(market, user);
    const currentShares = existing?.borrowShares ?? 0n;

    const newShares = currentShares > shares ? currentShares - shares : 0n;

    return this.upsert(market, user, {
      borrowShares: newShares,
      lastUpdated: blockNumber,
    });
  }

  /**
   * Remove a position entirely.
   * Used when both collateral and borrow are zero — no reason to keep tracking.
   */
  remove(market: string, user: string): boolean {
    const marketKey = market.toLowerCase();
    const userKey = user.toLowerCase();

    const marketPositions = this.positions.get(marketKey);
    if (!marketPositions) return false;

    const deleted = marketPositions.delete(userKey);

    // Clean up empty market maps to avoid memory leaks over time
    if (marketPositions.size === 0) {
      this.positions.delete(marketKey);
    }

    return deleted;
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get a specific position by market and user.
   */
  get(market: string, user: string): Position | undefined {
    return this.positions.get(market.toLowerCase())?.get(user.toLowerCase());
  }

  /**
   * Get all positions for a specific market.
   * Used for global stats and debugging.
   */
  getAll(): Position[] {
    const all: Position[] = [];
    for (const marketPositions of this.positions.values()) {
      for (const position of marketPositions.values()) {
        all.push(position);
      }
    }
    return all;
  }

  /**
   * Get all positions for a specific market.
   * Used when scanning a single market for liquidation opportunities.
   */
  getAllForMarket(market: string): Position[] {
    const marketKey = market.toLowerCase();
    const marketPositions = this.positions.get(marketKey);
    if (!marketPositions) return [];
    return Array.from(marketPositions.values());
  }

  /**
   * Get all positions that have active borrows (borrowShares > 0).
   *
   * This is the most important query for the bot — these are the only
   * positions that CAN be liquidated. No borrow = no debt = no liquidation.
   * By filtering early, we avoid calculating health factors for positions
   * that can never be underwater.
   */
  getWithBorrows(): Position[] {
    const withBorrows: Position[] = [];
    for (const marketPositions of this.positions.values()) {
      for (const position of marketPositions.values()) {
        if (position.borrowShares > 0n) {
          withBorrows.push(position);
        }
      }
    }
    return withBorrows;
  }

  /**
   * Get all unique market addresses that have at least one position.
   */
  getActiveMarkets(): string[] {
    return Array.from(this.positions.keys());
  }

  // ============================================
  // STATS (for logging and monitoring)
  // ============================================

  /** Total positions tracked (including those with zero balances) */
  getTotalPositions(): number {
    let count = 0;
    for (const marketPositions of this.positions.values()) {
      count += marketPositions.size;
    }
    return count;
  }

  /** Positions with active borrows (eligible for liquidation) */
  getActiveBorrowerCount(): number {
    let count = 0;
    for (const marketPositions of this.positions.values()) {
      for (const position of marketPositions.values()) {
        if (position.borrowShares > 0n) count++;
      }
    }
    return count;
  }

  /** Number of markets being tracked */
  getMarketCount(): number {
    return this.positions.size;
  }

  /** Clean up positions where both collateral and borrows are zero */
  pruneEmpty(): number {
    let pruned = 0;
    for (const [marketKey, marketPositions] of this.positions.entries()) {
      for (const [userKey, position] of marketPositions.entries()) {
        if (position.collateralAmount === 0n && position.borrowShares === 0n) {
          marketPositions.delete(userKey);
          pruned++;
        }
      }
      if (marketPositions.size === 0) {
        this.positions.delete(marketKey);
      }
    }
    return pruned;
  }
}
