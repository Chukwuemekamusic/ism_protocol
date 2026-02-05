# ISM Protocol - High-Level Architecture Guide

## Overview

The **Isolated Lending Protocol (ISM)** is a decentralized lending system built on Base (Ethereum L2) with isolated markets, dual oracle system, and Dutch auction liquidations. Each collateral/borrow pair operates as a separate market, preventing contagion between assets.

---

## 1. Core Components (src/core/)

### File Structure
```
src/core/
├── LendingPool.sol              # Main lending market contract
├── LendingPool_18.sol           # Alternative version (18 decimal variant)
├── MarketFactory.sol            # Factory for creating isolated markets
├── MarketRegistry.sol           # Registry tracking all markets
├── OracleRouter.sol             # Dual oracle system (Chainlink + Uniswap)
├── InterestRateModel.sol        # Kinked interest rate model
├── DutchAuctionLiquidator.sol   # Dutch auction liquidation mechanism
└── PoolToken.sol                # ERC20 receipt token for pool shares
```

### Component Purposes

#### LendingPool.sol
- **Purpose**: Isolated market contract - one instance per collateral/borrow pair
- **Key Features**:
  - Supply/Withdraw: Users deposit borrow tokens to earn interest
  - Collateral Management: Users deposit collateral to borrow against
  - Borrow/Repay: Core lending operations with health factor tracking
  - Interest Accrual: Automatic interest calculation using variable rate model
  - Liquidation Support: Integrates with DutchAuctionLiquidator

- **Key State Variables**:
  ```solidity
  IERC20 collateralToken;          // Token used as collateral
  IERC20 borrowToken;              // Token that can be borrowed
  IPoolToken poolToken;            // Receipt token (shares of supply)
  
  uint256 totalCollateral;         // Total collateral deposited
  uint256 totalBorrowAssets;       // Total borrow assets (principal + interest)
  uint256 totalSupplyAssets;       // Total supply assets
  uint256 borrowIndex;             // Cumulative borrow rate index
  
  mapping(address => Position) positions;  // User collateral and borrow shares
  ```

- **Risk Parameters**:
  - LTV (Loan-to-Value): Max borrowable as % of collateral (e.g., 75%)
  - Liquidation Threshold: Health factor threshold for liquidation (e.g., 80%)
  - Liquidation Penalty: Bonus to liquidators (e.g., 5%)
  - Reserve Factor: Protocol fee on interest (e.g., 10%)

#### MarketFactory.sol
- **Purpose**: Factory contract using minimal proxy pattern for gas-efficient market deployment
- **Key Responsibilities**:
  1. Creates new LendingPool clones via Clones.clone()
  2. Creates PoolToken for each market
  3. Initializes pools with configuration
  4. Registers markets in the registry
  5. Tracks all created markets

- **Key State**:
  ```solidity
  address immutable lendingPoolImplementation;  // Logic contract for cloning
  address immutable oracleRouter;               // Shared oracle
  address immutable interestRateModel;          // Shared interest rate model
  address immutable liquidator;                 // Shared liquidator
  IMarketRegistry registry;                     // Registry reference
  
  mapping(address collateral => mapping(address borrow => address market)) markets;
  address[] allMarkets;
  ```

- **Validation**:
  - Ensures LTV is between 0% and 95%
  - Ensures liquidation threshold > LTV but <= 99%
  - Prevents duplicate markets for same pair
  - Prevents same token as both collateral and borrow

#### MarketRegistry.sol
- **Purpose**: Centralized registry for market discovery and management
- **Key Features**:
  - Market Registration: Records market metadata
  - Market Status: Activate/deactivate markets
  - Factory Authorization: Controls which factories can register
  - Enumerable Sets: Efficient querying by collateral/borrow token

- **Stored Information**:
  ```solidity
  struct MarketInfo {
    address market;
    address collateralToken;
    address borrowToken;
    address poolToken;
    uint256 createdAt;
    bool isActive;
  }
  ```

- **Enables**:
  - Finding all markets using token X as collateral
  - Finding all markets using token Y as borrow
  - Getting all active markets
  - Checking if market is registered/active

#### OracleRouter.sol
- **Purpose**: Dual-source oracle system for price feeds with fallback mechanism
- **Architecture**:
  - **Primary**: Chainlink Aggregator V3
  - **Fallback**: Uniswap V3 TWAP (Time-Weighted Average Price)
  - **Safety**: Sequencer uptime checks for L2s

