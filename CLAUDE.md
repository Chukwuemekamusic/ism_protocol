# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ISM Protocol** is an isolated lending protocol built on Base. It enables users to supply assets to earn interest, borrow against collateral, and participate in MEV-resistant Dutch auction liquidations. Each collateral/borrow pair operates as an independent market to prevent contagion between assets.

**Tech Stack**: Solidity 0.8.24, Foundry, Base L2, TypeScript (Bot)

## Monorepo Structure

This is a **monorepo** with two main workspaces:

```
ism_protocol/                  # Root directory
├── contracts/                 # Foundry smart contracts workspace
│   ├── src/                   # Solidity contracts
│   ├── test/                  # Contract tests
│   ├── script/                # Deployment scripts
│   ├── foundry.toml          # Foundry configuration
│   └── README.md             # Contracts documentation
├── liquidation_bot/          # TypeScript liquidation bot workspace
│   ├── src/                  # Bot source code
│   ├── package.json          # Node dependencies
│   └── tsconfig.json         # TypeScript config
├── deployments/              # Shared deployment addresses (used by both)
├── docs/                     # Shared documentation
└── CLAUDE.md                 # This file
```

**Important**: When working with **contracts**, always `cd contracts/` first. When working with the **bot**, always `cd liquidation_bot/` first.

## Common Workflows

### Working with Smart Contracts Only
```bash
cd contracts
forge build
forge test
# Make changes to contracts
forge test -vvv
```

### Working with Bot Only
```bash
cd liquidation_bot
npm install
# Make changes to bot code
npm run dev
```

### Full Stack Development (Contracts + Bot)
When you change contracts that affect the bot:

```bash
# 1. Update contracts
cd contracts
# Edit contract files
forge build

# 2. Update deployment (if needed)
forge script script/DeployCore.s.sol --rpc-url <RPC> --broadcast
# This writes to ../deployments/{chainId}.json

# 3. Update bot ABIs (manual step - copy ABIs from contracts/out/ to bot)
cd ../liquidation_bot
# Update src/contracts/ with new ABIs if interfaces changed

# 4. Test bot with new contracts
npm run dev
```

### Verifying Deployment Integration
```bash
# From root directory
cat deployments/84532.json  # Check deployed addresses

# Verify bot reads correct addresses
cd liquidation_bot
# Check config.ts loads from ../deployments/

# Verify contracts compile
cd ../contracts
forge build
```

## Quick Development Commands

### Smart Contracts (contracts/)

**All contract commands must be run from the `contracts/` directory.**

```bash
# Navigate to contracts workspace
cd contracts

# Build contracts
forge build

# Run all tests
forge test

# Run tests with verbosity (useful for debugging)
forge test -vvv

# Run specific test file
forge test --match-path test/unit/LendingPool.t.sol

# Run specific test function
forge test --match-test test_deposit_should_increase_balance

# Run with gas report
forge test --gas-report

# Run coverage analysis
forge coverage
```

#### Test Categories
```bash
# (From contracts/ directory)

# Unit tests (component isolation)
forge test --match-path test/unit/

# Integration tests (multi-component flows)
forge test --match-path test/integration/

# Invariant tests (property-based fuzzing)
forge test --match-path test/invariant/ -vvv

# Fork tests (against real chain state)
forge test --match-path test/fork/

# Fuzz tests (differential testing)
forge test --match-path test/fuzz/
```

#### Local Development
```bash
# (From contracts/ directory)

# Start local blockchain
anvil

# Deploy to local node (in another terminal, from contracts/)
forge script script/DeployCore.s.sol --rpc-url http://localhost:8545 --broadcast

# Interact with contracts using cast
cast call <ADDRESS> "functionName()" --rpc-url http://localhost:8545
```

#### Dependencies
```bash
# (From contracts/ directory)

# Install all dependencies
forge install

# Update dependencies
forge update
```

### Liquidation Bot (liquidation_bot/)

**All bot commands must be run from the `liquidation_bot/` directory.**

```bash
# Navigate to bot workspace
cd liquidation_bot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env  # then edit .env with your values

# Run bot in development mode
npm run dev

# Run tests (if available)
npm test
```

