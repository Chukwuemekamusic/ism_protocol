# Phase 4: Implementation Plan

## Liquidation Bot (TypeScript) — Weeks 7-8

**Goal**: Build a production-grade off-chain liquidation bot that monitors all isolated markets, detects underwater positions, starts Dutch auctions, and executes profitable liquidations on Base Sepolia.

**End State**: A running TypeScript bot that autonomously finds and executes liquidation opportunities, with proper logging, error handling, and profitability calculations.

---

## Overview

```
Phase 4 Delivery
================

┌─────────────────────────────────────────────────────────────────────┐
│                        MODULES TO BUILD                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Week 7                              Week 8                         │
│  ──────                              ──────                         │
│                                                                     │
│  ┌───────────────────┐              ┌───────────────────┐          │
│  │ 1. Project Setup  │              │ 5. Execution      │          │
│  │    & Types        │              │    Engine          │          │
│  └─────────┬─────────┘              └─────────┬─────────┘          │
│            │                                  │                     │
│            ▼                                  ▼                     │
│  ┌───────────────────┐              ┌───────────────────┐          │
│  │ 2. Config &       │              │ 6. Main Loop &    │          │
│  │    ABI Loading    │              │    Orchestration   │          │
│  └─────────┬─────────┘              └─────────┬─────────┘          │
│            │                                  │                     │
│            ▼                                  ▼                     │
│  ┌───────────────────┐              ┌───────────────────┐          │
│  │ 3. Event Indexer  │              │ 7. Testing &      │          │
│  │    & Position     │              │    Simulation      │          │
│  │    Tracker        │              │    Scripts         │          │
│  └─────────┬─────────┘              └─────────┬─────────┘          │
│            │                                  │                     │
│            ▼                                  ▼                     │
│  ┌───────────────────┐              ┌───────────────────┐          │
│  │ 4. Health Monitor │              │ 8. Deployment &   │          │
│  │    & Profitability│              │    Documentation   │          │
│  │    Calculator     │              │                   │          │
│  └───────────────────┘              └───────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      LIQUIDATION BOT (TypeScript)                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐    │
│  │   Config     │───▶│   Logger     │    │   ABI Loader         │    │
│  │   (.env)     │    │ (structured) │    │ (from Foundry out/)  │    │
│  └──────────────┘    └──────────────┘    └──────────────────────┘    │
│         │                                         │                   │
│         ▼                                         ▼                   │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     Event Indexer                                │ │
│  │                                                                 │ │
│  │  Historical Sync:                                               │ │
│  │  • Scan past blocks for Borrow, Repay, DepositCollateral,     │ │
│  │    WithdrawCollateral, AuctionStarted, AuctionExecuted     │ │
│  │                                                                 │ │
│  │  Live Subscription:                                             │ │
│  │  • WebSocket event listeners for real-time updates             │ │
│  │  • MarketRegistry.MarketCreated for new markets                │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Position Store (In-Memory)                    │ │
│  │                                                                 │ │
│  │  Map<marketAddress, Map<userAddress, Position>>                 │ │
│  │                                                                 │ │
│  │  Position {                                                     │ │
│  │    user, market, collateralAmount, borrowShares,               │ │
│  │    healthFactor, liquidationPrice, lastUpdated                 │ │
│  │  }                                                             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                   Health Monitor                                 │ │
│  │                                                                 │ │
│  │  Every polling interval:                                        │ │
│  │  1. Fetch latest prices from OracleRouter                      │ │
│  │  2. Recalculate health factors for positions with HF < 1.1     │ │
│  │  3. Identify liquidatable positions (HF < 1.0)                 │ │
│  │  4. Check for active auctions nearing profitability             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                  Profitability Calculator                        │ │
│  │                                                                 │ │
│  │  For each opportunity:                                          │ │
│  │  • startAuction profit = collateral bonus - gas cost            │ │
│  │  • liquidate profit = (oraclePrice - auctionPrice) × amount    │ │
│  │    - gas cost                                                   │ │
│  │  • Only execute if profit > minProfitUsd ($5)                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Execution Engine                              │ │
│  │                                                                 │ │
│  │  1. Simulate tx with eth_call (staticCall)                     │ │
│  │  2. Estimate gas + apply multiplier (1.2x)                     │ │
│  │  3. Check gas price < maxGasPrice                              │ │
│  │  4. Submit transaction                                          │ │
│  │  5. Wait for confirmation                                       │ │
│  │  6. Log result (profit/loss, gas used, block number)           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Final Directory Structure

```
liquidation-bot/
├── package.json
├── tsconfig.json
├── .env.example
├── .env                        # (gitignored)
├── .gitignore
├── README.md
│
├── src/
│   ├── index.ts                # Entry point & main loop
│   ├── config.ts               # Environment config loading & validation
│   ├── logger.ts               # Structured logger (winston or pino)
│   ├── types.ts                # All TypeScript interfaces & types
│   │
│   ├── contracts/
│   │   ├── abis.ts             # ABI constants (from Foundry artifacts)
│   │   └── addresses.ts        # Contract address constants per network
│   │
│   ├── indexer/
│   │   ├── eventIndexer.ts     # Historical event scanning
│   │   └── eventListener.ts    # Real-time WebSocket event subscription
│   │
│   ├── state/
│   │   ├── positionStore.ts    # In-memory position tracking
│   │   └── auctionStore.ts     # In-memory active auction tracking
│   │
│   ├── monitor/
│   │   ├── healthMonitor.ts    # Health factor recalculation
│   │   └── priceMonitor.ts     # Oracle price fetching
│   │
│   ├── strategy/
│   │   ├── calculator.ts       # Profitability calculations
│   │   └── opportunities.ts    # Opportunity detection (start auction + liquidate)
│   │
│   └── executor/
│       ├── executor.ts         # Transaction submission & confirmation
│       └── simulator.ts        # eth_call simulation before execution
│
├── scripts/
│   ├── setup-testnet.ts        # Create underwater positions for testing
│   └── check-positions.ts      # Debug script to view all tracked positions
│
└── test/
    ├── calculator.test.ts      # Unit tests for profitability math
    └── positionStore.test.ts   # Unit tests for position tracking
