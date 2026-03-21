# ISM Protocol - Isolated Lending Markets

A DeFi lending protocol with isolated markets, Dutch auction liquidations, and MEV-resistant liquidations. Built on Base.

---

## 🚀 Try It Now (Testnet)

**Live on Base Sepolia**: [Insert Your Deployment URL]

### For Users
- 📖 **New to ISM?** → [User Guide](docs/USER_GUIDE.md) - Learn how to lend and borrow
- 🔧 **Getting Started** → [Testnet Info](docs/TESTNET.md) - Faucets, addresses, and setup
- ❓ **Have Questions?** → [FAQ](docs/FAQ.md) - Common questions answered

### For Developers
- 💻 **Want to Integrate?** → [Developer Guide](docs/DEVELOPER_GUIDE.md) - Code examples and APIs
- 🔗 **Contract Addresses** → [Testnet Deployments](docs/TESTNET.md#deployed-contracts)
- 📊 **Subgraph API** → [GraphQL Endpoint](docs/DEVELOPER_GUIDE.md#subgraph-integration)

---

## Structure

| Directory          | Description                                  |
| ------------------ | -------------------------------------------- |
| `contracts/`       | Solidity smart contracts (Foundry)           |
| `liquidation_bot/` | TypeScript liquidation bot                   |
| `frontend/`        | Next.js web application (React + TypeScript) |
| `deployments/`     | Shared contract addresses per network        |
| `docs/`            | Architecture & guides                        |

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
cd liquidation_bot
npm install
cp .env.example .env  # fill in values
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Features

### Smart Contracts

- ✅ Isolated lending markets (prevent contagion)
- ✅ Dual oracle system (Chainlink + Uniswap V3 TWAP)
- ✅ Kinked interest rate model
- ✅ MEV-resistant Dutch auction liquidations
- ✅ Minimal proxy pattern for gas-efficient market deployment

### Liquidation Bot

- 🤖 Automated monitoring of all lending pools
- 💰 Profitable liquidation execution
- ⚡ Real-time position tracking
- 🔍 Event-based indexing

### Frontend

- 🌐 Modern, responsive web interface
- 💼 Portfolio dashboard with real-time positions
- 📊 Market explorer with live statistics
- 🔗 RainbowKit wallet integration (MetaMask, Coinbase, WalletConnect)
- 📈 Interactive charts and analytics
- ⚡ Real-time data updates via wagmi hooks
- 🎨 Beautiful UI with Tailwind CSS and shadcn/ui

## Documentation

### User Documentation
- **[User Guide](docs/USER_GUIDE.md)** - How to use ISM Protocol (supply, borrow, manage positions)
- **[Testnet Info](docs/TESTNET.md)** - Deployed addresses, faucets, and network setup
- **[FAQ](docs/FAQ.md)** - Frequently asked questions

### Developer Documentation
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Integration guide with code examples
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design
- **[Deployment Roadmap](DEPLOYMENT_ROADMAP.md)** - Testnet to mainnet plan

### Component READMEs
- **[Contracts](contracts/README.md)** - Smart contracts development guide
- **[Frontend](frontend/README.md)** - Web app setup and development
- **[Liquidation Bot](liquidation_bot/README.md)** - Bot configuration and operation

## Tech Stack

### Contracts

- Solidity 0.8.24
- Foundry (Forge, Cast, Anvil)
- OpenZeppelin Contracts
- Base L2

### Liquidation Bot

- TypeScript
- ethers.js v6
- Vitest (testing)
- Winston (logging)

### Frontend

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui components
- wagmi v2 + viem
- RainbowKit
- TanStack Query

## Development Workflow

### 1. Deploy Contracts

```bash
cd contracts
forge script script/DeployCore.s.sol --rpc-url <RPC> --broadcast
```

### 2. Start Liquidation Bot

```bash
cd liquidation_bot
npm run extract-abis  # Extract ABIs from contracts
npm run dev
```

### 3. Launch Frontend

```bash
cd frontend
npm run dev
```

## Testing

### Smart Contracts

```bash
cd contracts
forge test              # Run all tests
forge test -vvv         # Verbose output
forge coverage          # Coverage report
```

### Liquidation Bot

```bash
cd liquidation_bot
npm test                # Run Vitest tests
```

### Frontend

```bash
cd frontend
npm run lint            # ESLint
npm run build           # Production build test
```

## License

ISC
