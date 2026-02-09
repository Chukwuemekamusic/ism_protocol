# Deployment Files Index

## Core Deployment Script

### **script/DeployCore.s.sol** (232 lines)
The main Foundry deployment script that automates ISM Protocol core infrastructure deployment.

**What it does:**
- Deploys 6 core contracts in correct dependency order
- Configures all parameters (interest rates, auction settings, etc.)
- Detects network and sets appropriate oracle feeds
- Logs all contract addresses
- Sets up post-deployment permissions

**Key features:**
- Supports Base Mainnet, Base Sepolia, and local Anvil
- Chain-specific sequencer uptime feed configuration
- Comprehensive logging at each step
- Hardcoded sensible defaults
- Environment variable for private key (PRIVATE_KEY)

**Usage:**
```bash
export PRIVATE_KEY=0x...
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url http://localhost:8545 \
  --broadcast
```

---

## Documentation Files

### **DEPLOYMENT_SUMMARY.md** (This is the executive summary)
High-level overview of the deployment system with:
- Architecture diagram
- Default configuration values
- Quick command reference
- Gas estimates
- Post-deployment checklist
- Network support table

**Best for:** Quick understanding of the deployment system

### **DEPLOYMENT_GUIDE.md** (330 lines - Comprehensive reference)
Complete deployment guide covering:
- Prerequisites and setup
- Step-by-step deployment instructions
- Network-specific commands (local, testnet, mainnet)
- All configuration options
- Post-deployment oracle and market setup
- Troubleshooting section
- Gas cost analysis
- Contract verification instructions
- Advanced customization

**Best for:** Complete walkthrough and reference

### **DEPLOY_QUICK_START.md** (120 lines - Quick reference)
Concise quick-start guide with:
- One-line deployment commands
- Supported networks
- Dry-run instructions
- Basic troubleshooting
- Next steps

**Best for:** Rapid deployment without reading full docs

---

## Implementation Details

### Contract Deployment Order

**STEP 1: Standalone Contracts (no dependencies)**
1. InterestRateModel
   - Configuration: 0% base, 4% before kink, 75% after kink, 80% kink
   
2. OracleRouter
   - Configuration: Chain-specific sequencer uptime feed
   
3. MarketRegistry
   - Configuration: None (empty on deployment)
   
4. LendingPool (implementation)
   - Configuration: None (serves as proxy implementation)

**STEP 2: Dependent Contracts**
5. DutchAuctionLiquidator
   - Dependencies: OracleRouter
   - Configuration: 20-min duration, 105% premium, 95% discount, 50% close factor
   
6. MarketFactory
   - Dependencies: All above contracts
   - Configuration: References to all deployed contracts

**STEP 3: Post-Deployment**
7. Configure Permissions
   - Authorize MarketFactory in MarketRegistry

### Default Parameters

**Interest Rate Model**
```
Base Rate:      0% per year
Slope (0-80%):  4% per year
Slope (80-100%): 75% per year
Kink:           80% utilization
```

**Dutch Auction**
```
Duration:       1200 seconds (20 minutes)
Start Price:    105% of oracle price
End Price:      95% of oracle price
Close Factor:   50% (max 50% of debt can be liquidated)
```

**Oracle Feeds (by network)**
```
Base Mainnet (8453):   0xbCf85224fC0756b9Fa45Aa7892130B8Ac4eda50a
Base Sepolia (84532):  0x07f2985C78CD78f585880c1b8c1e1AB6F9C76D79
Anvil Local (31337):   address(0)
```

---

## File Size Summary

| File | Lines | Size | Purpose |
|------|-------|------|---------|
| DeployCore.s.sol | 232 | ~8 KB | Deployment script |
| DEPLOYMENT_SUMMARY.md | 250+ | ~12 KB | Executive summary |
| DEPLOYMENT_GUIDE.md | 330+ | ~16 KB | Complete reference |
| DEPLOY_QUICK_START.md | 120+ | ~6 KB | Quick reference |
| **TOTAL** | **900+** | **~42 KB** | Complete deployment system |

---

## Quick Navigation

### I want to...

**Deploy immediately**
→ Read: DEPLOY_QUICK_START.md

**Understand the system**
→ Read: DEPLOYMENT_SUMMARY.md + script/DeployCore.s.sol

**Deploy with full reference**
→ Read: DEPLOYMENT_GUIDE.md + DEPLOYMENT_SUMMARY.md

