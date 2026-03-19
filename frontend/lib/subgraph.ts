/**
 * Subgraph utilities and queries for ISM Protocol
 *
 * The Graph endpoint: https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest
 */

import { request, gql } from "graphql-request";

// Subgraph endpoint
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL!;

if (!SUBGRAPH_URL) {
  console.warn("NEXT_PUBLIC_SUBGRAPH_URL is not set in .env.local");
}

/**
 * Types
 */

export interface LiquidatablePosition {
  id: string;
  user: { id: string };
  market: {
    id: string;
    collateralToken: { symbol: string; decimals: number };
    borrowToken: { symbol: string; decimals: number };
  };
  collateralAmount: string;
  borrowedAmount: string;
  healthFactor: string;
  timeUnderwater: string;
  underwaterSince: string;
  lastUpdate: string;
}

export interface ActiveAuction {
  id: string;
  borrower: { id: string };
  market: {
    id: string;
    collateralToken: { symbol: string };
    borrowToken: { symbol: string };
  };
  collateralAmount: string;
  debtAmount: string;
  startTime: string;
  endTime: string;
  startPriceMultiplier: string;
  endPriceMultiplier: string;
  currentPriceMultiplier: string;
  startedBy: string;
}

export interface Liquidation {
  id: string;
  liquidator: { id: string };
  borrower: { id: string };
  market: {
    id: string;
    collateralToken: { symbol: string };
    borrowToken: { symbol: string };
  };
  debtRepaid: string;
  collateralReceived: string;
  penalty: string;
  profitUSD: string;
  timestamp: string;
  transactionHash: string;
  blockNumber: string;
}

export interface Market {
  id: string;
  collateralToken: {
    symbol: string;
    name: string;
    decimals: number;
  };
  borrowToken: {
    symbol: string;
    name: string;
    decimals: number;
  };
  totalSupplyAssets: string;
  totalBorrowAssets: string;
  totalCollateral: string;
  utilizationRate: string;
  borrowRate: string;
  supplyRate: string;
  ltv: string;
  liquidationThreshold: string;
  createdAt: string;
}

export interface Position {
  id: string;
  market: {
    id: string;
    collateralToken: { symbol: string };
    borrowToken: { symbol: string };
  };
  suppliedAssets: string;
  suppliedShares: string;
  collateralAmount: string;
  borrowedAmount: string;
  borrowShares: string;
  healthFactor: string;
  isLiquidatable: boolean;
  timeUnderwater: string;
  lastUpdate: string;
}

/**
 * Queries
 */

const LIQUIDATABLE_POSITIONS_QUERY = gql`
  query LiquidatablePositions($first: Int = 50) {
    positions(
      where: { healthFactor_lt: "1.0", borrowedAmount_gt: "0" }
      orderBy: healthFactor
      orderDirection: asc
      first: $first
    ) {
      id
      user {
        id
      }
      market {
        id
        collateralToken {
          symbol
          decimals
        }
        borrowToken {
          symbol
          decimals
        }
      }
      collateralAmount
      borrowedAmount
      healthFactor
      timeUnderwater
      underwaterSince
      lastUpdate
    }
  }
`;

const ACTIVE_AUCTIONS_QUERY = gql`
  query ActiveAuctions($first: Int = 20) {
    auctions(
      where: { isActive: true }
      orderBy: startTime
      orderDirection: desc
      first: $first
    ) {
      id
      borrower {
        id
      }
      market {
        id
        collateralToken {
          symbol
        }
        borrowToken {
          symbol
        }
      }
      collateralAmount
      debtAmount
      startTime
      endTime
      startPriceMultiplier
      endPriceMultiplier
      currentPriceMultiplier
      startedBy
    }
  }
`;

const LIQUIDATION_HISTORY_QUERY = gql`
  query LiquidationHistory($first: Int = 50, $skip: Int = 0) {
    liquidations(
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      liquidator {
        id
      }
      borrower {
        id
      }
      market {
        id
        collateralToken {
          symbol
        }
        borrowToken {
          symbol
        }
      }
      debtRepaid
      collateralReceived
      penalty
      profitUSD
      timestamp
      transactionHash
      blockNumber
    }
  }
`;

