# Isolated Lending Protocol

A decentralized lending protocol with isolated markets, built on Base.

![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)
![Foundry](https://img.shields.io/badge/Foundry-latest-orange)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

The Isolated Lending Protocol allows users to:

- **Supply** assets to earn interest
- **Borrow** assets against collateral
- **Liquidate** underwater positions via Dutch auctions

Each collateral/borrow pair operates as an **isolated market**, preventing contagion between assets.

## Features

✅ **Isolated Markets** - Risk contained per market  
✅ **Dual Oracle System** - Chainlink + Uniswap TWAP fallback  
✅ **Dutch Auction Liquidations** - Fair, MEV-resistant liquidations  
✅ **Gas Optimized** - Minimal proxy pattern for market deployment  
✅ **L2 Optimized** - Built for Base with sequencer checks

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Git](https://git-scm.com/)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/isolated-lending-protocol
cd isolated-lending-protocol

# Install dependencies
forge install

# Build
forge build

# Test
forge test
```

### Local Development

```bash
# Start local node
anvil

# Deploy (in another terminal)
forge script script/DeployCore.s.sol --rpc-url http://localhost:8545 --broadcast
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 SHARED INFRASTRUCTURE                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ OracleRouter│ │InterestRate │ │  Liquidator     │   │
│  │             │ │   Model     │ │  (Dutch Auction)│   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐                        │
│  │MarketFactory│ │MarketRegistry                       │
│  └─────────────┘ └─────────────┘                        │
└───────────────────────────┬─────────────────────────────┘
                            │ creates
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   ISOLATED MARKETS                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ WETH/USDC   │ │ WBTC/USDC   │ │ ARB/USDC    │       │
│  │ LendingPool │ │ LendingPool │ │ LendingPool │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## Usage

### For Suppliers

```solidity
// Approve and deposit USDC to earn interest
usdc.approve(pool, amount);
pool.deposit(amount);

// Withdraw with earned interest
pool.withdraw(amount);
```

### For Borrowers

```solidity
// Deposit collateral
weth.approve(pool, collateralAmount);
pool.depositCollateral(collateralAmount);

// Borrow against collateral (up to 75% LTV)
pool.borrow(borrowAmount);

// Repay debt
usdc.approve(pool, repayAmount);
pool.repay(repayAmount);

// Withdraw collateral (if healthy)
pool.withdrawCollateral(amount);
```

### For Liquidators

```solidity
// Start auction for underwater position
liquidator.startAuction(pool, user);

// Wait for favorable price, then liquidate
usdc.approve(liquidator, amount);
liquidator.liquidate(auctionId, maxDebtToRepay);
```

## Default Parameters

| Parameter             | Value  | Description                   |
| --------------------- | ------ | ----------------------------- |
| LTV                   | 75%    | Max borrow as % of collateral |
| Liquidation Threshold | 80%    | HF threshold for liquidation  |
| Liquidation Penalty   | 5%     | Bonus for liquidators         |
| Reserve Factor        | 10%    | Protocol fee on interest      |
| Auction Duration      | 20 min | Dutch auction length          |
| Start Premium         | 105%   | Auction start price           |
| End Discount          | 95%    | Auction end price             |

## Testing

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_deposit_basic

# Run invariant tests
forge test --match-path test/invariant/

# Gas report
forge test --gas-report

# Coverage
forge coverage
```

## Deployment

See [Deployment Guide](https://github.com/ism-protocol/ism-protocol/blob/main/ism_protocol/DEPLOYMENT.md)