**Customize deployment**
→ Edit: script/DeployCore.s.sol constants, then redeploy

**Troubleshoot issues**
→ Check: DEPLOYMENT_GUIDE.md → Troubleshooting section

**Setup oracle feeds after deployment**
→ Read: DEPLOYMENT_GUIDE.md → Post-Deployment Steps

**Create markets after core deployment**
→ Read: DEPLOYMENT_GUIDE.md → Post-Deployment Steps → Create Markets

---

## Environment Variables

The deployment script requires:

```bash
# Required
export PRIVATE_KEY=0x...        # Private key for deployment account

# Optional (if not set, defaults to standard endpoints)
export RPC_URL=...              # RPC endpoint (passed via --rpc-url flag)
```

---

## Network Endpoints

### Public RPC Endpoints

**Base Mainnet**
- https://mainnet.base.org
- https://base.publicnode.com

**Base Sepolia**
- https://sepolia.base.org
- https://base-sepolia.publicnode.com

**Local (Anvil)**
- http://localhost:8545

---

## Common Commands

### Deploy (all variants)

```bash
# Local (Anvil)
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476c2c9c6c6fd3dbfbf68b9ff01
forge script script/DeployCore.s.sol:DeployCore --rpc-url http://localhost:8545 --broadcast

# Base Sepolia
export PRIVATE_KEY=0x...
forge script script/DeployCore.s.sol:DeployCore --rpc-url https://sepolia.base.org --broadcast -vvv

# Base Mainnet
export PRIVATE_KEY=0x...
forge script script/DeployCore.s.sol:DeployCore --rpc-url https://mainnet.base.org --broadcast -vvv

# Dry run (no gas spent)
forge script script/DeployCore.s.sol:DeployCore --rpc-url http://localhost:8545
```

### After Deployment

```bash
# Configure oracle feed
cast send $ORACLE_ROUTER "setOracleConfig(address,(address,address,uint32,uint96,bool))" \
  $TOKEN_ADDRESS "($CHAINLINK_FEED,$UNISWAP_POOL,1800,3600,true)"

# Create market
cast send $FACTORY "createMarket(address,address,uint64,uint64,uint64,uint64)" \
  $COLLATERAL $BORROW 0.75e18 0.8e18 0.05e18 0.1e18

# Check contract is deployed
cast code $ADDRESS --rpc-url http://localhost:8545
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 Foundry Script Environment                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  script/DeployCore.s.sol (232 lines)                │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ STEP 1: Standalone Contracts                   │  │  │
│  │  │ • InterestRateModel (0%,4%,75%,80%)           │  │  │
│  │  │ • OracleRouter (sequencer feed)                │  │  │
│  │  │ • MarketRegistry (empty)                       │  │  │
│  │  │ • LendingPool implementation                   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ STEP 2: Dependent Contracts                    │  │  │
│  │  │ • DutchAuctionLiquidator (needs OracleRouter) │  │  │
│  │  │ • MarketFactory (needs all above)             │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ STEP 3: Configure Permissions                  │  │  │
│  │  │ • Authorize MarketFactory in Registry         │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓
    forge script execution
         ↓
┌─────────────────────────────────────────────────────────────┐
│              Deployed Contract Addresses                    │
├─────────────────────────────────────────────────────────────┤
│ • InterestRateModel       → 0x...                           │
│ • OracleRouter            → 0x...                           │
│ • MarketRegistry          → 0x...                           │
│ • LendingPool impl        → 0x...                           │
│ • DutchAuctionLiquidator  → 0x...                           │
│ • MarketFactory           → 0x...                           │
└─────────────────────────────────────────────────────────────┘
         ↓
   Ready for market creation!
```

---

## Next Steps After Deployment

1. **Configure Oracle Feeds**
   - Document: DEPLOYMENT_GUIDE.md → Configure Oracle Feeds
   - For each token: Set Chainlink + Uniswap prices

2. **Create Markets**
   - Document: DEPLOYMENT_GUIDE.md → Create Markets
   - For each pair: Initialize isolated market

3. **Start Protocol Operations**
   - Users deposit to earn interest
   - Users borrow against collateral
   - Liquidations via Dutch auction

---

## Support & Troubleshooting

See DEPLOYMENT_GUIDE.md for:
- Detailed error messages and solutions
- Network-specific issues
- RPC connection problems
- Gas cost issues
- Contract verification help

---

**Version:** 1.0
**Last Updated:** February 5, 2026
**Status:** Production Ready
