# Isolated Lending Markets Protocol

A DeFi lending protocol with isolated markets, Dutch auction liquidations, and an automated liquidation bot. Built on Base.

## Structure

| Directory          | Description                           |
| ------------------ | ------------------------------------- |
| `contracts/`       | Solidity smart contracts (Foundry)    |
| `liquidation-bot/` | TypeScript liquidation bot            |
| `deployments/`     | Shared contract addresses per network |
| `docs/`            | Architecture & guides                 |

## Quick Start

### Contracts

```bash
cd contracts
forge install
forge build
forge test
```

### Liquidation Bot

```bash
cd liquidation-bot
npm install
cp .env.example .env  # fill in values
npm run dev
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment Guide](contracts/DEPLOYMENT.md)
- [Bot README](liquidation-bot/README.md)