- **Configuration per Token**:
  ```solidity
  struct OracleConfig {
    address chainlinkFeed;      // Chainlink aggregator address
    address uniswapPool;        // Uniswap V3 pool for TWAP
    uint32 twapWindow;          // TWAP calculation window (e.g., 30 min)
    uint96 maxStaleness;        // Max Chainlink staleness (e.g., 1 hour)
    bool isToken0;              // Whether token is token0 in pool
  }
  ```

- **Price Resolution Logic**:
  1. If Chainlink valid AND TWAP valid: Check deviation (max 5%)
     - Use Chainlink as primary
  2. If only Chainlink valid: Use Chainlink
  3. If only TWAP valid: Use TWAP (fallback)
  4. If neither valid: Revert (BothOraclesFailed)

- **Safety Mechanisms**:
  - Staleness checks on Chainlink data
  - Sequencer uptime verification for L2s
  - Deviation check between sources
  - Negative price protection

#### InterestRateModel.sol
- **Purpose**: Kinked interest rate model for dynamic rate adjustment
- **Model Type**: Variable-rate with utilization-based knink
- **Parameters**:
  ```solidity
  uint256 baseRatePerSecond;      // Rate at 0% utilization
  uint256 slopeBeforeKink;        // Rate increase below kink
  uint256 slopeAfterKink;         // Rate increase above kink (steeper)
  uint256 kink;                   // Utilization threshold (e.g., 80%)
  ```

- **Rate Calculation**:
  ```
  If utilization <= kink:
    borrowRate = baseRate + utilization * slopeBeforeKink
  
  If utilization > kink:
    borrowRate = baseRate + kink * slopeBeforeKink 
                + (utilization - kink) * slopeAfterKink
  ```

- **Behavior**: Rates stay low when pool isn't fully utilized, spike when approaching capacity
- **Supply Rate**: Adjusted by reserve factor (portion going to protocol)

#### DutchAuctionLiquidator.sol
- **Purpose**: MEV-resistant liquidation via descending-price Dutch auction
- **Mechanism**:
  1. Position becomes unhealthy (health factor < 1.0)
  2. Liquidator starts auction, locking collateral
  3. Price starts high (start premium e.g., 105% of oracle price)
  4. Price descends linearly over duration (e.g., 20 minutes)
  5. Ends at discount (e.g., 95% of oracle price)
  6. Anyone can liquidate at current price during auction window
  7. Expired auctions return collateral to user

- **Key State**:
  ```solidity
  struct Auction {
    address user;
    address pool;
    uint128 debtToRepay;           // Amount of debt to liquidate
    uint128 collateralForSale;     // Amount of collateral for sale
    uint64 startTime;
    uint64 endTime;
    uint256 startPrice;            // Collateral price at start
    uint256 endPrice;              // Collateral price at end
    bool isActive;
  }
  ```

- **Configuration**:
  ```solidity
  struct AuctionConfig {
    uint256 duration;              // Auction length (e.g., 20 min)
    uint256 startPremium;          // Start price premium (e.g., 1.05e18 = 105%)
    uint256 endDiscount;           // End price discount (e.g., 0.95e18 = 95%)
    uint256 closeFactor;           // Max % of debt to liquidate (e.g., 0.5e18 = 50%)
  }
  ```

#### PoolToken.sol
- **Purpose**: ERC20 receipt token representing shares in a lending pool
- **Key Feature**: Only the LendingPool can mint/burn
- **Usage**: 
  - Suppliers receive pool tokens when depositing borrow tokens
  - Suppliers burn tokens to withdraw with earned interest
  - Enables share-based accounting (prevents rounding issues)

---

## 2. Key Interfaces (src/interfaces/)

### ILendingPool.sol
Defines the core lending pool operations:
- Supply operations: deposit, withdraw
- Collateral operations: depositCollateral, withdrawCollateral
- Borrow operations: borrow, repay, repayOnBehalf
- Liquidation support: lockCollateral, unlockCollateral, executeLiquidation
- View functions: getPosition, healthFactor, getUserDebt, getMaxBorrow

### IMarketFactory.sol
Market creation interface:
- createMarket: Create new isolated market
- getMarket: Lookup market by token pair
- marketExists: Check market existence
- getAllMarkets: Get all markets
- Shared immutable references: oracleRouter, interestRateModel, liquidator