### Shared Resources

#### Deployments
The `deployments/` directory at the root contains deployed contract addresses per network (e.g., `84532.json` for Base Sepolia). Both the contracts and bot reference this directory.

```bash
# View deployment addresses (from root)
cat deployments/84532.json
```

## High-Level Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│              USER-FACING CONTRACTS                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ LendingPool  │  │ PoolToken    │  │DutchAuction      │  │
│  │(supply/      │  │(ERC20 shares)│  │Liquidator        │  │
│  │ borrow)      │  │              │  │(liquidations)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│           SHARED INFRASTRUCTURE CONTRACTS                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ OracleRouter │  │Interest Rate │  │   Validator      │  │
│  │(dual oracle) │  │Model (kinked)│  │(input checking)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│            DEPLOYMENT & DISCOVERY LAYER                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │MarketFactory │  │MarketRegistry│  │Libraries (Math,  │  │
│  │(creates      │  │(discovers    │  │ Errors, OracleLib)
│  │ clones)      │  │ markets)     │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **LendingPool.sol** (src/core/LendingPool.sol)
- **Role**: Isolated lending market for one collateral/borrow pair
- **Key Functions**:
  - `deposit()` / `withdraw()`: Supply side (earn interest)
  - `depositCollateral()` / `withdrawCollateral()`: Manage collateral
  - `borrow()` / `repay()`: Borrowing with automatic interest accrual
  - `accrueInterest()`: Updates interest state (called before state changes)
  - `healthFactor()`: Check position health
- **Initialization**: Uses proxy pattern with `initialize()` called by factory
- **Key State**: `totalCollateral`, `totalBorrowAssets`, `totalSupplyAssets`, `borrowIndex`
- **Risk Parameters**: LTV (75%), liquidation threshold (80%), penalty (5%), reserve factor (10%)

#### 2. **OracleRouter.sol** (src/core/OracleRouter.sol)
- **Role**: Dual-source price feed with safety checks
- **Primary**: Chainlink Aggregator V3
- **Fallback**: Uniswap V3 TWAP (30-min window)
- **Safety Features**:
  - Deviation checks (max 5% between sources)
  - Staleness checks (Chainlink: 1 hour, TWAP: current)
  - L2 sequencer uptime check (1-hour grace period)
- **Key Function**: `getPrice(address token)` returns price in 1e18 format

#### 3. **InterestRateModel.sol** (src/core/InterestRateModel.sol)
- **Role**: Kinked rate model (rates scale with utilization)
- **Parameters** (immutable):
  - `baseRate`: Starting rate when empty
  - `slopeBeforeKink`: Rate increase per 1% utilization (0% to kink)
  - `slopeAfterKink`: Rate increase per 1% utilization (kink to 100%)
  - `kink`: Utilization threshold (e.g., 80%)
- **Example**: 0% base, 4% slope below 80%, 75% slope above = aggressive rate during congestion
- **Formula**: `rate = baseRate + slope * utilization` (piecewise linear)

#### 4. **MarketFactory.sol** (src/core/MarketFactory.sol)
- **Role**: Creates isolated markets with minimal gas cost
- **Pattern**: OpenZeppelin Clones (minimal proxy = 95% cheaper)
- **Flow**:
  1. Validates parameters
  2. Clones LendingPool implementation
  3. Deploys new PoolToken
  4. Initializes pool with config
  5. Registers in MarketRegistry
- **Access**: Only owner can create markets

#### 5. **MarketRegistry.sol** (src/core/MarketRegistry.sol)
- **Role**: Discover markets and track status
- **Storage**: Maps (collateral, borrow) → pool address
- **Queries**: Get market info, list markets by token
- **Data Structure**: Uses EnumerableSet for O(1) lookups

#### 6. **DutchAuctionLiquidator.sol** (src/core/DutchAuctionLiquidator.sol)
- **Role**: MEV-resistant liquidations via descending price auction
- **Mechanics**:
  - Price starts high (premium), descends to low (discount)
  - Duration: configurable (e.g., 20 minutes)
  - Example: 105% → 95% of collateral value over time
