# ISM Protocol - Liquidation Bot

Automated liquidation bot for the Isolated Lending Markets (ISM) Protocol. Monitors lending pools on Base and executes liquidations via Dutch auctions when positions become unhealthy.

## Overview

The liquidation bot:
- 🔍 **Monitors** all lending pools for unhealthy positions (health factor < 1.0)
- 🎯 **Detects** liquidation opportunities in real-time
- 💰 **Executes** profitable liquidations via Dutch auction mechanism
- ⚡ **Optimizes** for gas efficiency and MEV resistance

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Deployed ISM Protocol contracts (see `../contracts/`)
- RPC endpoint for Base (mainnet or testnet)
- Private key with ETH for gas

### Installation

```bash
cd liquidation_bot
npm install
```

### Configuration

1. **Create environment file:**
```bash
cp .env.example .env
```

2. **Edit `.env` with your values:**
```env
# Network
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532

# Bot Configuration
PRIVATE_KEY=your_private_key_here
POLL_INTERVAL_MS=15000
MAX_GAS_PRICE_GWEI=50

# Profitability
MIN_PROFIT_ETH=0.01
```

### Running the Bot

```bash
npm run dev
```

## ABI Management

The bot uses **auto-generated ABIs** extracted from Foundry build artifacts to ensure contract interfaces always match deployed code.

### How It Works

1. **Contracts compiled** → Foundry generates JSON artifacts in `contracts/out/`
2. **ABIs extracted** → Script reads artifacts and generates TypeScript files
3. **Bot imports** → Bot uses generated ABIs via `src/contracts/abis.ts`

### Regenerating ABIs

**When to regenerate:**
- After modifying any smart contract
- After pulling contract changes from git
- Before deploying the bot to production

**How to regenerate:**

```bash
# From liquidation_bot/ directory
npm run extract-abis
```

This command:
- ✅ Reads Foundry artifacts from `../contracts/out/`
- ✅ Extracts ABIs for all protocol contracts
- ✅ Generates two files:
  - `src/contracts/abis.generated.ts` (full JSON ABIs)
  - `src/contracts/abis.human-readable.ts` (ethers v6 format)
- ✅ Validates extraction success

**Note:** Generated files are git-ignored. Run extraction locally or in CI/CD before deployment.

### Full Contract Update Workflow

When contracts change:

```bash
# 1. Update & build contracts
cd contracts
git pull  # or make your changes
forge build

# 2. Extract new ABIs
cd ../liquidation_bot
npm run extract-abis

# 3. Verify bot still works
npm run dev
```

### Manual ABI Updates (Not Recommended)

If you need to manually add/modify ABIs:
- Edit `src/contracts/abis.human-readable.ts` directly
- Add `// MANUAL OVERRIDE` comment
- Be aware changes will be overwritten on next extraction

## Project Structure

```
liquidation_bot/
├── scripts/
│   └── extract-abis.ts          # ABI extraction tool
├── src/
│   ├── contracts/
│   │   ├── abis.ts              # Main ABI exports (re-exports generated)
│   │   ├── abis.generated.ts    # Auto-generated (full JSON)
│   │   ├── abis.human-readable.ts  # Auto-generated (ethers format)
│   │   └── addresses.ts         # Contract addresses loader
│   ├── indexer/                 # Event monitoring
│   ├── state/                   # Position tracking
│   ├── config.ts                # Configuration loader
│   ├── logger.ts                # Logging utilities
│   └── types.ts                 # TypeScript types
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Development

### Available Scripts

```bash
npm run dev              # Run bot in development mode
npm run extract-abis     # Regenerate ABIs from Foundry artifacts
npm test                 # Run tests (if available)
```

### Adding New Contracts

To monitor a new contract:

1. **Add to extraction script:**
```typescript
// scripts/extract-abis.ts
const CONTRACTS = [
  // ... existing contracts
  { name: 'MyNewContract', path: 'MyNewContract.sol/MyNewContract.json' },
];
```

2. **Regenerate ABIs:**
```bash
npm run extract-abis
```

3. **Update exports:**
```typescript
// src/contracts/abis.ts
export {
  // ... existing exports
  MYNEWCONTRACT_ABI as MY_NEW_CONTRACT_ABI,
} from './abis.human-readable';
```

4. **Use in bot code:**
```typescript
import { MY_NEW_CONTRACT_ABI } from './contracts/abis';

const contract = new ethers.Contract(address, MY_NEW_CONTRACT_ABI, signer);
```

## Deployment Addresses

Contract addresses are loaded from `../deployments/{chainId}.json`. This file is shared with the contracts workspace and auto-generated during deployment.

Example structure:
```json
{
  "chainId": 84532,
  "network": "base-sepolia",
  "contracts": {
    "MarketRegistry": "0x...",
    "DutchAuctionLiquidator": "0x...",
    "OracleRouter": "0x...",
    "markets": [
      {
        "pool": "0x...",
        "collateralToken": "0x...",
        "borrowToken": "0x..."
      }
    ]
  }
}
```

## Monitoring & Logging

The bot uses Winston for structured logging:

- **Info**: Normal operations, liquidation opportunities
- **Warn**: Unprofitable liquidations, gas price exceeded
- **Error**: Failed transactions, RPC errors

Logs are written to console and can be configured to write to files.

## Safety & Best Practices

1. **Private Key Security**: Never commit `.env` files. Use hardware wallets or secret management in production.

2. **Gas Management**: Set `MAX_GAS_PRICE_GWEI` to avoid unprofitable liquidations during gas spikes.

3. **RPC Reliability**: Use paid RPC providers (Alchemy, Infura) for production to avoid rate limits.

4. **Profit Thresholds**: Set `MIN_PROFIT_ETH` high enough to cover gas costs and risk.

5. **ABI Sync**: Always run `npm run extract-abis` after contract updates to prevent runtime errors.

## Troubleshooting

### "Cannot find Foundry artifacts"

**Solution:**
```bash
cd ../contracts
forge build
cd ../liquidation_bot
npm run extract-abis
```

### "Contract call reverted"

**Cause:** ABI mismatch between bot and deployed contracts.

**Solution:**
1. Ensure deployment addresses in `deployments/{chainId}.json` are correct
2. Regenerate ABIs: `npm run extract-abis`
3. Verify contracts deployed: `cd ../contracts && forge verify-contract`

### "Insufficient funds for gas"

**Cause:** Bot wallet has insufficient ETH.

**Solution:** Fund the wallet address derived from `PRIVATE_KEY` in `.env`

### TypeScript errors in extract-abis.ts

**Cause:** This is expected - the script uses Node.js APIs with CommonJS.

**Solution:** Ignore these errors (they don't affect execution). The script runs via `tsx` which handles them.

## Resources

- **Smart Contracts**: See `../contracts/README.md`
- **Protocol Docs**: See `../docs/ARCHITECTURE.md`
- **ISM Protocol**: Main README at repository root
- **Foundry**: https://book.getfoundry.sh/
- **Ethers.js**: https://docs.ethers.org/

## License

ISC