### IMarketRegistry.sol
Market discovery and management:
- registerMarket: Register new market (authorized only)
- setMarketStatus: Activate/deactivate markets
- Queries: getMarketInfo, getMarketsForCollateral, getMarketsForBorrow, getActiveMarkets

### IOracleRouter.sol
Price feed interface:
- getPrice: Get current token price (18 decimals)
- getPriceData: Get price with metadata (source, timestamp)
- setOracleConfig: Configure feeds per token
- getTwapPrice: Direct TWAP access

### IInterestRateModel.sol
Interest rate calculation:
- getBorrowRate: Current borrow rate given supply/borrow amounts
- getSupplyRate: Supply rate (adjusted for reserve factor)
- getUtilization: Current pool utilization %

### IDutchAuctionLiquidator.sol
Liquidation auction interface:
- startAuction: Initiate auction for underwater position
- liquidate: Execute liquidation at current price
- cancelExpiredAuction: Return collateral after expiration
- getCurrentPrice: Query current auction price
- getAuction: Get auction details

### IPoolToken.sol
ERC20 receipt token:
- mint/burn: Only callable by pool

---

## 3. Libraries (src/libraries/)

### Errors.sol
- Centralized error definitions for all contracts
- Organized by component (LendingPool, OracleRouter, DutchAuctionLiquidator, etc.)
- Enables consistent error handling across codebase

### Validator.sol
- Input validation helper functions
- Checks for zero addresses, same tokens, valid tokens
- Reduces validation code duplication

### MathLib.sol
- Fixed-point arithmetic using WAD (1e18) precision
- mulWadDown, mulWadUp: Multiply scaled values (down/up rounding)
- divWadDown, divWadUp: Divide scaled values (down/up rounding)
- min, max: Comparison utilities
- annualRateToPerSecond: Convert annual rates to per-second rates

### OracleLib.sol
- Oracle-specific utilities
- validateChainlinkData: Check price freshness and validity
- normalizePrice: Convert Chainlink price to 18-decimal format
- calculateDeviation: Measure % difference between prices

### TickMath.sol
- Uniswap V3 tick-to-price conversion
- getSqrtRatioAtTick: Convert tick number to sqrt price
- Used for TWAP price calculations

### FullMath.sol
- High-precision multiplication/division
- mulDiv: Safe (x * y) / denominator without overflow
- Used for complex price calculations

---

## 4. Main Patterns and Relationships

### Architecture Layers

```
┌─────────────────────────────────────────────┐
│         User-Facing Contracts               │
│  (LendingPool, DutchAuctionLiquidator)      │
└────────────────────┬────────────────────────┘
                     │ uses
┌────────────────────▼────────────────────────┐
│      Supporting Infrastructure              │
│  (OracleRouter, InterestRateModel)          │
└────────────────────┬────────────────────────┘
                     │ configured by
┌────────────────────▼────────────────────────┐
│      Deployment & Discovery Layer           │
│  (MarketFactory, MarketRegistry)            │
└─────────────────────────────────────────────┘
```

### Proxy Pattern

- **Implementation Contract**: Single LendingPool contract deployed once
- **Clones**: Factory creates minimal proxy clones for each market
- **Benefit**: ~95% gas savings on market deployment (10K gas vs 200K)
- **Owner**: Each pool instance is independent; factory retains deployment control

### Share-Based Accounting

**Supply Shares** (PoolToken):
```
User deposits 100 USDC -> receives shares = 100 USDC / (totalAssets / totalShares)
Pool earns 10 USDC interest -> totalAssets increases but shares unchanged
User withdraws shares -> receives = shares * (totalAssets / totalShares)
Result: Shares appreciate in value as interest accrues
```

**Borrow Shares**:
```
User borrows 100 USDC -> receives shares = 100 USDC / borrowIndex
Interest accrues -> borrowIndex increases
User repays shares -> pays = shares * borrowIndex
Result: Borrowers pay interest automatically through index mechanism
```

### Interest Accrual

```
Every state-changing transaction:
  1. Call accrueInterest()
  2. Calculate elapsed time since last accrual
  3. Get borrow rate from InterestRateModel
  4. Update borrowIndex = borrowIndex * (1 + rate * time)
  5. Update totalBorrowAssets = totalBorrowAssets * interestFactor
  6. Split interest: protocol reserves (10%) + suppliers (90%)
```

