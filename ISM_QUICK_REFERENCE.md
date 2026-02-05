# ISM Protocol - Quick Reference Guide

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      SHARED INFRASTRUCTURE                        │
│                     (Deployed Once, Used by All)                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌────────────┐ │
│  │  OracleRouter    │  │ InterestRateModel   │  │ Liquidator │ │
│  │                  │  │                     │  │            │ │
│  │ - Chainlink      │  │ - Kinked rates      │  │ - Auctions │ │
│  │ - Uniswap TWAP   │  │ - 4 parameters      │  │ - Dutch    │ │
│  │ - Fallback logic │  │ - Utilization-based │  │ - Linear   │ │
│  │ - Price norm.    │  │                     │  │   decay    │ │
│  └──────────────────┘  └─────────────────────┘  └────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌─────────────────────┐                 │
│  │ MarketFactory    │  │ MarketRegistry      │                 │
│  │                  │  │                     │                 │
│  │ - Creates pools  │  │ - Tracks markets    │                 │
│  │ - Minimal proxy  │  │ - Queries           │                 │
│  │ - Initializes    │  │ - Status mgmt       │                 │
│  │ - Clones LP impl │  │ - Authorization     │                 │
│  └──────────────────┘  └─────────────────────┘                 │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                    Factory.createMarket()
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  WETH/USDC       │  │  WBTC/USDC       │  │  ARB/USDC        │
│  Market          │  │  Market          │  │  Market          │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ LendingPool      │  │ LendingPool      │  │ LendingPool      │
│ PoolToken        │  │ PoolToken        │  │ PoolToken        │
│                  │  │                  │  │                  │
│ - Deposits       │  │ - Deposits       │  │ - Deposits       │
│ - Borrows        │  │ - Borrows        │  │ - Borrows        │
│ - Interest       │  │ - Interest       │  │ - Interest       │
│ - Liquidation    │  │ - Liquidation    │  │ - Liquidation    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Data Flow - Supplier

```
User has USDC → Approves Pool → Calls deposit(amount)
                                       │
                              accrueInterest()
                                       │
                    ┌──────────────────┼─────────────────┐
                    │                  │                 │
            Get borrow rate     Calculate interest      Update index
            from model          and reserves
                    │                  │                 │
                    └──────────────────┼─────────────────┘
                                       │
                    ┌──────────────────┼─────────────────┐
                    │                  │                 │
            Mint PoolTokens      Transfer USDC        Update totals
            to supplier          to pool
                    │                  │                 │
                    └──────────────────┼─────────────────┘
                                       │
                              Supplier gets shares
```

## Data Flow - Borrower

```
User has collateral → Deposits collateral → Calls borrow(amount)
                                                    │
                                           accrueInterest()
                                                    │
                              ┌──────────────────────┼──────────────────┐
                              │                      │                  │
                    Check LTV    Calculate shares    Check liquidity
                    constraint   from borrowIndex    available
                              │                      │                  │
                              └──────────────────────┼──────────────────┘
                                                    │
                              ┌──────────────────────┼──────────────────┐
                              │                      │                  │
                    Store borrow    Transfer borrow   Update totals
                    shares          tokens to user
                              │                      │                  │
                              └──────────────────────┼──────────────────┘
                                                    │
                                         Borrower gets tokens
```

## Data Flow - Liquidation

```
Position underwater (HF < 1.0)
         │
         └→ liquidator.startAuction(pool, user)
                │
    ┌───────────┼────────────┐
    │           │            │
Check health  Lock collateral  Calculate prices
factor        (mark for sale)
    │           │            │
    └───────────┼────────────┘
                │
         Auction created:
         - Duration: 20 min
         - Start price: +5%
         - End price: -5%
                │
    ┌───────────┴────────────┐
    │                        │
Wait for price drop    liquidate(auctionId)
(optional)                   │
    │            ┌───────────┼────────────┐
    │            │           │            │
    │    Check active   Get current   Calculate
    │    Not expired    price         amounts
    │            │           │            │
    │            └───────────┼────────────┘
    │                        │
    │             ┌──────────┼──────────┐
    │             │          │          │
    │        Burn debt   Seize        Transfer
    │        shares      collateral   to liquidator
    │             │          │          │
    │             └──────────┼──────────┘
    │                        │
    │                Close auction
    │                (if debt cleared)
    │
    └→ cancelExpiredAuction() [if expired]
                │
         Return collateral
         to borrower
```

## Oracle Decision Tree

```
getPrice(token)
    │
    ├─→ Check sequencer (L2s only)
    │   └─→ If down: REVERT SequencerDown
    │
    ├─→ Fetch Chainlink
    │   ├─→ Success?
    │   │   ├─→ YES: Validate (fresh, positive, not stale)
    │   │   │       └─→ Valid? chainlinkValid = true
    │   │   └─→ NO: chainlinkValid = false
    │
    ├─→ Fetch TWAP (if configured)
    │   ├─→ Success?
    │   │   ├─→ YES: Calculate price from ticks
    │   │   │       └─→ twapValid = true
    │   │   └─→ NO: twapValid = false
    │
    └─→ Decision Logic:
        ├─→ Both valid?
        │   └─→ Check deviation (max 5%)
        │       ├─→ Within 5%? Return Chainlink
        │       └─→ > 5%? REVERT PriceDeviationTooHigh
        │
        ├─→ Only Chainlink? Return Chainlink
        │
        ├─→ Only TWAP? Return TWAP (fallback)
        │
        └─→ Neither? REVERT BothOraclesFailed
```