- **Benefit**: Fair price discovery, no MEV extraction, borrower time to self-liquidate
- **Key Functions**: `startAuction()`, `liquidate()`

#### 7. **PoolToken.sol** (src/core/PoolToken.sol)
- **Role**: ERC20 receipt token for supply shares
- **Behavior**: Minted/burned only by LendingPool
- **Value**: Share appreciates as interest accrues (share-based accounting)

### Design Patterns

#### **Share-Based Accounting**
- Supplies tracked as shares (not assets)
- As interest accrues, shares become worth more
- Prevents rounding exploitation, automatic distribution
- Formula: `assetValue = shares * (totalAssets / totalShares)`

#### **Interest Accrual**
1. Check if `block.timestamp > lastAccrualTime`
2. Calculate: `interestFactor = (1 + rate * elapsedTime)`
3. Update: `borrowIndex *= interestFactor` and `totalBorrowAssets *= interestFactor`
4. Split: 90% to suppliers, 10% to protocol reserves
5. Update: `lastAccrualTime`

#### **Isolated Markets**
- Each market is independent instance (no cross-collateral)
- Collateral in WETH/USDC market cannot back DAI borrows
- Prevents one asset collapse from affecting others

#### **Minimal Proxy Pattern**
- Single implementation of LendingPool deployed once
- Each market uses proxy pointing to same implementation
- Gas savings: ~10K per market deployment (vs 400K+ for full contract)

### Common Development Tasks

#### Adding a New Market
1. Call `factory.createMarket(collateral, borrow, params)`
2. Factory clones LendingPool, deploys PoolToken, initializes
3. Market registered in registry and ready to use

#### Modifying Risk Parameters
- Parameters are per-market (set during creation)
- Factory owner creates new market with updated params
- Old markets unchanged (isolation ensures safety)

#### Understanding Interest Calculation
1. Interest accrues per second: `rate = model.calculateRate(utilization)`
2. Borrow index grows: `borrowIndex = borrowIndex * (1 + rate * seconds)`
3. Each borrow's principal grows: `principal *= borrowIndex`
4. See `InterestRateModel.sol:getInterestRate()` and `LendingPool.sol:accrueInterest()`

#### Liquidation Flow
1. Position health drops below 1.0 (HF < liquidationThreshold / LTV)
2. Anyone calls `liquidator.startAuction(pool, user)`
3. Collateral locked, price set at premium
4. Price descends over time
5. Anyone calls `liquidator.liquidate(auctionId, maxDebtRepay)`
6. Liquidator receives collateral at current price, protocol gets penalty

### File Organization

