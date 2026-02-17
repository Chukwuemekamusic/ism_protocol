# ISM Protocol - Frontend

Modern web interface for the Isolated Lending Markets (ISM) Protocol. Built with Next.js, React, and TypeScript.

## Overview

The ISM Protocol frontend provides a user-friendly interface for:

- 💼 **Portfolio Management**: View and manage your lending positions across all markets
- 📊 **Market Explorer**: Browse available markets with real-time statistics
- 💰 **Supply & Borrow**: Deposit assets to earn interest or borrow against collateral
- 🔗 **Wallet Integration**: Connect with MetaMask, Coinbase Wallet, WalletConnect, and more
- 📈 **Analytics**: Track your health factor, APY, and portfolio value

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Web3 wallet (MetaMask, Coinbase Wallet, etc.)
- Access to Base network (mainnet or testnet)

### Installation

```bash
cd frontend
npm install
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                      # Next.js App Router pages
│   ├── page.tsx              # Home page
│   ├── dashboard/            # Portfolio dashboard
│   ├── markets/              # Market explorer
│   ├── layout.tsx            # Root layout
│   └── providers.tsx         # Web3 providers setup
├── components/               # React components
│   ├── dashboard/            # Dashboard-specific components
│   ├── markets/              # Market-specific components
│   ├── layout/               # Layout components (Header, Footer)
│   └── ui/                   # Reusable UI components (shadcn/ui)
├── hooks/                    # Custom React hooks
│   ├── useMarkets.ts         # Fetch all markets
│   ├── useMarketData.ts      # Fetch market details
│   ├── useUserPosition.ts    # Fetch user positions
│   ├── useDeposit.ts         # Supply assets
│   ├── useBorrow.ts          # Borrow assets
│   ├── useRepay.ts           # Repay debt
│   └── useWithdraw.ts        # Withdraw assets
├── lib/                      # Utilities and configuration
│   ├── contracts/            # Contract ABIs and addresses
│   ├── wagmi.ts              # Wagmi configuration
│   └── utils.ts              # Helper functions
└── public/                   # Static assets
```

## Key Features

### 1. Wallet Connection

- **RainbowKit Integration**: Beautiful wallet connection UI
- **Multi-Wallet Support**: MetaMask, Coinbase Wallet, WalletConnect, and more
- **Network Switching**: Automatic Base network detection and switching

### 2. Portfolio Dashboard

- **Real-time Positions**: View all your supply and borrow positions
- **Health Factor Monitoring**: Track your liquidation risk
- **Portfolio Value**: See total supplied, borrowed, and net value
- **Quick Actions**: Deposit, withdraw, borrow, and repay from one place

### 3. Market Explorer

- **Live Market Data**: Browse all available lending markets
- **Market Statistics**: APY, total supplied, total borrowed, utilization
- **Token Information**: Prices, balances, and allowances
- **Market Details**: Collateral factors, liquidation thresholds, interest rates

### 4. Transaction Management

- **Wagmi Hooks**: Type-safe contract interactions
- **Transaction Status**: Real-time feedback on pending transactions
- **Error Handling**: User-friendly error messages
- **Gas Estimation**: Preview transaction costs

## Tech Stack

### Core Framework

- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type safety

### Web3 Integration

- **wagmi v2**: React hooks for Ethereum
- **viem**: TypeScript Ethereum library
- **RainbowKit**: Wallet connection UI
- **TanStack Query**: Data fetching and caching

### UI/UX

- **Tailwind CSS 4**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **date-fns**: Date formatting

## Custom Hooks

### Market Hooks

- `useMarkets()`: Fetch all available markets from MarketRegistry
- `useMarketData(address)`: Get detailed market information
- `useProtocolStats()`: Get protocol-wide statistics

### User Hooks

- `useUserPositions()`: Fetch user's positions across all markets
- `useUserMarketPosition(address)`: Get user's position in a specific market
- `usePortfolioData()`: Calculate portfolio totals and health factor

### Transaction Hooks

- `useDeposit(marketAddress)`: Supply assets to earn interest
- `useBorrow(marketAddress)`: Borrow against collateral
- `useRepay(marketAddress)`: Repay borrowed assets
- `useWithdraw(marketAddress)`: Withdraw supplied assets

### Utility Hooks

- `useTokenPrices()`: Fetch token prices from OracleRouter

## Configuration

### Environment Variables

Create a `.env.local` file (optional):

```env
# RPC URL (optional - uses public RPC by default)
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

# WalletConnect Project ID (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Contract Addresses

Contract addresses are automatically loaded from `../deployments/{chainId}.json`. This file is shared with the contracts and liquidation bot workspaces.

Example structure:

```json
{
  "chainId": 84532,
  "network": "base-sepolia",
  "contracts": {
    "MarketRegistry": "0x...",
    "OracleRouter": "0x...",
    "DutchAuctionLiquidator": "0x..."
  }
}
```

## Development

### Adding New Components

```bash
# Add shadcn/ui components
npx shadcn@latest add button
npx shadcn@latest add card
```

### Code Style

```bash
# Run ESLint
npm run lint

# Format code (if prettier is configured)
npm run format
```

### Type Checking

```bash
# TypeScript type checking
npx tsc --noEmit
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Configure environment variables
4. Deploy

### Other Platforms

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### "Contract call reverted"

**Cause**: ABI mismatch or incorrect contract address.

**Solution**:

1. Ensure `deployments/{chainId}.json` has correct addresses
2. Verify you're connected to the correct network
3. Check that contracts are deployed on the current network

### "Wallet not connected"

**Cause**: User hasn't connected their wallet.

**Solution**: Click "Connect Wallet" button in the header.

### "Insufficient allowance"

**Cause**: Token approval needed before deposit/repay.

**Solution**: The UI will prompt for approval automatically. Approve the transaction first.

### "Network mismatch"

**Cause**: Wallet is on wrong network.

**Solution**: Switch to Base (or Base Sepolia for testnet) in your wallet, or use the network switcher in RainbowKit.

## Resources

- **ISM Protocol Docs**: See `../docs/ARCHITECTURE.md`
- **Smart Contracts**: See `../contracts/README.md`
- **Next.js Docs**: https://nextjs.org/docs
- **wagmi Docs**: https://wagmi.sh
- **RainbowKit Docs**: https://www.rainbowkit.com
- **shadcn/ui**: https://ui.shadcn.com

## License

ISC