## Interest Model Rate Calculation

```
Given: utilization (U) = totalBorrows / totalSupply

If U <= kink (e.g., 80%):
    borrowRate = baseRate + U * slopeBeforeKink
    
    Example: U=60%, baseRate=0%, slope=4%/year
    → borrowRate = 0% + 60% * 4% = 2.4%/year

If U > kink (e.g., 80%):
    borrowRate = baseRate + kink * slopeBeforeKink 
                + (U - kink) * slopeAfterKink
    
    Example: U=95%, baseRate=0%, kink=80%
             slopeBefore=4%, slopeAfter=75%
    → borrowRate = 0% + 80% * 4% + 15% * 75%
    → borrowRate = 3.2% + 11.25% = 14.45%/year

Supply Rate:
    supplyRate = borrowRate * utilization * (1 - reserveFactor)
    
    Example: borrowRate=14.45%, U=95%, reserveFactor=10%
    → supplyRate = 14.45% * 95% * 90% = 12.33%/year
```

## Key Formulas

### Health Factor
```
HF = (collateralValue * liquidationThreshold) / debtValue
   = (collateral_amount * collateral_price * LT) / (borrow_shares * borrowIndex * borrow_price)

Position safe if: HF >= 1.0
Position liquidatable if: HF < 1.0
```

### Share Accounting (Supply)
```
Deposit 100 USDC:
  shares = 100 * totalSupplyShares / totalSupplyAssets
  (or 1:1 if pool empty)
  
Withdraw X shares:
  assets = X * totalSupplyAssets / totalSupplyShares
  
Interest compounds in totalSupplyAssets, so shares worth more over time
```

### Share Accounting (Borrow)
```
Borrow 100 USDC:
  shares = 100 / borrowIndex
  (or 1:1 if borrowIndex == 1e18)
  
Repay X shares:
  amount_owed = X * borrowIndex
  
Interest compounds in borrowIndex, so shares represent more debt over time
```

### Health Factor Changes
```
When collateral price increases:
  HF increases (numerator increases)

When borrow price increases:
  HF decreases (denominator increases in terms of USD)

When borrower repays:
  HF increases (denominator decreases)

When interest accrues:
  HF decreases (debt grows via borrowIndex)
```

## Common Workflows

### Create a Market
```solidity
// Admin creates WETH/USDC market
factory.createMarket(
  collateralToken: WETH,
  borrowToken: USDC,
  ltv: 0.75e18,           // 75%
  liquidationThreshold: 0.80e18,  // 80%
  liquidationPenalty: 0.05e18,    // 5%
  reserveFactor: 0.1e18,  // 10%
  poolTokenName: "Isolated Pool WETH/USDC",
  poolTokenSymbol: "ipWETH-USDC"
);

// Internally:
// 1. Clone LendingPool
// 2. Deploy PoolToken
// 3. Initialize pool
// 4. Register in registry
// 5. Emit event
```

### Supply and Earn
```solidity
// User supplies USDC
usdc.approve(pool, 10000e6);
shares = pool.deposit(10000e6);

// Wait for interest...

// Withdraw with interest
assets = pool.withdraw(shares);  // > 10000e6 due to interest
```

### Borrow with Collateral
```solidity
// Deposit collateral
weth.approve(pool, 1e18);
pool.depositCollateral(1e18);

// Borrow (at 75% LTV, can borrow ~$1500 at $2000 ETH price)
pool.borrow(750e6);  // 750 USDC

// Repay (with accrued interest)
usdc.approve(pool, type(uint256).max);
pool.repay(type(uint256).max);  // Repay all

// Withdraw collateral
pool.withdrawCollateral(1e18);
```

### Liquidate Underwater Position
```solidity
// Start auction
auctionId = liquidator.startAuction(pool, borrower);

// Get current price (auction is descending)
currentPrice = liquidator.getCurrentPrice(auctionId);

// Liquidate
usdc.approve(liquidator, debtToRepay);
(debtRepaid, collateralReceived) = liquidator.liquidate(auctionId, debtToRepay);

// collateralReceived = debtRepaid / currentPrice
// Profit if currentPrice < oraclePrice
```

## Safety Checklist

- [x] Dual oracle with fallback (Chainlink + TWAP)
- [x] Price deviation check (5% max)
- [x] Sequencer uptime check for L2s
- [x] Health factor buffer (LT > LTV)
- [x] Interest accrual before state changes
- [x] Share-based accounting (prevents rounding exploitation)
- [x] Reentrancy guards
- [x] Extensive input validation
- [x] Isolated markets (contagion prevention)
- [x] Dutch auctions (MEV resistance, fairness)

## Gas Optimizations

1. **Minimal Proxy**: 10K gas per market vs 200K
2. **Lazy Interest**: Only accrue when needed
3. **Enumerable Sets**: O(1) lookups
4. **Share-based accounting**: Prevents complex calculations
5. **View functions**: No state changes
6. **Immutable variables**: Cheaper than storage reads