```

---

## Step-by-Step Implementation

---

### Step 1: Project Setup & Types

**Time Estimate**: 3-4 hours

#### 1.1 Initialize Project

```bash
mkdir liquidation-bot
cd liquidation-bot
npm init -y
npm install ethers@6 dotenv winston
npm install -D typescript @types/node tsx vitest
npx tsc --init
```

#### 1.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

#### 1.3 Types (src/types.ts)

Define all core types the bot will use:

```typescript
// ============================================
// POSITION & MARKET TYPES
// ============================================

export interface Position {
  user: string; // User address
  market: string; // LendingPool address
  collateralAmount: bigint; // Raw collateral amount
  borrowShares: bigint; // Borrow shares (not assets)
  lastUpdated: number; // Block number of last update
}

export interface MarketInfo {
  pool: string; // LendingPool address
  collateralToken: string; // Collateral token address
  borrowToken: string; // Borrow token address
  collateralDecimals: number;
  borrowDecimals: number;
  ltv: bigint;
  liquidationThreshold: bigint;
  liquidationPenalty: bigint;
  borrowIndex: bigint; // Current borrow index
}

// ============================================
// AUCTION TYPES
// ============================================

export interface Auction {
  auctionId: bigint;
  user: string;
  pool: string;
  debtToRepay: bigint;
  collateralForSale: bigint;
  startTime: number;
  endTime: number;
  startPrice: bigint;
  endPrice: bigint;
  isActive: boolean;
}

// ============================================
// OPPORTUNITY TYPES
// ============================================

export enum OpportunityType {
  START_AUCTION = "START_AUCTION", // Position is liquidatable, no auction yet
  LIQUIDATE = "LIQUIDATE", // Active auction at profitable price
}

export interface Opportunity {
  type: OpportunityType;
  market: string;
  user: string;
  auctionId?: bigint; // Only for LIQUIDATE type
  estimatedProfitUsd: number;
  collateralAmount: bigint;
  debtAmount: bigint;
  currentPrice?: bigint; // Current auction price (LIQUIDATE only)
  healthFactor?: bigint; // Current HF (START_AUCTION only)
}

// ============================================
// PRICE TYPES
// ============================================

export interface PriceData {
  token: string;
  price: bigint; // WAD (1e18) scaled
  decimals: number;
  timestamp: number;
}

// ============================================
// CONFIG
// ============================================

export interface BotConfig {
  // Network
  rpcUrl: string;
  wsUrl: string; // WebSocket for event subscription
  chainId: number;

  // Wallet
  privateKey: string;

  // Contracts
  marketRegistry: string;
  oracleRouter: string;
  liquidator: string;
  markets: string[]; // Can be auto-discovered from registry

  // Execution parameters
  minProfitUsd: number; // Minimum profit to execute ($5)
  maxGasPrice: bigint; // Max gas price (in wei)
  gasMultiplier: number; // Gas estimate multiplier (1.2)

  // Monitoring
  pollingIntervalMs: number; // Block polling interval (2000ms)
  healthFactorThreshold: bigint; // Start watching when HF < this (1.1e18)
  historicalBlockRange: number; // How far back to scan events (10000)

  // Logging
  logLevel: "debug" | "info" | "warn" | "error";
}

// ============================================
// EXECUTION RESULT
// ============================================

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  profit?: bigint;
  error?: string;
}
```

**Deliverables**: Initialized project, all types defined, compiles cleanly.

---

### Step 2: Config & ABI Loading

**Time Estimate**: 2-3 hours

#### 2.1 Config Loader (src/config.ts)

```typescript
import { config as dotenvConfig } from "dotenv";
import { BotConfig } from "./types.js";

