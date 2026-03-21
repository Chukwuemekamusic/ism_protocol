# ISM Protocol - Testnet Deployment Info

Quick reference for Base Sepolia testnet deployment addresses, faucets, and tools.

---

## Network Details

| Parameter | Value |
|-----------|-------|
| **Network Name** | Base Sepolia |
| **Chain ID** | `84532` |
| **RPC URL** | `https://sepolia.base.org` |
| **Alternative RPC** | `https://base-sepolia.blockpi.network/v1/rpc/public` |
| **Currency** | ETH |
| **Block Explorer** | https://sepolia.basescan.org |
| **Faucet** | https://www.coinbase.com/faucets/base-ethereum-goerli-faucet |

---

## Deployed Contracts

**Deployment Date**: December 16, 2024
**Deployer**: `0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38`

### Core Infrastructure

| Contract | Address | Basescan |
|----------|---------|----------|
| **MarketFactory** | `0x403276c627737cAb896BbdDEfEd4538d9a6aE5C0` | [View](https://sepolia.basescan.org/address/0x403276c627737cAb896BbdDEfEd4538d9a6aE5C0) |
| **MarketRegistry** | `0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4` | [View](https://sepolia.basescan.org/address/0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4) |
| **OracleRouter** | `0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97` | [View](https://sepolia.basescan.org/address/0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97) |
| **InterestRateModel** | `0x414219E850F9cD7352a56E763DddDE2900128ac4` | [View](https://sepolia.basescan.org/address/0x414219E850F9cD7352a56E763DddDE2900128ac4) |
| **DutchAuctionLiquidator** | `0x7514D0B0883cfCb2f7Cc5AeB512D9c5ab91160E2` | [View](https://sepolia.basescan.org/address/0x7514D0B0883cfCb2f7Cc5AeB512D9c5ab91160E2) |
| **LendingPool Implementation** | `0x72B10a8F2570776c28788652d8b575bD7236796c` | [View](https://sepolia.basescan.org/address/0x72B10a8F2570776c28788652d8b575bD7236796c) |

---

## Markets

### Market 1: WETH/USDC

**Description**: Supply WETH, borrow USDC

| Component | Address | Basescan |
|-----------|---------|----------|
| **LendingPool** | `0x2C201C3FCdB6073d0f895D29bf8F8A93d2D67A0E` | [View](https://sepolia.basescan.org/address/0x2C201C3FCdB6073d0f895D29bf8F8A93d2D67A0E) |
| **PoolToken** | `0x1f29083bb3C003170C6CD0eC53CB7958cBF43341` | [View](https://sepolia.basescan.org/address/0x1f29083bb3C003170C6CD0eC53CB7958cBF43341) |
| **Collateral Token** | WETH (`0x4200000000000000000000000000000000000006`) | 18 decimals |
| **Borrow Token** | USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) | 6 decimals |

### Market 2: USDC/WETH

**Description**: Supply USDC, borrow WETH

| Component | Address | Basescan |
|-----------|---------|----------|
| **LendingPool** | `0xcACCE60e4D87B077B2fe1e63c2e8B0dc234dc905` | [View](https://sepolia.basescan.org/address/0xcACCE60e4D87B077B2fe1e63c2e8B0dc234dc905) |
| **PoolToken** | TBD | - |
| **Collateral Token** | USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) | 6 decimals |
| **Borrow Token** | WETH (`0x4200000000000000000000000000000000000006`) | 18 decimals |

---

## Tokens

### Test Tokens

| Token | Address | Decimals | Basescan |
|-------|---------|----------|----------|
| **WETH** | `0x4200000000000000000000000000000000000006` | 18 | [View](https://sepolia.basescan.org/address/0x4200000000000000000000000000000000000006) |
| **USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 | [View](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |

### How to Get Test Tokens

#### Option 1: Wrap ETH to WETH

1. Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Interact with WETH contract:
   - Go to [WETH on Basescan](https://sepolia.basescan.org/address/0x4200000000000000000000000000000000000006#writeContract)
   - Connect wallet
   - Call `deposit()` with amount (in wei, e.g., `1000000000000000000` = 1 WETH)
   - Confirm transaction

#### Option 2: Mint Test USDC

**Note**: The USDC contract at the address above may not have a public mint function. Check the contract on Basescan to see available functions.

If minting isn't available, you can:
1. Ask in GitHub Discussions for test tokens
2. Swap WETH for USDC on a testnet DEX (if available on Base Sepolia)
3. Supply WETH to borrow USDC from ISM Protocol itself!

---

## Oracle Feeds

### Chainlink Price Feeds

| Pair | Address | Basescan |
|------|---------|----------|
| **ETH/USD** | `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1` | [View](https://sepolia.basescan.org/address/0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1) |
| **USDC/USD** | `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165` | [View](https://sepolia.basescan.org/address/0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165) |
| **BTC/USD** | `0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298` | [View](https://sepolia.basescan.org/address/0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298) |

**Note**: TWAP fallback currently disabled on testnet. Chainlink-only oracle in use.

---

## Frontend & APIs

### Deployed Frontend

**URL**: [Insert your Vercel deployment URL here]

Example: `https://ism-protocol.vercel.app`

### Subgraph API

**Endpoint**:
```
https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest
```

**Dashboard**: [The Graph Studio](https://thegraph.com/studio/subgraph/ism-protocol/)

**Example Query**:
```graphql
query {
  markets {
    id
    totalSupply
    totalBorrow
    utilization
  }
}
```

---

## Useful Tools

### Block Explorers

- **Basescan**: https://sepolia.basescan.org
- **Blockscout**: https://base-sepolia.blockscout.com

### Faucets

- **Base Sepolia ETH**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Alternative Faucet**: https://base-sepolia-faucet.pk910.de

### RPC Providers

- **Public RPC**: `https://sepolia.base.org` (rate limited)
- **Alternative**: `https://base-sepolia.blockpi.network/v1/rpc/public`
- **Alchemy** (recommended for developers): https://www.alchemy.com/base
- **Infura**: https://www.infura.io

### Development Tools

- **Foundry**: https://book.getfoundry.sh
- **Hardhat**: https://hardhat.org
- **Remix IDE**: https://remix.ethereum.org
- **The Graph**: https://thegraph.com/studio

---

## Risk Parameters

Current configuration for all markets:

| Parameter | Value | Description |
|-----------|-------|-------------|
| **LTV** | 75% | Maximum borrow relative to collateral |
| **Liquidation Threshold** | 80% | Health factor < 1.0 triggers liquidation |
| **Liquidation Penalty** | 5% | Bonus for liquidators |
| **Reserve Factor** | 10% | Protocol fee on interest |

### Interest Rate Model

**Kinked Rate Model**:
- Base Rate: 0%
- Slope (0-80% utilization): 5% per 100% utilization
- Slope (80-100% utilization): 75% per 20% utilization
- Kink: 80%

**Example Rates**:
- 0% utilization: 0% APY
- 50% utilization: 2.5% APY
- 80% utilization: 4% APY
- 90% utilization: 41.5% APY
- 95% utilization: 60% APY

---

## Example Transactions

### Successful Transactions

You can view example transactions on Basescan to understand how to interact with the protocol:

**Supply Transaction**:
- [Example TX](https://sepolia.basescan.org) (replace with actual TX hash)

**Borrow Transaction**:
- [Example TX](https://sepolia.basescan.org) (replace with actual TX hash)

**Repay Transaction**:
- [Example TX](https://sepolia.basescan.org) (replace with actual TX hash)

**Liquidation**:
- [Example TX](https://sepolia.basescan.org) (replace with actual TX hash)

---

## Contract ABIs

ABIs are available in the repository at:

```
contracts/out/[ContractName].sol/[ContractName].json
```

**Key ABIs**:
- LendingPool: `contracts/out/LendingPool.sol/LendingPool.json`
- MarketFactory: `contracts/out/MarketFactory.sol/MarketFactory.json`
- MarketRegistry: `contracts/out/MarketRegistry.sol/MarketRegistry.json`
- OracleRouter: `contracts/out/OracleRouter.sol/OracleRouter.json`
- DutchAuctionLiquidator: `contracts/out/DutchAuctionLiquidator.sol/DutchAuctionLiquidator.json`

Or use the deployment JSON:
```typescript
import deployments from './deployments/84532.json';
```

---

## Getting Help

### Documentation

- **User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)
- **Developer Guide**: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **FAQ**: [FAQ.md](./FAQ.md)

### Support

- **GitHub Issues**: [Report bugs](https://github.com/Chukwuemekamusic/ism_protocol/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/Chukwuemekamusic/ism_protocol/discussions)

---

## Quick Start Commands

### Using cast (Foundry)

```bash
# Get ETH price from oracle
cast call 0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97 \
  "getPrice(address)(uint256)" \
  0x4200000000000000000000000000000000000006 \
  --rpc-url https://sepolia.base.org

# Check total supply in WETH/USDC market
cast call 0x2C201C3FCdB6073d0f895D29bf8F8A93d2D67A0E \
  "totalSupplyAssets()(uint256)" \
  --rpc-url https://sepolia.base.org

# Check user position
cast call 0x2C201C3FCdB6073d0f895D29bf8F8A93d2D67A0E \
  "healthFactor(address)(uint256)" \
  YOUR_ADDRESS \
  --rpc-url https://sepolia.base.org
```

### Using curl

```bash
# Query subgraph
curl -X POST \
  https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest \
  -H "Content-Type: application/json" \
  -d '{"query":"{ markets { id totalSupply totalBorrow } }"}'
```

---

## Deployment History

| Date | Event | Details |
|------|-------|---------|
| Dec 16, 2024 | Initial Deployment | Core contracts + 2 markets |
| Feb 16, 2026 | TWAP Disabled | Switched to Chainlink-only oracle |
| Mar 21, 2026 | Frontend Deployed | Vercel deployment live |

---

## Upcoming Changes

### Planned Updates

1. **Re-enable TWAP Oracle** (Phase 2, Week 1-2)
   - Fix decimal normalization bug
   - Test dual-oracle system
   - Improve reliability

2. **Add More Markets** (Phase 2)
   - DAI markets
   - Other Base-native tokens

3. **Mainnet Deployment** (Phase 3, 3-6 months)
   - Professional security audit
   - Multisig governance
   - Conservative risk parameters

See [DEPLOYMENT_ROADMAP.md](../DEPLOYMENT_ROADMAP.md) for full timeline.

---

**Last Updated**: March 21, 2026

Built with ❤️ on Base