```
ism_protocol/                          # Monorepo root
├── contracts/                         # Smart contracts workspace
│   ├── src/                           # Solidity source
│   │   ├── core/                      # Core lending contracts
│   │   │   ├── LendingPool.sol        # Isolated market
│   │   │   ├── LendingPool_18.sol     # Variant (18 decimals)
│   │   │   ├── MarketFactory.sol      # Market creation
│   │   │   ├── MarketRegistry.sol     # Market discovery
│   │   │   ├── OracleRouter.sol       # Price feeds
│   │   │   ├── InterestRateModel.sol  # Rate calculation
│   │   │   ├── DutchAuctionLiquidator.sol  # Liquidations
│   │   │   └── PoolToken.sol          # ERC20 shares
│   │   ├── interfaces/                # All contract ABIs
│   │   │   ├── ILendingPool.sol
│   │   │   ├── IMarketFactory.sol
│   │   │   ├── IMarketRegistry.sol
│   │   │   ├── IOracleRouter.sol
│   │   │   ├── IInterestRateModel.sol
│   │   │   ├── IDutchAuctionLiquidator.sol
│   │   │   ├── IPoolToken.sol
│   │   │   └── external/              # External protocol interfaces
│   │   ├── libraries/                 # Utility libraries
│   │   │   ├── Errors.sol             # Custom errors
│   │   │   ├── Validator.sol          # Input validation
│   │   │   ├── MathLib.sol            # Fixed-point math (WAD = 1e18)
│   │   │   ├── OracleLib.sol          # Oracle normalization
│   │   │   ├── TickMath.sol           # Uniswap V3 math
│   │   │   └── FullMath.sol           # High-precision math
│   │   └── mocks/                     # Test contracts
│   │       ├── MockERC20.sol
│   │       ├── MockChainlinkAggregator.sol
│   │       ├── MockUniswapV3Pool.sol
│   │       └── MockOracle.sol
│   ├── test/                          # Test suites
│   │   ├── unit/                      # Component tests
│   │   ├── integration/               # End-to-end flows
│   │   ├── invariant/                 # Property-based tests
│   │   ├── fork/                      # Mainnet fork tests
│   │   └── fuzz/                      # Differential tests
│   ├── script/                        # Deployment scripts
│   │   ├── DeployCore.s.sol           # Deploy infrastructure
│   │   ├── DeployMarket.s.sol         # Create new market
│   │   ├── Constants.s.sol            # Deployment constants
│   │   └── DeploymentHelper.sol       # Helper functions
│   ├── foundry.toml                   # Foundry config
│   ├── remappings.txt                 # Import remappings
│   └── README.md                      # Contracts docs
├── liquidation_bot/                   # Bot workspace
│   ├── src/
│   │   ├── config.ts                  # Bot configuration
│   │   ├── logger.ts                  # Logging utilities
│   │   ├── types.ts                   # TypeScript types
│   │   ├── contracts/                 # Contract ABIs and wrappers
│   │   ├── indexer/                   # Event indexing
│   │   └── state/                     # State management
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── deployments/                       # Shared deployment info
│   ├── 84532.json                     # Base Sepolia
│   └── README.md
├── docs/                              # Documentation
│   ├── ARCHITECTURE.md
│   └── ...
├── .gitignore
├── README.md                          # Monorepo overview
└── CLAUDE.md                          # This file
```

### Key Constants and Formulas

| Constant | Value | Purpose |
|----------|-------|---------|
| `WAD` | 1e18 | Fixed-point precision |
| `LTV` | 75% | Max borrow as % of collateral |
| `Liquidation Threshold` | 80% | Health factor threshold for liquidation |
| `Liquidation Penalty` | 5% | Bonus for liquidators |
| `Reserve Factor` | 10% | Protocol fee on interest |

**Health Factor**: `HF = (collateralValue * liquidationThreshold) / debtValue`
- HF > 1.0: Safe
- HF < 1.0: Liquidatable

**Interest Rate**: `rate = baseRate + slope * utilization` (see InterestRateModel)

**Utilization**: `utilization = totalBorrows / (totalSupply + totalBorrows)`

### Testing Guidelines

- **Unit tests** isolate components (test one function/contract at a time)
- **Integration tests** verify multi-contract workflows (deposits → borrows → liquidations)
- **Invariant tests** use property-based fuzzing to find edge cases
- **Key invariants**:
  - Total assets = total borrows + total reserves + protocol balance
  - No user can have negative balance
  - Liquidation should improve health factor

### Deployment Order (Important!)

For a fresh deployment (from `contracts/` directory):
1. InterestRateModel (immutable params)
2. OracleRouter (with feed configurations)
3. DutchAuctionLiquidator
4. MarketRegistry
5. LendingPool implementation (deployed once)
6. MarketFactory (references implementation)
7. Create markets via factory

Deployment addresses are saved to `../deployments/{chainId}.json` at the root level.

See `contracts/README.md` and `docs/DEPLOYMENT.md` for detailed steps.

### Common Gotchas

#### Smart Contracts
1. **Interest accrual**: Always call pool functions that update state (they auto-accrue). Don't manually call `accrueInterest()` in tests unless testing it specifically.

2. **Share-based math**: When comparing expected vs actual balances in tests, remember shares grow as interest accrues. Use `pool.balanceOfUnderlying(user)` to get actual asset value.

3. **Decimal handling**: Collateral and borrow tokens may have different decimals. OracleRouter normalizes to 1e18. Check mock setup in tests.

4. **Oracle staleness**: Tests with real oracle will fail if prices are stale. Mock the oracle in unit tests, use forks if testing real feeds.