### Health Factor Calculation

```
healthFactor = (collateralValue * liquidationThreshold) / debtValue

- healthFactor > 1.0: Position is safe
- healthFactor < 1.0: Position is liquidatable
- Liquidation threshold typically > LTV (e.g., 80% > 75%) to allow liquidation before full collateral loss
```

### Price Normalization

All prices use 18 decimals internally:
```
normalizedPrice = chainlinkPrice * 10^(18 - feedDecimals)

Example:
- Token: USDC (6 decimals)
- Chainlink feeds: 8 decimals (price = 99_999_999, meaning $0.99999999)
- Normalized: 99_999_999 * 10^10 = 9.9999999e17 (1e18 scale)
```

---

## 5. Market Factory and Registry Integration

### Factory Workflow

```
User/Admin calls factory.createMarket({
  collateralToken: WETH,
  borrowToken: USDC,
  ltv: 0.75e18,
  liquidationThreshold: 0.80e18,
  liquidationPenalty: 0.05e18,
  reserveFactor: 0.1e18,
  poolTokenName: "Isolated Pool WETH/USDC",
  poolTokenSymbol: "ipWETH-USDC"
})

Factory actions:
1. Validate parameters
2. Check market doesn't exist
3. Clone lending pool implementation
4. Deploy new PoolToken
5. Initialize pool with config
6. Register in registry
7. Store market references
8. Emit MarketCreated event
```

### Registry Workflow

```
Factory calls: registry.registerMarket(market, WETH, USDC, poolToken)

Registry stores:
- marketInfo[market]: Full market metadata
- _allMarkets: Enumerable set of all markets
- _activeMarkets: Enumerable set of active markets
- _marketsByCollateral[WETH]: All markets using WETH as collateral
- _marketsByBorrow[USDC]: All markets using USDC as borrow

Enables queries:
- "Get all WETH markets" -> _marketsByCollateral[WETH].values()
- "Is market active?" -> _activeMarkets.contains(market)
- "Get all markets" -> _allMarkets.values()
```

### Why Separate Factory and Registry?

- **Factory**: Deployment logic (owner only)
- **Registry**: Market discovery (public)
- **Separation**: Factory focuses on market creation; Registry enables discovery
- **Future**: Multiple factories could exist; registry coordinates them
- **Authorization**: Registry uses `onlyAuthorized()` to check if caller is approved factory

---

## 6. Oracle System Architecture

### Dual-Source Design

```
getPrice(token):
  1. Check L2 sequencer status (if applicable)
  2. Fetch Chainlink price + validate
  3. Fetch TWAP price (if configured)
  4. Decision logic:
     - Both valid: Compare (must be within 5% deviation)
     - One valid: Use that one
     - None valid: Revert
```

### Chainlink Integration

```
Steps:
1. Call feed.latestRoundData()
2. Validate:
   - roundId > 0 and answeredInRound == roundId (fresh data)
   - answer > 0 (valid price)
   - block.timestamp - updatedAt < maxStaleness (not stale)
3. Normalize: answer * 10^(18 - feedDecimals)
4. Return price

Benefits:
- Fast, accurate on-chain prices
- Aggregated data from multiple off-chain sources
- Wide token coverage
```

### Uniswap V3 TWAP (Fallback)

```
Steps:
1. Call pool.observe(timeWindow) -> get tick cumulatives
2. Calculate average tick = (tick_now - tick_past) / timeWindow
3. Convert tick to sqrtPrice via TickMath.getSqrtRatioAtTick()
4. Calculate price = (sqrtPrice^2 / 2^192) * 1e18
5. Handle token0/token1 (normal or inverse)

Benefits:
- Requires no external infrastructure
- Resistant to single-price manipulation
- Decentralized liquidity sources

Limitations:
- Less accurate with low liquidity
- Requires pool to have observation history
- Higher gas cost
```

### Sequencer Uptime Check (L2s)

```
For Layer 2 networks (Arbitrum, Optimism, etc.):
1. Query sequencer uptime feed
2. If sequencer is down: Revert (can't trust prices)
3. If just came back: Wait grace period (1 hour) before accepting prices
4. Purpose: Prevent liquidations during sequencer downtime

Grace period: Time for system to stabilize after sequencer restart
```

---

## 7. Test Structure (test/)

### Unit Tests (test/unit/)

