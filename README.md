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

### Quick Deploy

For immediate deployment with default parameters:

```bash
# 1. Start local node (if testing locally)
anvil

# 2. In another terminal, set private key
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476c2c9c6c6fd3dbfbf68b9ff01

# 3. Deploy core infrastructure
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url http://localhost:8545 \
  --broadcast
```

### Full Deployment Documentation

For comprehensive deployment guides and detailed instructions:

- **[DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)** - One-line commands for rapid deployment
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete guide with all options
- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - Architecture and configuration overview
- **[DEPLOYMENT_FILES_INDEX.md](DEPLOYMENT_FILES_INDEX.md)** - Navigation guide for deployment docs

### Supported Networks

| Network | Chain ID | Command |
|---------|----------|---------|
| Local Anvil | 31337 | `--rpc-url http://localhost:8545` |
| Base Sepolia | 84532 | `--rpc-url https://sepolia.base.org` |
| Base Mainnet | 8453 | `--rpc-url https://mainnet.base.org` |

### Deployment Steps

1. **Deploy Core Infrastructure**
   ```bash
   forge script script/DeployCore.s.sol:DeployCore --rpc-url $RPC_URL --broadcast
   ```
   Deploys: InterestRateModel, OracleRouter, MarketRegistry, LendingPool, DutchAuctionLiquidator, MarketFactory

2. **Configure Oracle Feeds**
   ```bash
   cast send $ORACLE_ROUTER "setOracleConfig(address,(address,address,uint32,uint96,bool))" \
     $TOKEN_ADDRESS "($CHAINLINK_FEED,$UNISWAP_POOL,1800,3600,true)"
   ```

3. **Create Markets**
   ```bash
   cast send $FACTORY "createMarket(address,address,uint64,uint64,uint64,uint64)" \
     $COLLATERAL $BORROW 0.75e18 0.8e18 0.05e18 0.1e18
   ```

4. **Start Using Protocol**
   - Users deposit to earn interest
   - Borrowers deposit collateral and borrow
   - Liquidators call liquidations via Dutch auction

## Core Contracts

| Contract | Purpose | File |
|----------|---------|------|
| **LendingPool** | Isolated lending market | src/core/LendingPool.sol |
| **PoolToken** | ERC20 receipt token (shares) | src/core/PoolToken.sol |
| **InterestRateModel** | Kinked interest rate calculation | src/core/InterestRateModel.sol |
| **OracleRouter** | Dual-oracle price feeds | src/core/OracleRouter.sol |
| **DutchAuctionLiquidator** | MEV-resistant liquidations | src/core/DutchAuctionLiquidator.sol |
| **MarketFactory** | Creates isolated markets | src/core/MarketFactory.sol |
| **MarketRegistry** | Tracks deployed markets | src/core/MarketRegistry.sol |

## Key Design Decisions

### Isolated Markets
Each collateral/borrow pair operates independently. A collapse in one asset doesn't affect others.

### Share-Based Accounting
Supplies tracked as shares that appreciate as interest accrues. Prevents rounding exploitation and auto-distributes interest.

### Dual Oracle System
- **Primary**: Chainlink Aggregator V3 (trusted source)
- **Fallback**: Uniswap V3 TWAP (30-min window)
- **Safety**: Deviation checks, staleness checks, sequencer uptime checks

### Dutch Auction Liquidations
- Price starts high (105% premium) and descends to low (95% discount)
- Fair price discovery with no MEV extraction
- Borrowers have time to self-liquidate at favorable prices

### Minimal Proxy Pattern
Markets deployed as minimal proxies (95% gas savings):
- Single LendingPool implementation deployed once
- Each market uses lightweight proxy pointing to implementation
- ~10K gas per market vs 400K+ for full contract

## Risk Parameters

These can be customized per market:

- **LTV** (Loan-to-Value): Max borrow as % of collateral (default: 75%)
- **Liquidation Threshold**: HF threshold for liquidation (default: 80%)
- **Liquidation Penalty**: Bonus for liquidators (default: 5%)
- **Reserve Factor**: Protocol fee on interest (default: 10%)

## Contributing

Contributions welcome! Please:

1. Review [CLAUDE.md](CLAUDE.md) for development guidelines
2. Follow existing code style and patterns
3. Add tests for new features
4. Update documentation
5. Submit pull request

## Security

This is an educational protocol. **Do not use in production without professional security audit.**

For security concerns, please report responsibly to the team.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Solidity Docs](https://docs.soliditylang.org/)
- [Base L2 Docs](https://docs.base.org/)
- [Compound Finance](https://compound.finance/) - Inspiration for design patterns

## Support

For questions or issues:

1. Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for deployment issues
2. Review [CLAUDE.md](CLAUDE.md) for architecture details
3. See test files in `test/` for usage examples
4. Open an issue on GitHub