dotenvConfig();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export function loadConfig(): BotConfig {
  return {
    rpcUrl: requireEnv("RPC_URL"),
    wsUrl: requireEnv("WS_URL"),
    chainId: parseInt(requireEnv("CHAIN_ID")),
    privateKey: requireEnv("PRIVATE_KEY"),

    marketRegistry: requireEnv("MARKET_REGISTRY_ADDRESS"),
    oracleRouter: requireEnv("ORACLE_ROUTER_ADDRESS"),
    liquidator: requireEnv("LIQUIDATOR_ADDRESS"),
    markets: [], // Auto-discovered from registry on startup

    minProfitUsd: parseFloat(process.env.MIN_PROFIT_USD ?? "5"),
    maxGasPrice: BigInt(process.env.MAX_GAS_PRICE ?? "50000000000"), // 50 gwei
    gasMultiplier: parseFloat(process.env.GAS_MULTIPLIER ?? "1.2"),

    pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS ?? "2000"),
    healthFactorThreshold: BigInt(
      process.env.HF_THRESHOLD ?? "1100000000000000000",
    ), // 1.1e18
    historicalBlockRange: parseInt(
      process.env.HISTORICAL_BLOCK_RANGE ?? "10000",
    ),

    logLevel: (process.env.LOG_LEVEL as BotConfig["logLevel"]) ?? "info",
  };
}
```

#### 2.2 ABI Loading (src/contracts/abis.ts)

Extract ABIs from your Foundry build artifacts (`out/` directory). You'll need the ABIs for:

- `LendingPool` — positions, health factors, borrow index
- `DutchAuctionLiquidator` — startAuction, liquidate, getCurrentPrice, getAuction
- `OracleRouter` — getPrice
- `MarketRegistry` — getAllMarkets, getMarketInfo

```typescript
// Copy the relevant ABI arrays from:
//   out/LendingPool.sol/LendingPool.json
//   out/DutchAuctionLiquidator.sol/DutchAuctionLiquidator.json
//   out/OracleRouter.sol/OracleRouter.json
//   out/MarketRegistry.sol/MarketRegistry.json

export const LENDING_POOL_ABI = [
  /* ... */
] as const;
export const LIQUIDATOR_ABI = [
  /* ... */
] as const;
export const ORACLE_ROUTER_ABI = [
  /* ... */
] as const;
export const MARKET_REGISTRY_ABI = [
  /* ... */
] as const;
```

#### 2.3 Logger (src/logger.ts)

```typescript
import winston from "winston";
import { BotConfig } from "./types.js";

export function createLogger(config: BotConfig) {
  return winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
      new winston.transports.File({
        filename: "logs/bot.log",
        maxsize: 10_000_000, // 10MB
        maxFiles: 5,
      }),
    ],
  });
}
```

#### 2.4 .env.example

```bash
# Network
RPC_URL=https://sepolia.base.org
WS_URL=wss://sepolia.base.org
CHAIN_ID=84532

# Wallet (DO NOT COMMIT)
PRIVATE_KEY=your_private_key_without_0x_prefix

# Contract Addresses (fill after deployment)
MARKET_REGISTRY_ADDRESS=0x...
ORACLE_ROUTER_ADDRESS=0x...
LIQUIDATOR_ADDRESS=0x...

# Bot Parameters
MIN_PROFIT_USD=5
MAX_GAS_PRICE=50000000000
GAS_MULTIPLIER=1.2
POLLING_INTERVAL_MS=2000
HF_THRESHOLD=1100000000000000000
HISTORICAL_BLOCK_RANGE=10000
LOG_LEVEL=info
```

**Deliverables**: Config loads and validates from .env, ABIs exported, logger configured.

---

### Step 3: Event Indexer & Position Tracker

**Time Estimate**: 8-10 hours (most complex module)

This is the brain of the bot — it builds and maintains an accurate view of all positions.

#### 3.1 Position Store (src/state/positionStore.ts)

```typescript
import { Position, MarketInfo } from "../types.js";

export class PositionStore {
  // market => user => Position
  private positions: Map<string, Map<string, Position>> = new Map();

  upsert(market: string, user: string, update: Partial<Position>): void {
    /* ... */
  }
  get(market: string, user: string): Position | undefined {
    /* ... */
  }
  getAll(): Position[] {
    /* ... */
  }
  getAllForMarket(market: string): Position[] {
    /* ... */
  }
  getWithBorrows(): Position[] {
    /* all positions where borrowShares > 0 */
  }
  remove(market: string, user: string): void {
    /* ... */
  }

  // Stats
  getTotalPositions(): number {
    /* ... */
  }
  getActivePositions(): number {
    /* positions with borrowShares > 0 */
  }
}
```

#### 3.2 Auction Store (src/state/auctionStore.ts)

```typescript
import { Auction } from "../types.js";