Individual component tests:
- **LendingPool.t.sol**: Pool operations, interest accrual, health factors
- **MarketFactory.t.sol**: Market creation, validation, registry integration
- **MarketRegistry.t.sol**: Registration, queries, status management
- **OracleRouterTest.t.sol**: Price fetching, fallback logic, validation
- **InterestRateModel.t.sol**: Rate calculations, utilization, kink behavior

### Integration Tests (test/integration/)

Multi-component workflows:
- **DepositBorrowRepayTest.t.sol**: Complete user lifecycle (deposit -> borrow -> repay -> withdraw)
- **LiquidationFlowTest.t.sol**: Full liquidation flow (borrow -> underwater -> auction -> liquidate)
- **Liquidation2.t.sol**: Alternative liquidation scenarios
- **MultiMarketTest.t.sol**: Multiple isolated markets interacting

### Invariant Tests (test/invariant/)

Property-based testing with stateful fuzzing:
- **InvariantLending.t.sol**: Supply/borrow invariants (currently empty/WIP)
- **InvariantLiquidation.t.sol**: Liquidation invariants (currently empty/WIP)
- **handlers/LendingHandler.sol**: Action generator for fuzzing

### Fork Tests (test/fork/)

Testing against mainnet state (empty, ready for deployment)

### Fuzz Tests (test/fuzz/)

Randomized input testing (empty, structured separately from invariants)

### Test Patterns

```solidity
setUp(): Create all contracts, fund users, approve tokens

test_*: Individual feature test
  - Arrange: Set up state
  - Act: Call function
  - Assert: Verify results + events

Test mocks: MockERC20, MockOracle, MockChainlinkAggregator, MockUniswapV3Pool
- Allow deterministic testing without mainnet dependency
- Enable rapid iteration
- Simulate edge cases
```

---

## 8. End-to-End Flow Examples

### Supplier Flow

```
1. User has 10,000 USDC, wants to earn interest
2. User calls USDC.approve(pool, 10,000 USDC)
3. User calls pool.deposit(10,000 USDC)
   - accrueInterest() runs first
   - Pool mints pool tokens to user
   - totalSupplyAssets increases
   - USDC transferred to pool
4. Over time, interest accrues:
   - borrowIndex increases
   - totalSupplyAssets increases (via interest)
   - User's pool tokens stay same count but worth more
5. User calls pool.withdraw(shares)
   - Pool burns shares
   - Calculates assets = shares * (totalSupplyAssets / totalSupplyShares)
   - User gets 10,000 + interest in USDC

Supply rate = borrowRate * utilization * (1 - reserveFactor)
```

### Borrower Flow

```
1. User has 1 ETH collateral, wants to borrow USDC
2. User calls WETH.approve(pool, 1 ETH)
3. User calls pool.depositCollateral(1 ETH)
   - Stores in positions[user].collateralAmount
   - totalCollateral increases
4. User calls pool.borrow(7,500 USDC)
   - Checks: 7,500 <= 75% * ETHvalue (LTV check)
   - Checks: 7,500 available in pool
   - Creates borrow shares = 7,500 / borrowIndex
   - Transfers USDC to user
5. Over time, debt increases:
   - User pays 0% visible, but borrow shares are worth more
   - When repaying, shares * borrowIndex = amount owed
6. User repays debt:
   - User calls USDC.approve(pool, amountToRepay)
   - Calls pool.repay(amountToRepay)
   - Calculates shares = amountToRepay / borrowIndex
   - Burns shares, reduces debt
7. User withdraws collateral:
   - Calls pool.withdrawCollateral(amount)
   - Checks: new position still healthy
   - Returns WETH to user
```

### Liquidator Flow

```
1. Borrower becomes underwater:
   - healthFactor = (1 ETH * 0.8) / 8,000 = 0.1 (< 1.0)
2. Liquidator calls liquidator.startAuction(pool, borrower)
   - Checks position is liquidatable
   - Locks collateral
   - Sets startPrice = oraclePrice * 1.05 (5% premium)
   - Sets endPrice = oraclePrice * 0.95 (5% discount)
   - Duration: 20 minutes
3. Price decays linearly:
   - t=0: startPrice = $2100/ETH
   - t=10min: ~$2000/ETH (midpoint)
   - t=20min: endPrice = $1900/ETH
4. Liquidator liquidates:
   - Calls liquidator.liquidate(auctionId, maxRepay)
   - Gets collateral at current price (profit if price moved favorably)
   - Debt repaid, collateral seized
5. If auction expires (20 min passes):
   - Liquidator calls cancelExpiredAuction()
   - Collateral returned to borrower
   - Borrower had chance to repay or escape
```

