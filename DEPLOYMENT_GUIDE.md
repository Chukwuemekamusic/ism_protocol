# ISM Protocol Deployment Guide

This guide explains how to deploy the ISM Protocol core infrastructure using the `DeployCore.s.sol` script.

## Overview

The `DeployCore` script automates the deployment of all core ISM Protocol contracts in the correct dependency order:

1. **Standalone Contracts** (no dependencies)
   - InterestRateModel
   - OracleRouter
   - MarketRegistry
   - LendingPool (implementation)

2. **Dependent Contracts**
   - DutchAuctionLiquidator (depends on OracleRouter)
   - MarketFactory (depends on all above)

3. **Post-Deployment Configuration**
   - Authorize MarketFactory in MarketRegistry

## Prerequisites

- Foundry installed (`forge` and `cast` CLI)
- Private key with sufficient funds for gas
- RPC endpoint for target network (Base Mainnet or Base Sepolia)

## Deployment Steps

### 1. Set Environment Variables

```bash
# Export your private key (use a secure method in production)
export PRIVATE_KEY=0x...your_private_key_here...

# Export RPC URL
export RPC_URL=https://mainnet.base.org  # Base Mainnet
# or
export RPC_URL=https://sepolia.base.org  # Base Sepolia
```

### 2. Deploy to Local Network (Testing)

For local testing with Anvil:

```bash
# Start local blockchain
anvil

# In another terminal, deploy (chain ID 31337)
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476c2c9c6c6fd3dbfbf68b9ff01
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url http://localhost:8545 \
  --broadcast
```

### 3. Deploy to Base Sepolia (Testnet)

```bash
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  -vvv
```

### 4. Deploy to Base Mainnet (Production)

```bash
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify \
  -vvv
```

## Script Flags Explained

