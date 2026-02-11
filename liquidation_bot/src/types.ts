// ============================================
// POSITION & MARKET TYPES
// ============================================

export interface Position {
  /** User wallet address */
  user: string;
  /** LendingPool address this position belongs to */
  market: string;
  /** Raw collateral amount (in collateral token decimals) */
  collateralAmount: bigint;
  /** Borrow shares — multiply by borrowIndex to get actual debt */
  borrowShares: bigint;
  /** Block number when this position was last updated */
  lastUpdated: number;
}

export interface MarketInfo {
  /** LendingPool (clone) address */
  pool: string;
  /** Collateral token address */
  collateralToken: string;
  /** Borrow token address */
  borrowToken: string;
  /** Collateral token decimals (cached) */
  collateralDecimals: number;
  /** Borrow token decimals (cached) */
  borrowDecimals: number;
  /** Loan-to-value ratio (WAD scaled, e.g. 0.75e18 = 75%) */
  ltv: bigint;
  /** Liquidation threshold (WAD scaled, e.g. 0.80e18 = 80%) */
  liquidationThreshold: bigint;
  /** Liquidation penalty (WAD scaled, e.g. 0.05e18 = 5%) */
  liquidationPenalty: bigint;
  /** PoolToken address (ERC20 receipt token for suppliers) */
  poolToken: string;
  // borrowIndex: bigint;       // Current borrow index
}

// ============================================
// AUCTION TYPES
// ============================================

export interface Auction {
  /** Unique auction ID from the DutchAuctionLiquidator */
  auctionId: bigint;
  /** User whose position is being liquidated */
  user: string;
  /** LendingPool address */
  pool: string;
  /** Debt amount to repay (in borrow token) */
  debtToRepay: bigint;
  /** Collateral locked for this auction */
  collateralForSale: bigint;
  /** Unix timestamp when auction started */
  startTime: number;
  /** Unix timestamp when auction expires */
  endTime: number;
  /** Starting price per unit of collateral (above oracle — unprofitable) */
  startPrice: bigint;
  /** Ending price per unit of collateral (below oracle — profitable) */
  endPrice: bigint;
  /** Whether the auction is still active */
  isActive: boolean;
}

// ============================================
// OPPORTUNITY TYPES
// ============================================

export enum OpportunityType {
  /** Position is liquidatable but has no active auction — we should start one */
  START_AUCTION = "START_AUCTION",
  /** Active auction has decayed to a profitable price — we should liquidate */
  LIQUIDATE = "LIQUIDATE",
}

export interface Opportunity {
  /** Type of action to take */
  type: OpportunityType;
  /** LendingPool address */
  market: string;
  /** User address */
  user: string;
  /** Auction ID (only for LIQUIDATE) */
  auctionId?: bigint;
  /** Estimated profit in USD */
  estimatedProfitUsd: number;
  /** Collateral amount involved */
  collateralAmount: bigint;
  /** Debt amount involved */
  debtAmount: bigint;
  /** Current Dutch auction price (only for LIQUIDATE) */
  currentPrice?: bigint;
  /** Current health factor (only for START_AUCTION) */
  healthFactor?: bigint;
}

// ============================================
// PRICE TYPES
// ============================================

export interface PriceData {
  /** Token address */
  token: string;
  /** Price in USD, WAD scaled (1e18) */
  price: bigint;
  /** Token decimals */
  decimals: number;
  /** Unix timestamp of price reading */
  timestamp: number;
}

// ============================================
// CONFIG
// ============================================

export interface BotConfig {
  // -- Network --
  /** HTTP RPC URL (for reads + tx submission) */
  rpcUrl: string;
  /** WebSocket URL (for event subscriptions) */
  wsUrl: string;
  /** Chain ID (84532 for Base Sepolia) */
  chainId: number;

  // -- Wallet --
  /** Private key for signing transactions (no 0x prefix) */
  privateKey: string;

  // -- Contracts --
  /** MarketRegistry address — used to discover all markets */
  marketRegistry: string;
  /** OracleRouter address — used to fetch prices */
  oracleRouter: string;
  /** DutchAuctionLiquidator address — used to start/execute liquidations */
  liquidator: string;

  // -- Execution Parameters --
  /** Minimum profit in USD to execute a liquidation (default: $5) */
  minProfitUsd: number;
  /** Maximum gas price in wei the bot will pay (default: 50 gwei) */
  maxGasPrice: bigint;
  /** Multiplier applied to gas estimates for safety (default: 1.2) */
  gasMultiplier: number;

  // -- Monitoring --
  /** Milliseconds between each monitoring cycle (default: 2000) */
  pollingIntervalMs: number;
  /** Health factor below which positions get closely watched (default: 1.1e18) */
  healthFactorThreshold: bigint;
  /** How many blocks back to scan for historical events on startup (default: 10000) */
  historicalBlockRange: number;

  // -- Logging --
  /** Log level (default: "info") */
  logLevel: "debug" | "info" | "warn" | "error";
}

// ============================================
// EXECUTION RESULT
// ============================================

export interface ExecutionResult {
  /** Whether the transaction succeeded */
  success: boolean;
  /** Transaction hash (if submitted) */
  txHash?: string;
  /** Block number of confirmation */
  blockNumber?: number;
  /** Gas used by the transaction */
  gasUsed?: bigint;
  /** Actual profit realized (if calculable) */
  profit?: bigint;
  /** Error message (if failed) */
  error?: string;
}

// ============================================
// CONSTANTS
// ============================================

/** 1e18 — WAD precision used across the protocol */
export const WAD = 10n ** 18n;

/** Auction duration in seconds (20 minutes) */
export const AUCTION_DURATION = 20 * 60;

/** Maximum uint256 — used for token approvals */
export const MAX_UINT256 = 2n ** 256n - 1n;