export class AuctionStore {
  private auctions: Map<string, Auction> = new Map(); // auctionId => Auction
  private activeByUser: Map<string, string> = new Map(); // "pool:user" => auctionId

  add(auction: Auction): void {
    /* ... */
  }
  get(auctionId: bigint): Auction | undefined {
    /* ... */
  }
  getActiveForUser(pool: string, user: string): Auction | undefined {
    /* ... */
  }
  getAllActive(): Auction[] {
    /* filter isActive && not expired */
  }
  markInactive(auctionId: bigint): void {
    /* ... */
  }
  removeExpired(currentTimestamp: number): Auction[] {
    /* cleanup */
  }
}
```

#### 3.3 Historical Event Indexer (src/indexer/eventIndexer.ts)

Scans past blocks to rebuild position state on bot startup:

```typescript
export class EventIndexer {
  constructor(
    provider: ethers.JsonRpcProvider,
    positionStore: PositionStore,
    auctionStore: AuctionStore,
    logger: winston.Logger,
  ) {}

  /**
   * Scan historical events for a specific market
   * Events to track:
   * - DepositCollateral(user, amount)
   * - WithdrawCollateral(user, amount)
   * - Borrow(user, borrowShares, borrowAmount)
   * - Repay(user, repaidShares, repaidAmount)
   * - AuctionStarted(auctionId, user, pool, debtToRepay, collateral, ...)
   * - AuctionExecuted(auctionId, liquidator, debtRepaid, collateralReceived, ...)
   * - AuctionCancelled(auctionId, reason)
   */
  async indexMarket(
    marketAddress: string,
    liquidatorAddress: string,
    fromBlock: number,
  ): Promise<void> {
    /* ... */
  }

  async indexAllMarkets(
    markets: string[],
    liquidatorAddress: string,
    fromBlock: number,
  ): Promise<void> {
    /* ... */
  }
}
```

**Key implementation notes:**

- Batch `getLogs` calls in chunks of 2000 blocks to avoid RPC limits
- Process events in chronological order (sort by blockNumber, logIndex)
- For each Borrow event: increment `borrowShares`
- For each Repay event: decrement `borrowShares`
- For each DepositCollateral: increment `collateralAmount`
- For each WithdrawCollateral: decrement `collateralAmount`
- For auction events: update AuctionStore accordingly

#### 3.4 Real-Time Event Listener (src/indexer/eventListener.ts)

Subscribes to new events via WebSocket:

```typescript
export class EventListener {
  constructor(
    wsProvider: ethers.WebSocketProvider,
    positionStore: PositionStore,
    auctionStore: AuctionStore,
    logger: winston.Logger,
  ) {}

  /**
   * Subscribe to all relevant events across all markets
   * Uses WebSocket for instant updates
   */
  subscribeToMarket(marketAddress: string, liquidatorAddress: string): void {
    /* ... */
  }

  subscribeToAllMarkets(markets: string[], liquidatorAddress: string): void {
    /* ... */
  }

  /**
   * Subscribe to MarketRegistry for new market creation
   * Auto-adds new markets to monitoring
   */
  subscribeToNewMarkets(registryAddress: string): void {
    /* ... */
  }

  unsubscribeAll(): void {
    /* cleanup */
  }
}
```

**Deliverables**: Bot can start up, scan historical events, build position state, and stay updated in real-time.

---

### Step 4: Health Monitor & Profitability Calculator

**Time Estimate**: 6-8 hours

#### 4.1 Price Monitor (src/monitor/priceMonitor.ts)

Fetches latest prices from the OracleRouter:

```typescript
export class PriceMonitor {
  private prices: Map<string, PriceData> = new Map();

  constructor(oracleRouter: ethers.Contract, logger: winston.Logger) {}

  /** Fetch prices for all tokens used in active markets */
  async updatePrices(tokens: string[]): Promise<void> {
    /* ... */
  }

  getPrice(token: string): PriceData | undefined {
    /* ... */
  }

  /** Convert collateral value to USD equivalent */
  getValueUsd(token: string, amount: bigint, decimals: number): number {
    /* ... */
  }
}
```

#### 4.2 Health Monitor (src/monitor/healthMonitor.ts)

Recalculates health factors for all tracked positions:

```typescript
export class HealthMonitor {
  constructor(
    positionStore: PositionStore,
    priceMonitor: PriceMonitor,
    marketInfos: Map<string, MarketInfo>,
    logger: winston.Logger,
  ) {}

  /**
   * Recalculate health factors for all positions with borrows.
   *
   * healthFactor = (collateralValue × liquidationThreshold) / debtValue
   *
   * Where:
   *   collateralValue = collateralAmount × collateralPrice / 10^collateralDecimals
   *   debtValue = (borrowShares × borrowIndex / 1e18) × borrowPrice / 10^borrowDecimals
   *
   * Returns positions grouped by urgency:
   *   - liquidatable: HF < 1.0e18
   *   - atRisk: HF < healthFactorThreshold (1.1e18)
   */
  async evaluate(): Promise<{
    liquidatable: Position[];
    atRisk: Position[];
  }> {
    /* ... */
  }