const USER_LIQUIDATIONS_QUERY = gql`
  query UserLiquidations($userAddress: String!) {
    liquidations(
      where: { liquidator: $userAddress }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      borrower {
        id
      }
      market {
        collateralToken {
          symbol
        }
        borrowToken {
          symbol
        }
      }
      debtRepaid
      collateralReceived
      profitUSD
      timestamp
      transactionHash
    }
  }
`;

const MARKETS_QUERY = gql`
  query Markets {
    markets(first: 100) {
      id
      collateralToken {
        symbol
        name
        decimals
      }
      borrowToken {
        symbol
        name
        decimals
      }
      totalSupplyAssets
      totalBorrowAssets
      totalCollateral
      utilizationRate
      borrowRate
      supplyRate
      ltv
      liquidationThreshold
      createdAt
    }
  }
`;

const USER_POSITIONS_QUERY = gql`
  query UserPositions($userAddress: String!) {
    positions(where: { user: $userAddress }) {
      id
      market {
        id
        collateralToken {
          symbol
        }
        borrowToken {
          symbol
        }
      }
      suppliedAssets
      suppliedShares
      collateralAmount
      borrowedAmount
      borrowShares
      healthFactor
      isLiquidatable
      timeUnderwater
      lastUpdate
    }
  }
`;

/**
 * Query Functions
 */

export async function getLiquidatablePositions(
  first = 50,
): Promise<{ positions: LiquidatablePosition[] }> {
  return request(SUBGRAPH_URL, LIQUIDATABLE_POSITIONS_QUERY, { first });
}

export async function getActiveAuctions(
  first = 20,
): Promise<{ auctions: ActiveAuction[] }> {
  return request(SUBGRAPH_URL, ACTIVE_AUCTIONS_QUERY, { first });
}

export async function getLiquidationHistory(
  first = 50,
  skip = 0,
): Promise<{ liquidations: Liquidation[] }> {
  return request(SUBGRAPH_URL, LIQUIDATION_HISTORY_QUERY, { first, skip });
}

export async function getUserLiquidations(
  userAddress: string,
): Promise<{ liquidations: Liquidation[] }> {
  return request(SUBGRAPH_URL, USER_LIQUIDATIONS_QUERY, { userAddress });
}

export async function getMarkets(): Promise<{ markets: Market[] }> {
  return request(SUBGRAPH_URL, MARKETS_QUERY);
}

export async function getUserPositions(
  userAddress: string,
): Promise<{ positions: Position[] }> {
  return request(SUBGRAPH_URL, USER_POSITIONS_QUERY, { userAddress });
}

/**
 * Utility Functions
 */

/**
 * Calculate current auction price based on linear decay
 */
export function calculateCurrentAuctionPrice(auction: ActiveAuction): bigint {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const startTime = BigInt(auction.startTime);
  const endTime = BigInt(auction.endTime);
  const startPrice = BigInt(auction.startPriceMultiplier);
  const endPrice = BigInt(auction.endPriceMultiplier);

  if (now <= startTime) return startPrice;
  if (now >= endTime) return endPrice;

  const elapsed = now - startTime;
  const duration = endTime - startTime;
  const priceDelta = startPrice - endPrice;

  // Linear interpolation: price = startPrice - (priceDelta * elapsed / duration)
  const currentPrice = startPrice - (priceDelta * elapsed) / duration;

  return currentPrice;
}

/**
 * Format health factor for display (1.5 = "1.50")
 */
export function formatHealthFactor(hf: string): string {
  const value = parseFloat(hf);
  return value.toFixed(2);
}

/**
 * Check if position is critically underwater (HF < 0.95)
 */
export function isCriticallyUndunderwater(hf: string): boolean {
  return parseFloat(hf) < 0.95;
}

/**
 * Format time underwater as human readable (e.g., "5m", "2h", "3d")
 */
export function formatTimeUnderwater(seconds: string): string {
  const sec = parseInt(seconds);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