---

## 9. Key Design Principles

### 1. Isolation
- Each collateral/borrow pair is separate
- Default in one market doesn't affect others
- Risk is compartmentalized

### 2. Fairness (Dutch Auction Liquidations)
- Everyone sees the same price
- No MEV extraction through liquidation bots
- Price discovery mechanism
- Borrower has time to repay before heavy discount

### 3. Safety
- Dual oracle with fallback
- Sequencer checks for L2s
- Health factor buffer (threshold > LTV)
- Reentrancy guards
- Extensive validation

### 4. Gas Efficiency
- Minimal proxy pattern for markets
- ERC4626-like share accounting
- Lazy interest accrual (only when needed)
- Enumerable sets for efficient queries

### 5. Composability
- Modular design
- Shared infrastructure (oracle, rates, liquidator)
- Multiple markets operate independently
- Registry enables discovery

---

## 10. Critical Dependencies

### External

- **OpenZeppelin Contracts**: ERC20, Ownable, ReentrancyGuard, Clones, EnumerableSet, Initializable
- **Uniswap V3 Core**: TickMath, FixedPoint128 (for TWAP calculations)

### Internal

```
LendingPool
  -> IInterestRateModel (shared)
  -> IOracleRouter (shared)
  -> IPoolToken (per-market)
  -> IDutchAuctionLiquidator (shared)

MarketFactory
  -> LendingPool (implementation)
  -> PoolToken (deployed per market)
  -> IMarketRegistry
  -> IOracleRouter (shared)
  -> IInterestRateModel (shared)
  -> IDutchAuctionLiquidator (shared)

DutchAuctionLiquidator
  -> IOracleRouter (shared)
  -> ILendingPool (any market)

OracleRouter
  -> IChainlinkAggregatorV3 (external)
  -> IUniswapV3Pool (external)
```

---

## 11. Deployment Order

```
1. Deploy mocks (for testing) or external feeds (mainnet)
2. Deploy InterestRateModel (shared, immutable)
3. Deploy OracleRouter (shared, ownable)
4. Configure OracleRouter with Chainlink + TWAP feeds
5. Deploy DutchAuctionLiquidator (shared, ownable)
6. Deploy MarketRegistry (shared, ownable)
7. Deploy LendingPool implementation (logic)
8. Deploy MarketFactory (points to all above)
9. Register factory in registry (setFactory)
10. Create markets via factory.createMarket()
```

---

## 12. Summary Table: Component Responsibilities

| Component | Responsibility | Shared? | Ownable? |
|-----------|-----------------|---------|----------|
| LendingPool | Core lending operations | No (per-market clone) | No |
| PoolToken | ERC20 shares | No (per-market) | No |
| MarketFactory | Create/manage markets | Yes | Yes |
| MarketRegistry | Market discovery | Yes | Yes |
| OracleRouter | Price feeds | Yes | Yes |
| InterestRateModel | Rate calculation | Yes | No |
| DutchAuctionLiquidator | Liquidations | Yes | Yes |

---

## 13. Testing Strategy

1. **Unit**: Test each component in isolation with mocks
2. **Integration**: Test workflows across multiple components
3. **Invariant**: Verify properties hold under fuzzing (e.g., totalAssets >= borrowedAssets)
4. **Fork**: Test against real mainnet state (future)
5. **Scenario**: Real-world scenarios (multi-user, liquidations, rates)

Each test file includes:
- setUp(): Deploy contracts + initial state
- test_*: Individual test cases
- Comments explaining what's being tested
- Assertions on state + events

---

## Key Takeaways for New Developers

1. **Start with LendingPool**: Understand supply/borrow mechanics first
2. **Then OracleRouter**: Understand price discovery and fallback logic
3. **Then InterestRateModel**: Understand how rates work
4. **Then MarketFactory/Registry**: Understand market creation and discovery
5. **Then DutchAuctionLiquidator**: Understand liquidation mechanism
6. **Finally, integration tests**: See how it all fits together

The system is modular - you can understand each piece independently, then see how they compose into a complete lending protocol.
