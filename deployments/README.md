# Deployment Addresses

This directory contains deployment addresses for ISM Protocol across different chains.

## File Format

Each file is named `{chainId}.json` and contains:

```json
{
  "interestRateModel": "0x...",
  "oracleRouter": "0x...",
  "marketRegistry": "0x...",
  "lendingPoolImplementation": "0x...",
  "dutchAuctionLiquidator": "0x...",
  "marketFactory": "0x...",
  "chainId": 84532,
  "deploymentTimestamp": 1234567890,
  "deployer": "0x...",
  "baseRatePerYear": 0,
  "slopeBeforeKink": "40000000000000000",
  "slopeAfterKink": "750000000000000000",
  "kink": "800000000000000000",
  "auctionDuration": 1200,
  "startPremium": "1050000000000000000",
  "endDiscount": "950000000000000000",
  "closeFactor": "500000000000000000"
}
```

## Supported Chains

- **Base Mainnet** (8453): `8453.json`
- **Base Sepolia** (84532): `84532.json` *(gitignored - for local testing only)*
- **Anvil Local** (31337): `31337.json` *(gitignored - for local testing only)*

## Usage in Scripts

### Import the helper

```solidity
import {DeploymentHelper} from "./DeploymentHelper.sol";

contract MyScript is DeploymentHelper {
    function run() external {
        // Load deployment for current chain
        CoreDeployment memory deployment = loadDeployment();

        // Access addresses
        address factory = deployment.marketFactory;
        address oracle = deployment.oracleRouter;

        // ... use addresses
    }
}
```

### Check if deployment exists

```solidity
if (!deploymentExists()) {
    revert("Core contracts not deployed on this chain");
}
```

## Deployment Process

1. **Deploy core contracts**:
   ```bash
   forge script script/DeployCore.s.sol --rpc-url base-sepolia --broadcast --verify
   ```

2. **Addresses automatically saved** to `deployments/{chainId}.json`

3. **Deploy markets using saved addresses**:
   ```bash
   forge script script/DeployMarket.s.sol --rpc-url base-sepolia --broadcast
   ```

## Git Strategy

- **Mainnet deployments** (8453.json): Committed to git for reference
- **Testnet/local** (84532.json, 31337.json): Gitignored, regenerated on each deployment

## Example Output

After running `DeployCore.s.sol`:

```
========== Deployment Complete ==========
InterestRateModel:       0x...
OracleRouter:            0x...
MarketRegistry:          0x...
LendingPool (impl):      0x...
DutchAuctionLiquidator:  0x...
MarketFactory:           0x...
==================================================

[OK] Deployment addresses saved to: deployments/84532.json
```
