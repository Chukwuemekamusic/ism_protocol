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
 * Retry configuration
 */
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds

/**
 * Request throttling configuration
 * Limits concurrent requests to avoid overwhelming The Graph
 */
const MAX_CONCURRENT_REQUESTS = 2;
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

/**
 * Request queue management
 */
let activeRequests = 0;
let lastRequestTime = 0;
const requestQueue: Array<() => void> = [];

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, attempt),
    MAX_RETRY_DELAY,
  );
  // Add jitter (random 0-25% of delay)
  const jitter = exponentialDelay * 0.25 * Math.random();
  return exponentialDelay + jitter;
}

/**
 * Acquire a request slot (throttling mechanism)
 */
async function acquireRequestSlot(): Promise<void> {
  // Wait if we have too many concurrent requests
  while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise((resolve) => {
      requestQueue.push(resolve as () => void);
    });
  }

  // Ensure minimum interval between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  activeRequests++;
  lastRequestTime = Date.now();
}

/**
 * Release a request slot
 */
function releaseRequestSlot(): void {
  activeRequests--;
  const next = requestQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Wrapper for GraphQL requests with retry logic and rate limit handling
 */
async function requestWithRetry<T = any>(
  query: string,
  variables?: any,
  retryCount = 0,
): Promise<T> {
  // Acquire a request slot (throttling)
  await acquireRequestSlot();

  try {
    const result = await request<T>(SUBGRAPH_URL, query, variables);
    return result;
  } catch (error: any) {
    const isRateLimitError =
      error?.response?.status === 429 ||
      error?.message?.includes("429") ||
      error?.message?.includes("Too many requests");

    const isServerError =
      error?.response?.status >= 500 && error?.response?.status < 600;

    // Only retry server errors (5xx), NOT rate limit errors (429)
    // This prevents amplifying rate limits (1 error -> 4 total requests)
    const shouldRetry = isServerError && retryCount < MAX_RETRIES;

    if (shouldRetry) {
      const delay = getRetryDelay(retryCount);
      // Only log non-429 errors to avoid console noise for rate limits (gracefully handled in UI)
      if (!isRateLimitError) {
        console.warn(
          `GraphQL request failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms...`,
          {
            error: error?.message,
            status: error?.response?.status,
          },
        );
      }
      await sleep(delay);
      // Note: We don't release the slot here as the retry will acquire a new one
      releaseRequestSlot();
      return requestWithRetry<T>(query, variables, retryCount + 1);
    }

    // If we've exhausted retries or it's not a retryable error, throw
    throw error;
  } finally {
    // Always release the request slot when done
    releaseRequestSlot();
  }
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

export interface Transaction {
  id: string;
  type: string;
  market: {
    id: string;
    collateralToken: { symbol: string; decimals: number };
    borrowToken: { symbol: string; decimals: number };
  };
  user: {
    id: string;
  };
  amount: string;
  amountUSD: string;
  timestamp: string;
  transactionHash: string;
  blockNumber: string;
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

const USER_TRANSACTIONS_QUERY = gql`
  query UserTransactions($userAddress: String!, $first: Int = 100) {
    transactions(
      where: { user: $userAddress }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      type
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
      user {
        id
      }
      amount
      amountUSD
      timestamp
      transactionHash
      blockNumber
    }
  }
`;

/**
 * Query Functions
 */

export async function getLiquidatablePositions(
  first = 50,
): Promise<{ positions: LiquidatablePosition[] }> {
  return requestWithRetry(LIQUIDATABLE_POSITIONS_QUERY, { first });
}

export async function getActiveAuctions(
  first = 20,
): Promise<{ auctions: ActiveAuction[] }> {
  return requestWithRetry(ACTIVE_AUCTIONS_QUERY, { first });
}

export async function getLiquidationHistory(
  first = 50,
  skip = 0,
): Promise<{ liquidations: Liquidation[] }> {
  return requestWithRetry(LIQUIDATION_HISTORY_QUERY, { first, skip });
}

export async function getUserLiquidations(
  userAddress: string,
): Promise<{ liquidations: Liquidation[] }> {
  return requestWithRetry(USER_LIQUIDATIONS_QUERY, { userAddress });
}

export async function getMarkets(): Promise<{ markets: Market[] }> {
  return requestWithRetry(MARKETS_QUERY);
}

export async function getUserPositions(
  userAddress: string,
): Promise<{ positions: Position[] }> {
  return requestWithRetry(USER_POSITIONS_QUERY, { userAddress });
}

export async function getUserTransactions(
  userAddress: string,
  first = 100,
): Promise<{ transactions: Transaction[] }> {
  return requestWithRetry(USER_TRANSACTIONS_QUERY, {
    userAddress,
    first,
  });
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