  /**
   * Calculate health factor for a single position
   * Reads borrowIndex fresh from the contract for accuracy
   */
  async calculateHealthFactor(
    position: Position,
    market: MarketInfo,
  ): Promise<bigint> {
    /* ... */
  }
}
```

**Important**: Before calculating, fetch the latest `borrowIndex` from each LendingPool contract, since interest accrues continuously and the stored `borrowShares` convert to actual debt via `borrowShares * borrowIndex / 1e18`.

#### 4.3 Profitability Calculator (src/strategy/calculator.ts)

```typescript
export class ProfitabilityCalculator {
  constructor(
    private config: BotConfig,
    private priceMonitor: PriceMonitor,
    private logger: winston.Logger,
  ) {}

  /**
   * Calculate profit for starting an auction
   *
   * Starting an auction doesn't directly profit the caller,
   * but the bot needs to start auctions to later liquidate.
   * We still check that gas cost is reasonable.
   */
  calculateStartAuctionProfit(
    position: Position,
    market: MarketInfo,
    gasPrice: bigint,
  ): { profitable: boolean; estimatedGasCost: number } {
    /* ... */
  }

  /**
   * Calculate profit for executing a liquidation
   *
   * profit = collateralReceived × oraclePrice
   *        - debtRepaid × borrowPrice
   *        - gasCost
   *
   * The Dutch auction gives collateral at a discount:
   *   At auction start (t=0): price = 105% of oracle (UNPROFITABLE)
   *   At midpoint:           price ≈ 100% of oracle (BREAKEVEN)
   *   Near end:              price = 95% of oracle (5% PROFIT)
   *
   * Sweet spot: Wait until auctionPrice < oraclePrice - gasCost
   */
  calculateLiquidationProfit(
    auction: Auction,
    market: MarketInfo,
    currentAuctionPrice: bigint,
    gasPrice: bigint,
  ): { profitable: boolean; estimatedProfitUsd: number } {
    /* ... */
  }
}
```

#### 4.4 Opportunity Detector (src/strategy/opportunities.ts)

Combines health monitoring + auction tracking to find actionable opportunities:

```typescript
export class OpportunityDetector {
  constructor(
    private healthMonitor: HealthMonitor,
    private auctionStore: AuctionStore,
    private calculator: ProfitabilityCalculator,
    private liquidatorContract: ethers.Contract,
    private logger: winston.Logger,
  ) {}

  /**
   * Scan for all opportunities:
   * 1. Positions with HF < 1.0 and NO active auction → START_AUCTION
   * 2. Active auctions at profitable price → LIQUIDATE
   */
  async findOpportunities(gasPrice: bigint): Promise<Opportunity[]> {
    /* ... */
  }
}
```

**Deliverables**: Bot can evaluate all positions, detect opportunities, and calculate expected profit.

---

### Step 5: Execution Engine

**Time Estimate**: 5-6 hours

#### 5.1 Transaction Simulator (src/executor/simulator.ts)

Always simulate before sending real transactions:

```typescript
export class TransactionSimulator {
  constructor(
    private provider: ethers.JsonRpcProvider,
    private logger: winston.Logger,
  ) {}

  /**
   * Simulate startAuction call
   * Returns true if it would succeed, false if it reverts
   */
  async simulateStartAuction(
    liquidatorContract: ethers.Contract,
    pool: string,
    user: string,
  ): Promise<{ success: boolean; error?: string; auctionId?: bigint }> {
    try {
      const result = await liquidatorContract.startAuction.staticCall(
        pool,
        user,
      );
      return { success: true, auctionId: result };
    } catch (error: any) {
      return { success: false, error: error.reason ?? error.message };
    }
  }

  /**
   * Simulate liquidate call
   * Returns expected amounts if it would succeed
   */
  async simulateLiquidate(
    liquidatorContract: ethers.Contract,
    auctionId: bigint,
    maxDebtToRepay: bigint,
  ): Promise<{
    success: boolean;
    error?: string;
    debtRepaid?: bigint;
    collateralReceived?: bigint;
  }> {
    try {
      const [debtRepaid, collateralReceived] =
        await liquidatorContract.liquidate.staticCall(
          auctionId,
          maxDebtToRepay,
        );
      return { success: true, debtRepaid, collateralReceived };
    } catch (error: any) {
      return { success: false, error: error.reason ?? error.message };
    }
  }
}
```

#### 5.2 Executor (src/executor/executor.ts)

Handles the actual transaction submission:

```typescript
export class Executor {
  private pendingTxs: Set<string> = new Set(); // Track in-flight txs
  private nonce: number = 0;

