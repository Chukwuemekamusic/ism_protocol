# Deployment Artifacts

This directory contains deployment information for ISM Protocol across different networks.

## File Structure

Each network has its own JSON file named by chain ID:

- `8453.json` - Base Mainnet
- `84532.json` - Base Sepolia
- `31337.json` - Local Anvil (development)

## JSON Schema

```json
{
  "chainId": 84532,
  "network": "base-sepolia",
  "contracts": {
    "interestRateModel": "0x...",
    "oracleRouter": "0x...",
    "marketRegistry": "0x...",
    "lendingPoolImplementation": "0x...",
    "dutchAuctionLiquidator": "0x...",
    "marketFactory": "0x...",
    "chainId": 84532,
    "deploymentTimestamp": 1234567890,
    "deployer": "0x..."
  },
  "markets": [
    {
      "pool": "0x...",
      "collateralToken": "0x...",
      "borrowToken": "0x...",
      "poolToken": "0x..."
    }
  ],
  "tokens": {
    "WETH": "0x4200000000000000000000000000000000000006",
    "USDC": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "WBTC": "0x..."
  },
  "oracles": {
    "ethUsdFeed": "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    "btcUsdFeed": "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
    "usdcUsdFeed": "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B"
  }
}
```

## Supported Chains

- **Base Mainnet** (8453): `8453.json`
- **Base Sepolia** (84532): `84532.json` _(gitignored - for local testing only)_
- **Anvil Local** (31337): `31337.json` _(gitignored - for local testing only)_

## Usage

### From Solidity (Foundry Scripts)

```solidity
import {DeploymentHelper} from "script/DeploymentHelper.sol";

contract MyScript is DeploymentHelper {
    function run() external {
        // Load deployment for current chain
        CoreDeployment memory deployment = loadDeployment();

        // Access contract addresses
        address factory = deployment.marketFactory;
        address oracle = deployment.oracleRouter;
    }
}
```

### From TypeScript/JavaScript (Liquidation Bot)

```typescript
import deployment from "../deployments/84532.json";

const marketFactory = deployment.contracts.marketFactory;
const oracleRouter = deployment.contracts.oracleRouter;
const wethAddress = deployment.tokens.WETH;
```

### From Python

```python
import json

with open('../deployments/84532.json') as f:
    deployment = json.load(f)

market_factory = deployment['contracts']['marketFactory']
oracle_router = deployment['contracts']['oracleRouter']
```

## Updating Deployments

Deployments are automatically updated when running deployment scripts:

```bash
# Deploy core contracts (creates/updates the JSON file)
cd contracts
forge script script/DeployCore.s.sol --rpc-url $RPC_URL --broadcast

# Deploy a new market (adds to markets array)
forge script script/DeployMarket.s.sol --rpc-url $RPC_URL --broadcast
```

## Network Information

### Base Mainnet (8453)

- RPC: https://mainnet.base.org
- Explorer: https://basescan.org

### Base Sepolia (84532)

- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org
- Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### Local Anvil (31337)

- RPC: http://localhost:8545
- Start with: `anvil`

## Important Notes

1. **Never commit private keys** - Only deployment addresses are stored here
2. **Verify addresses** - Always verify contract addresses on block explorer before use
3. **Backup** - Keep backups of deployment files before redeploying
4. **Git tracking** - These files are tracked in git for team coordination
5. **Monorepo structure** - This folder is shared between `contracts/` and `liquidation-bot/`
