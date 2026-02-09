# Quick Start: Deploy ISM Protocol Core

## One-Line Deployment (Local)

```bash
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476c2c9c6c6fd3dbfbf68b9ff01 && \
forge script script/DeployCore.s.sol:DeployCore --rpc-url http://localhost:8545 --broadcast
```

## One-Line Deployment (Base Sepolia)

```bash
export PRIVATE_KEY=0x... && \
forge script script/DeployCore.s.sol:DeployCore --rpc-url https://sepolia.base.org --broadcast -vvv
```

## Complete Deployment Workflow

### 1. Start Local Blockchain (if testing locally)
```bash
anvil
```

### 2. Export Private Key
```bash
export PRIVATE_KEY=0x...your_key_here...
```

### 3. Run Deployment Script
```bash
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url http://localhost:8545 \
  --broadcast \
  -vvv
```

### 4. View Deployment Results
The script outputs all deployed contract addresses. Save these for next steps!

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

## What Gets Deployed

| Contract | Purpose | Config |
|----------|---------|--------|
| InterestRateModel | Calculates borrow rates | 0% base, 4% before kink, 75% after |
| OracleRouter | Price feeds (Chainlink + Uniswap) | Dual-source with safety checks |
| MarketRegistry | Track deployed markets | Empty after deployment |
| LendingPool | Lending pool implementation | Used by factory to clone |
| DutchAuctionLiquidator | MEV-resistant liquidations | 20-min auctions, 5-95% price range |
| MarketFactory | Creates isolated markets | Ready to deploy markets |

## Next: Create a Market

After deployment, create your first market:

```bash
# For WETH/USDC market with standard params:
cast send $FACTORY_ADDRESS \
  "createMarket(address,address,uint64,uint64,uint64,uint64)" \
  0x4200000000000000000000000000000000000006 \
  0x833589fCD6eDb6E08f4c7C32D4f71b3EA6957962 \
  0.75e18 \
  0.8e18 \
  0.05e18 \
  0.1e18 \
  --rpc-url http://localhost:8545 \
  --private-key $PRIVATE_KEY
```

## Supported Networks

| Network | Chain ID | Command |
|---------|----------|---------|
| Local Anvil | 31337 | `--rpc-url http://localhost:8545` |
| Base Sepolia | 84532 | `--rpc-url https://sepolia.base.org` |
| Base Mainnet | 8453 | `--rpc-url https://mainnet.base.org` |

## Dry Run (No Gas Spent)

To preview deployment without broadcasting:

```bash
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url http://localhost:8545
```

## Estimated Gas Cost

Total: ~8.9M gas
- At 1 gwei: 0.0089 ETH
- At 10 gwei: 0.089 ETH
- At 100 gwei: 0.89 ETH

## Troubleshooting

### "PRIVATE_KEY not found"
```bash
export PRIVATE_KEY=0x...
```

### "Transaction failed"
- Check account has gas funds
- Verify RPC_URL is correct
- Ensure network is running (for local anvil)

### "Chain ID not supported"
Script only supports Base Sepolia (84532), Base Mainnet (8453), and Anvil (31337).

## View Full Documentation

See `DEPLOYMENT_GUIDE.md` for comprehensive deployment guide with all options.

## Verify Deployment

Check contracts were deployed:

```bash
cast code 0x...contract_address... --rpc-url http://localhost:8545
```

If output is not `0x`, contract is deployed.