  constructor(
    private wallet: ethers.Wallet,
    private liquidatorContract: ethers.Contract,
    private simulator: TransactionSimulator,
    private config: BotConfig,
    private logger: winston.Logger,
  ) {}

  async initialize(): Promise<void> {
    this.nonce = await this.wallet.getNonce();
  }

  /**
   * Execute a startAuction transaction
   */
  async executeStartAuction(opp: Opportunity): Promise<ExecutionResult> {
    // 1. Simulate
    const sim = await this.simulator.simulateStartAuction(
      this.liquidatorContract,
      opp.market,
      opp.user,
    );
    if (!sim.success) {
      return { success: false, error: `Simulation failed: ${sim.error}` };
    }

    // 2. Estimate gas
    const gasEstimate = await this.liquidatorContract.startAuction.estimateGas(
      opp.market,
      opp.user,
    );
    const gasLimit = BigInt(
      Math.ceil(Number(gasEstimate) * this.config.gasMultiplier),
    );

    // 3. Check gas price
    const feeData = await this.wallet.provider!.getFeeData();
    if (
      feeData.maxFeePerGas &&
      feeData.maxFeePerGas > this.config.maxGasPrice
    ) {
      return { success: false, error: "Gas price too high" };
    }

    // 4. Submit
    try {
      const tx = await this.liquidatorContract.startAuction(
        opp.market,
        opp.user,
        {
          gasLimit,
          nonce: this.nonce++,
        },
      );

      this.logger.info(`startAuction tx submitted: ${tx.hash}`);
      this.pendingTxs.add(tx.hash);

      const receipt = await tx.wait();
      this.pendingTxs.delete(tx.hash);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      };
    } catch (error: any) {
      this.nonce = await this.wallet.getNonce(); // Reset nonce on failure
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a liquidate transaction
   * Needs borrow token approval to the Liquidator contract
   */
  async executeLiquidate(opp: Opportunity): Promise<ExecutionResult> {
    // Similar pattern: simulate → estimate gas → check price → submit
    // Additionally: ensure sufficient borrow token balance + approval
  }

  hasPendingTransactions(): boolean {
    return this.pendingTxs.size > 0;
  }
}
```

**Key considerations:**

- **Nonce management**: Track nonce locally to avoid conflicts
- **Token approval**: The bot wallet needs to approve the Liquidator contract to spend borrow tokens (USDC). Do this once on startup.
- **Balance checks**: Verify the bot has enough borrow tokens to execute liquidations
- **Retry logic**: If a tx fails, reset nonce from chain and retry once

**Deliverables**: Bot can simulate and execute both `startAuction` and `liquidate` transactions safely.

---

### Step 6: Main Loop & Orchestration

**Time Estimate**: 4-5 hours

#### 6.1 Main Entry Point (src/index.ts)

Ties everything together:

```typescript
async function main() {
  // 1. Load config
  const config = loadConfig();
  const logger = createLogger(config);
  logger.info("🤖 Liquidation Bot starting...");

  // 2. Setup providers & wallet
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wsProvider = new ethers.WebSocketProvider(config.wsUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  logger.info(`Bot wallet: ${wallet.address}`);

  // 3. Initialize contracts
  const registryContract = new ethers.Contract(
    config.marketRegistry,
    MARKET_REGISTRY_ABI,
    provider,
  );
  const oracleContract = new ethers.Contract(
    config.oracleRouter,
    ORACLE_ROUTER_ABI,
    provider,
  );
  const liquidatorContract = new ethers.Contract(
    config.liquidator,
    LIQUIDATOR_ABI,
    wallet,
  );

  // 4. Discover markets from registry
  const markets = await discoverMarkets(registryContract, provider);
  logger.info(`Discovered ${markets.size} markets`);

  // 5. Initialize stores
  const positionStore = new PositionStore();
  const auctionStore = new AuctionStore();

  // 6. Index historical events
  const indexer = new EventIndexer(
    provider,
    positionStore,
    auctionStore,
    logger,
  );
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - config.historicalBlockRange;
  await indexer.indexAllMarkets(
    [...markets.keys()],
    config.liquidator,
    fromBlock,
  );
  logger.info(`Indexed ${positionStore.getActivePositions()} active positions`);

  // 7. Subscribe to live events
  const listener = new EventListener(
    wsProvider,
    positionStore,
    auctionStore,
    logger,
  );
  listener.subscribeToAllMarkets([...markets.keys()], config.liquidator);
  listener.subscribeToNewMarkets(config.marketRegistry);

  // 8. Initialize execution components
  const priceMonitor = new PriceMonitor(oracleContract, logger);
  const healthMonitor = new HealthMonitor(
    positionStore,
    priceMonitor,
    markets,
    logger,
  );
  const calculator = new ProfitabilityCalculator(config, priceMonitor, logger);
  const opportunityDetector = new OpportunityDetector(
    healthMonitor,
    auctionStore,
    calculator,
    liquidatorContract,
    logger,
  );
  const simulator = new TransactionSimulator(provider, logger);
  const executor = new Executor(
    wallet,
    liquidatorContract,
    simulator,
    config,
    logger,
  );
  await executor.initialize();

  // 9. Ensure token approvals
  await ensureTokenApprovals(wallet, markets, config.liquidator, logger);

  // 10. Main loop
  logger.info("🚀 Bot running. Monitoring positions...");

  while (true) {
    try {
      // Update prices
      const tokens = getUniqueTokens(markets);
      await priceMonitor.updatePrices(tokens);

      // Get gas price
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;

      // Clean up expired auctions
      const now = Math.floor(Date.now() / 1000);
      auctionStore.removeExpired(now);

      // Find opportunities
      const opportunities =
        await opportunityDetector.findOpportunities(gasPrice);

      if (opportunities.length > 0) {
        logger.info(`Found ${opportunities.length} opportunities`);

        // Sort by profit (highest first)
        opportunities.sort(
          (a, b) => b.estimatedProfitUsd - a.estimatedProfitUsd,
        );

        // Execute sequentially (avoid nonce conflicts)
        for (const opp of opportunities) {
          if (executor.hasPendingTransactions()) break; // One at a time

          const result =
            opp.type === OpportunityType.START_AUCTION
              ? await executor.executeStartAuction(opp)
              : await executor.executeLiquidate(opp);

          if (result.success) {
            logger.info(`✅ ${opp.type} executed`, {
              txHash: result.txHash,
              gasUsed: result.gasUsed?.toString(),
              market: opp.market,
              user: opp.user,
            });
          } else {
            logger.warn(`❌ ${opp.type} failed: ${result.error}`);
          }
        }
      }

      // Log stats periodically
      logStats(positionStore, auctionStore, logger);

      await sleep(config.pollingIntervalMs);
    } catch (error) {
      logger.error("Main loop error:", error);
      await sleep(config.pollingIntervalMs * 2); // Back off on error
    }
  }
}

main().catch(console.error);
```

**Deliverables**: Fully orchestrated bot that runs in a loop.

---

### Step 7: Testing & Simulation Scripts

**Time Estimate**: 6-8 hours

#### 7.1 Unit Tests

```
test/
├── calculator.test.ts      # Profitability math edge cases
├── positionStore.test.ts   # Store CRUD operations
├── auctionStore.test.ts    # Auction lifecycle
└── healthMonitor.test.ts   # HF calculations match contract
```

Key test scenarios:

- Profitability calculation with various gas prices
- Position store handles duplicate events gracefully
- Auction expiry detection
- Health factor matches contract's `healthFactor()` output

#### 7.2 Testnet Setup Script (scripts/setup-testnet.ts)

Creates underwater positions on Base Sepolia for the bot to liquidate:

```typescript
/**
 * Setup script that creates test scenarios:
 *
 * 1. Deploy mock price feed (if needed)
 * 2. Mint test tokens to bot wallet
 * 3. Create a healthy position (Alice)
 * 4. Create a position near liquidation (Bob)
 * 5. Drop oracle price to make Bob's position underwater
 * 6. Verify bot detects and liquidates
 */
async function setupTestScenario() {
  // Alice: supplier (deposits USDC)
  // Bob: borrower (deposits ETH collateral, borrows USDC)
  // Bot: liquidator (has USDC to repay debt, earns collateral at discount)
  // Step 1: Alice deposits 100,000 USDC as supply
  // Step 2: Bob deposits 50 ETH, borrows 70,000 USDC (near max LTV)
  // Step 3: Update mock oracle to drop ETH price 15%
  //         → Bob's HF drops below 1.0
  // Step 4: Bot should detect and start auction + liquidate
}
```

#### 7.3 Debug Script (scripts/check-positions.ts)

Quick script to inspect bot state:

```typescript
/**
 * Connects to the same contracts and displays:
 * - All tracked positions with health factors
 * - Active auctions with current prices
 * - Bot wallet balance
 * - Oracle prices
 */
```

**Deliverables**: Unit tests passing, testnet script can create liquidatable scenarios, debug tooling.

---

### Step 8: Deployment & Documentation

**Time Estimate**: 3-4 hours

#### 8.1 Running the Bot

```bash
# Development (with hot reload)
npx tsx watch src/index.ts

# Production
npx tsc
node dist/index.js

# With PM2 (process manager)
pm2 start dist/index.js --name liquidation-bot
```

#### 8.2 README.md

Document:

- Setup instructions
- Environment variables
- How to run against local Anvil vs Base Sepolia
- How to fund the bot wallet
- How to create test scenarios
- Monitoring & logs
- Architecture overview

#### 8.3 Monitoring Checklist

| What to Monitor       | How                                         |
| --------------------- | ------------------------------------------- |
| Bot uptime            | PM2 or systemd                              |
| Wallet balance        | Log on each loop iteration                  |
| Gas price spikes      | Log when skipping due to gas                |
| Missed liquidations   | Compare on-chain auctions vs bot detections |
| RPC errors            | Winston error logs                          |
| WebSocket disconnects | Auto-reconnect with backoff                 |

**Deliverables**: Bot deployed and running on Base Sepolia, documentation complete.

---

## Checklist

### Week 7

- [ ] Project initialized (npm, TypeScript, dependencies)
- [ ] `types.ts` — all interfaces defined
- [ ] `config.ts` — env loading & validation
- [ ] `logger.ts` — structured logging
- [ ] `contracts/abis.ts` — ABIs from Foundry artifacts
- [ ] `state/positionStore.ts` — in-memory position tracking
- [ ] `state/auctionStore.ts` — in-memory auction tracking
- [ ] `indexer/eventIndexer.ts` — historical block scanning
- [ ] `indexer/eventListener.ts` — WebSocket event subscription
- [ ] `monitor/priceMonitor.ts` — oracle price fetching
- [ ] `monitor/healthMonitor.ts` — health factor recalculation
- [ ] `strategy/calculator.ts` — profitability math
- [ ] `strategy/opportunities.ts` — opportunity detection

### Week 8

- [ ] `executor/simulator.ts` — tx simulation (staticCall)
- [ ] `executor/executor.ts` — tx submission & confirmation
- [ ] `index.ts` — main loop orchestration
- [ ] Token approval logic on startup
- [ ] Market auto-discovery from registry
- [ ] Unit tests for calculator, stores, health monitor
- [ ] `scripts/setup-testnet.ts` — create liquidatable positions
- [ ] `scripts/check-positions.ts` — debug position viewer
- [ ] Test full flow: detect → start auction → wait → liquidate
- [ ] README.md documentation
- [ ] WebSocket reconnection handling
- [ ] Graceful shutdown (SIGINT/SIGTERM)

---

## Success Metrics

| Metric                                     | Target |
| ------------------------------------------ | ------ |
| Bot starts and indexes positions           | ✅     |
| Detects underwater positions correctly     | ✅     |
| Starts auctions for liquidatable positions | ✅     |
| Executes liquidations at profitable price  | ✅     |
| Profitability calculation matches reality  | ✅     |
| Handles RPC errors gracefully              | ✅     |
| WebSocket reconnects on disconnect         | ✅     |
| Unit tests passing                         | ✅     |
| Full flow test on Base Sepolia             | ✅     |
| Documentation complete                     | ✅     |

---

## Key Implementation Notes

1. **ethers v6**: We're using ethers v6 — syntax differs from v5 (e.g., `Contract` constructor, `staticCall` instead of `callStatic`).

2. **BigInt everywhere**: Prices, amounts, and health factors are all `bigint`. Avoid `Number` for on-chain values to prevent precision loss.

3. **borrowIndex is critical**: The on-chain `borrowShares` don't represent actual debt — you must multiply by `borrowIndex` (which accrues interest). Always fetch the latest `borrowIndex` from the contract before calculating HF.

4. **Dutch auction timing**: The bot shouldn't rush to liquidate at auction start (105% premium = loss). Wait until price decays below oracle price minus gas cost.

5. **Nonce management**: When transactions fail, the nonce can get desynced. Always reset from chain on error.

6. **Token approvals**: The bot wallet needs to approve the `DutchAuctionLiquidator` contract to spend borrow tokens (e.g., USDC). Set `type(uint256).max` approval once on startup.

7. **Base Sepolia RPC**: The free Base Sepolia RPC can be rate-limited. Consider using Alchemy or QuickNode for reliability. WebSocket support varies by provider.

8. **Graceful shutdown**: Handle `SIGINT`/`SIGTERM` to unsubscribe WebSocket listeners and avoid dangling connections.

---

## Dependencies

| Package    | Purpose                                              |
| ---------- | ---------------------------------------------------- |
| `ethers@6` | Blockchain interaction (provider, wallet, contracts) |
| `dotenv`   | Environment variable loading                         |
| `winston`  | Structured logging                                   |
| `tsx`      | TypeScript execution (dev)                           |
| `vitest`   | Unit testing                                         |

Intentionally minimal — no framework overhead, just ethers + utilities.

---

## What Comes After

Once the liquidation bot is working on Base Sepolia, potential extensions:

1. **Flash loan liquidations** — Use Aave/Uniswap flash loans to liquidate without needing upfront capital
2. **Multi-block MEV** — Optimize for L2 block timing
3. **Dashboard** — Simple web UI showing bot performance, positions, and P&L
4. **Telegram/Discord alerts** — Notify on liquidations, errors, or low balance
5. **Multi-market strategy** — Prioritize markets by TVL or profitability