5. **Liquidation flow**: Collateral is locked in `startAuction()`. Withdrawal unavailable until auction resolves or expires.

6. **Working directory**: Always run `forge` commands from the `contracts/` directory, not from the root.

#### Liquidation Bot
1. **Contract addresses**: The bot reads deployment addresses from `../deployments/{chainId}.json` relative to the bot directory.

2. **Environment setup**: The bot requires `.env` file in the `liquidation_bot/` directory with proper RPC URL, private key, and configuration.

3. **ABI imports**: Contract ABIs should be generated/exported from the contracts workspace and imported into the bot's `src/contracts/` directory.

#### Monorepo
1. **Path references**: When one workspace references another, use relative paths (e.g., bot references `../deployments/`).

2. **Independent builds**: Each workspace (`contracts/` and `liquidation_bot/`) builds independently. Changes to contracts require rebuilding and potentially updating bot ABIs.

### Liquidation Bot Architecture

The liquidation bot (`liquidation_bot/`) is a TypeScript application that monitors lending pools and executes liquidations via Dutch auctions.

#### Key Components

1. **Config (`config.ts`)**:
   - Loads deployment addresses from `../deployments/{chainId}.json`
   - Configures RPC endpoints, monitoring intervals, gas limits
   - Defines bot operational parameters

2. **Indexer (`src/indexer/`)**:
   - Monitors on-chain events (borrows, repayments, collateral changes)
   - Tracks borrower positions and health factors
   - Identifies liquidation opportunities

3. **State Management (`src/state/`)**:
   - Maintains in-memory state of tracked positions
   - Caches health factors and debt positions
   - Manages auction state

4. **Contract Wrappers (`src/contracts/`)**:
   - TypeScript interfaces to interact with deployed contracts
   - Uses ethers.js for blockchain interaction
   - Imports ABIs from compiled contracts

5. **Logger (`logger.ts`)**:
   - Winston-based logging
   - Tracks bot operations, liquidations, errors
   - Configurable log levels

#### Bot Operation Flow

1. **Initialization**:
   - Load config from `.env` and deployment addresses
   - Connect to RPC provider
   - Initialize contract instances

2. **Monitoring Loop**:
   - Query lending pools for active borrowers
   - Calculate health factors for each position
   - Identify positions with HF < 1.0

3. **Liquidation Execution**:
   - Call `DutchAuctionLiquidator.startAuction()` for unhealthy positions
   - Monitor auction price decay
   - Execute `liquidate()` when profitable

4. **Profit Calculation**:
   - Evaluate collateral value at current auction price
   - Compare to debt repayment cost
   - Execute only if net profit exceeds gas costs

#### Bot Development

To modify or extend the bot:

1. **Add new monitoring logic**: Edit `src/indexer/`
2. **Change liquidation strategy**: Modify profit calculation in liquidation logic
3. **Add new contract interactions**: Update `src/contracts/` with new ABIs
4. **Adjust configuration**: Edit `config.ts` or `.env`

### Performance Notes

#### Smart Contracts
- **Gas Optimization**: Minimal proxies save ~95% on market deployment
- **Math Precision**: Uses 1e18 fixed-point (WAD) for all rates and prices
- **Batching**: Consider batching multiple operations to save gas
- **L2 Native**: Built for Base - lower gas costs than Ethereum mainnet

#### Liquidation Bot
- **RPC calls**: Bot makes frequent RPC calls; consider using a paid RPC provider for production
- **Indexing**: Events are indexed to reduce full chain scans
- **Concurrency**: Bot can monitor multiple markets in parallel
- **Gas management**: Bot dynamically adjusts gas prices based on network conditions

### Resources

#### Documentation
- **README.md** (root): Monorepo overview and quick start
- **contracts/README.md**: Smart contracts guide
- **docs/DEPLOYMENT.md**: Deployment instructions
- **docs/ARCHITECTURE.md**: System architecture deep dive

#### External Resources
- **Foundry Docs**: https://book.getfoundry.sh/
- **Solidity Docs**: https://docs.soliditylang.org/
- **Ethers.js Docs**: https://docs.ethers.org/
- **Base Docs**: https://docs.base.org/