- `--rpc-url`: RPC endpoint for target network
- `--broadcast`: Actually execute the transactions (without this, it's a dry run)
- `--verify`: Verify contracts on Etherscan (requires ETHERSCAN_API_KEY)
- `-vvv`: Very verbose output (shows detailed logs)
- `--slow`: Slower broadcast for more stable connections
- `--legacy`: Use legacy transaction format (for older networks)

## Configuration

The script uses hardcoded default parameters that can be modified in `DeployCore.s.sol`:

### Interest Rate Model
```solidity
BASE_RATE_PER_YEAR = 0;           // 0% base rate
SLOPE_BEFORE_KINK = 0.04e18;      // 4% per year
SLOPE_AFTER_KINK = 0.75e18;       // 75% per year
KINK = 0.8e18;                    // 80% utilization threshold
```

### Dutch Auction Configuration
```solidity
AUCTION_DURATION = 1200;          // 20 minutes
START_PREMIUM = 1.05e18;          // 105% of oracle price
END_DISCOUNT = 0.95e18;           // 95% of oracle price
CLOSE_FACTOR = 0.5e18;            // 50% max debt liquidatable
```

### Sequencer Uptime Feed (Chain-Specific)
- **Base Mainnet**: `0xbCf85224fC0756b9Fa45Aa7892130B8Ac4eda50a`
- **Base Sepolia**: `0x07f2985C78CD78f585880c1b8c1e1AB6F9C76D79`
- **Local (Anvil)**: `address(0)` (will need to mock in tests)

## Expected Deployment Order

The script deploys contracts in this order:

1. ✓ InterestRateModel (0% base, 4% before kink, 75% after kink)
2. ✓ OracleRouter (with chain-specific sequencer feed)
3. ✓ MarketRegistry (empty, awaiting markets)
4. ✓ LendingPool implementation (proxy target)
5. ✓ DutchAuctionLiquidator (20-min auctions, 5-95% price range)
6. ✓ MarketFactory (with all dependencies)
7. ✓ Configure permissions (authorize factory in registry)

## Deployed Contract Addresses

After successful deployment, the script logs all contract addresses:

```
========== Deployed Contract Addresses ==========
InterestRateModel:       0x...
OracleRouter:            0x...
MarketRegistry:          0x...
LendingPool (impl):      0x...
DutchAuctionLiquidator:  0x...
MarketFactory:           0x...
==================================================
```

**Save these addresses!** You'll need them for:
- Creating markets
- Configuring oracle feeds
- Verifying contracts on Etherscan

## Post-Deployment Steps

### 1. Configure Oracle Feeds

For each token you want to use (e.g., WETH, USDC):

```bash
cast send <ORACLE_ROUTER_ADDRESS> \
  "setOracleConfig(address,tuple)" \
  <TOKEN_ADDRESS> \
  "(address,address,uint32,uint96,bool)" \
  <CHAINLINK_FEED> \
  <UNISWAP_POOL> \
  1800 \
  3600 \
  true \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

**Example for WETH on Base Mainnet:**
```bash
CHAINLINK_FEED=0x71041dddad3287f51e339636648f4ba3f7e15947
UNISWAP_POOL=0xc1d3fac6ae3042e0b3d58cfe37039941a61adf17
TOKEN=0x4200000000000000000000000000000000000006  # WETH

cast send 0x... \
  "setOracleConfig(address,(address,address,uint32,uint96,bool))" \
  $TOKEN \
  "($CHAINLINK_FEED,$UNISWAP_POOL,1800,3600,true)" \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### 2. Create Markets

Once oracle feeds are configured, create isolated markets:

```bash
cast send <MARKET_FACTORY_ADDRESS> \
  "createMarket(address,address,uint64,uint64,uint64,uint64)" \
  <COLLATERAL_TOKEN> \
  <BORROW_TOKEN> \
  0.75e18 \
  0.8e18 \
  0.05e18 \
  0.1e18 \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

**Example for WETH/USDC market:**
```bash
cast send <MARKET_FACTORY> \
  "createMarket(address,address,uint64,uint64,uint64,uint64)" \
  0x4200000000000000000000000000000000000006 \
  0x833589fCD6eDb6E08f4c7C32D4f71b3EA6957962 \
  0.75e18 \
  0.8e18 \
  0.05e18 \
  0.1e18 \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3. Authorize Pools in Liquidator

After creating markets, authorize them in the liquidator:

```bash
cast send <LIQUIDATOR_ADDRESS> \
  "authorizePool(address,bool)" \
  <POOL_ADDRESS> \
  true \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

## Troubleshooting

### "Private key not found"
Make sure `PRIVATE_KEY` environment variable is set:
```bash
export PRIVATE_KEY=0x...
```

### "Chain ID not supported"
The script supports:
- 8453 (Base Mainnet)
- 84532 (Base Sepolia)
- 31337 (Local Anvil)

For other networks, modify the `getSequencerUptimeFeed()` function.

### "Transaction failed: insufficient balance"
Your account doesn't have enough gas funds. Use a faucet to get testnet funds:
- Base Sepolia Faucet: https://www.alchemy.com/faucets/base-sepolia

### "Sequencer feed not available"
On local networks (chain ID 31337), the script returns `address(0)` for the sequencer feed. You'll need to mock it in tests.

## Gas Estimates

Approximate gas costs for deployment:

| Contract | Gas | Cost (at 1 gwei) |
|----------|-----|-----------------|
| InterestRateModel | 156K | 0.000156 ETH |
| OracleRouter | 1.2M | 0.0012 ETH |
| MarketRegistry | 384K | 0.000384 ETH |
| LendingPool (impl) | 2.8M | 0.0028 ETH |
| DutchAuctionLiquidator | 1.1M | 0.0011 ETH |
| MarketFactory | 2.2M | 0.0022 ETH |
| **Total** | **8.9M** | **0.0089 ETH** |

Actual costs vary based on network congestion. Use `forge script --estimate` for accurate local estimates.

## Verification

To verify deployed contracts on Etherscan:

```bash
forge verify-contract <CONTRACT_ADDRESS> <CONTRACT_NAME> \
  --constructor-args <CONSTRUCTOR_ARGS_ENCODED> \
  --compiler-version 0.8.24 \
  --chain-id 8453
```

Example:
```bash
# Verify InterestRateModel
CONSTRUCTOR_ARGS=$(cast abi-encode \
  "constructor(uint256,uint256,uint256,uint256)" \
  0 \
  0.04e18 \
  0.75e18 \
  0.8e18)

forge verify-contract 0x... InterestRateModel \
  --constructor-args $CONSTRUCTOR_ARGS \
  --compiler-version 0.8.24 \
  --chain-id 8453
```

## Advanced: Custom Deployment Script

To customize parameters, modify `script/DeployCore.s.sol`:

```solidity
// Change interest rate model parameters
uint256 constant BASE_RATE_PER_YEAR = 0.01e18;  // 1% instead of 0%
uint256 constant SLOPE_BEFORE_KINK = 0.05e18;   // 5% instead of 4%

// Change auction duration
uint64 constant AUCTION_DURATION = 1800;  // 30 minutes instead of 20
```

Then redeploy:
```bash
forge script script/DeployCore.s.sol:DeployCore --broadcast
```

## Monitoring Deployment

To watch the deployment transaction:

```bash
# Get transaction hash from script output
TX_HASH=0x...

# Check status
cast tx $TX_HASH --rpc-url $RPC_URL

# Get receipt
cast receipt $TX_HASH --rpc-url $RPC_URL
```

## Next Steps

After deployment:

1. Configure oracle feeds for your tokens
2. Create isolated markets (WETH/USDC, etc.)
3. Test deposits and borrows
4. Set up liquidation bots
5. Monitor interest accrual

See the main README.md for usage examples.
