# ISM Protocol UI Creation Guide

This guide walks you through building a modern web interface for the ISM Protocol lending platform. The UI will allow users to supply assets, borrow against collateral, manage positions, and monitor markets.

## Overview

**Goal**: Build a functional, production-ready UI that demonstrates full-stack DeFi development skills.

**Time Estimate**: 2-3 days for MVP

**Tech Stack**:
- **Frontend Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Web3 Integration**: wagmi v2 + viem
- **Wallet Connection**: RainbowKit
- **State Management**: React hooks (useState, useContext)
- **Deployment**: Vercel

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Core Architecture](#2-core-architecture)
3. [Page Structure](#3-page-structure)
4. [Smart Contract Integration](#4-smart-contract-integration)
5. [Key Features Implementation](#5-key-features-implementation)
6. [Deployment](#6-deployment)
7. [Testing Checklist](#7-testing-checklist)

---

## 1. Project Setup

### Step 1.1: Initialize Next.js Project

```bash
# Create new Next.js app
npx create-next-app@latest ism-protocol-ui --typescript --tailwind --app

# Navigate to project
cd ism-protocol-ui

# Install Web3 dependencies
npm install wagmi viem @rainbow-me/rainbowkit
npm install @tanstack/react-query

# Install UI dependencies
npm install lucide-react clsx tailwind-merge
npm install date-fns
```

### Step 1.2: Project Structure

```
ism-protocol-ui/
├── app/
│   ├── layout.tsx           # Root layout with Web3 providers
│   ├── page.tsx             # Home page (markets overview)
│   ├── markets/
│   │   └── [id]/
│   │       └── page.tsx     # Individual market page
│   ├── dashboard/
│   │   └── page.tsx         # User positions dashboard
│   └── liquidations/
│       └── page.tsx         # Liquidation explorer (optional)
├── components/
│   ├── markets/
│   │   ├── MarketCard.tsx
│   │   ├── MarketsList.tsx
│   │   └── SupplyBorrowForm.tsx
│   ├── dashboard/
│   │   ├── PositionCard.tsx
│   │   └── HealthFactorDisplay.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ConnectButton.tsx
│   └── layout/
│       ├── Header.tsx
│       └── Footer.tsx
├── lib/
│   ├── contracts/
│   │   ├── abis.ts          # Contract ABIs
│   │   ├── addresses.ts     # Deployed contract addresses
│   │   └── types.ts         # TypeScript types for contracts
│   ├── utils/
│   │   ├── formatters.ts    # Number/date formatting
│   │   ├── calculations.ts  # APY, health factor calculations
│   │   └── constants.ts     # App constants
│   └── wagmi.ts             # wagmi configuration
├── hooks/
│   ├── useMarkets.ts        # Fetch all markets
│   ├── useMarketData.ts     # Fetch single market data
│   ├── useUserPosition.ts   # Fetch user's positions
│   └── useHealthFactor.ts   # Calculate health factor
└── public/
    └── tokens/              # Token logos (WETH, USDC, etc.)
```

---

## 2. Core Architecture

### 2.1: Web3 Provider Setup

**File: `app/providers.tsx`**

```typescript
'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const config = getDefaultConfig({
  appName: 'ISM Protocol',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [base, baseSepolia],
  ssr: true, // Enable server-side rendering
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**File: `app/layout.tsx`**

```typescript
import { Providers } from './providers';
import './globals.css';
import { Inter } from 'next/font/google';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ISM Protocol - Isolated Lending Markets',
  description: 'Supply assets, borrow with collateral, and earn interest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
```

### 2.2: Contract ABIs and Addresses

**File: `lib/contracts/addresses.ts`**

```typescript
export const CONTRACTS = {
  // Base Sepolia (testnet)
  84532: {
    marketFactory: '0x...', // From your deployment
    marketRegistry: '0x...',
    oracleRouter: '0x...',
    dutchAuctionLiquidator: '0x...',
  },
  // Base Mainnet
  8453: {
    marketFactory: '0x...',
    marketRegistry: '0x...',
    oracleRouter: '0x...',
    dutchAuctionLiquidator: '0x...',
  },
} as const;

export function getContractAddress(
  chainId: number,
  contract: keyof typeof CONTRACTS[84532]
): `0x${string}` {
  const addresses = CONTRACTS[chainId as keyof typeof CONTRACTS];
  if (!addresses) throw new Error(`Unsupported chain ID: ${chainId}`);
  return addresses[contract] as `0x${string}`;
}
```

**File: `lib/contracts/abis.ts`**

```typescript
// Copy ABIs from your Foundry artifacts
export const LENDING_POOL_ABI = [
  // From out/LendingPool.sol/LendingPool.json
  {
    "inputs": [
      {"internalType": "uint256", "name": "assets", "type": "uint256"}
    ],
    "name": "deposit",
    "outputs": [{"internalType": "uint256", "name": "shares", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // ... rest of ABI
] as const;

export const MARKET_REGISTRY_ABI = [
  // From out/MarketRegistry.sol/MarketRegistry.json
] as const;

export const ORACLE_ROUTER_ABI = [
  // From out/OracleRouter.sol/OracleRouter.json
] as const;

// Export helper to get ABI by contract name
export const ABIS = {
  lendingPool: LENDING_POOL_ABI,
  marketRegistry: MARKET_REGISTRY_ABI,
  oracleRouter: ORACLE_ROUTER_ABI,
} as const;
```

---

## 3. Page Structure

### 3.1: Home Page (Markets Overview)

**File: `app/page.tsx`**

```typescript
import MarketsList from '@/components/markets/MarketsList';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">ISM Protocol</h1>
        <p className="text-gray-600">
          Isolated lending markets on Base. Supply assets to earn interest or borrow against collateral.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Protocol Stats */}
        <StatCard title="Total Value Locked" value="$0.00" />
        <StatCard title="Total Markets" value="0" />
        <StatCard title="Active Borrows" value="$0.00" />
      </div>

      <MarketsList />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
```

### 3.2: Market Detail Page

**File: `app/markets/[id]/page.tsx`**

```typescript
'use client';

import { useParams } from 'next/navigation';
import SupplyBorrowForm from '@/components/markets/SupplyBorrowForm';
import { useMarketData } from '@/hooks/useMarketData';

export default function MarketPage() {
  const params = useParams();
  const marketAddress = params.id as string;
  const { data: market, isLoading } = useMarketData(marketAddress);

  if (isLoading) return <div>Loading market...</div>;
  if (!market) return <div>Market not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {market.collateralSymbol} / {market.borrowSymbol} Market
        </h1>
        <p className="text-gray-600">Market Address: {marketAddress}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Market Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Market Information</h2>
            <div className="space-y-3">
              <InfoRow label="Supply APY" value={`${market.supplyApy}%`} />
              <InfoRow label="Borrow APY" value={`${market.borrowApy}%`} />
              <InfoRow label="Total Supplied" value={`${market.totalSupply} ${market.borrowSymbol}`} />
              <InfoRow label="Total Borrowed" value={`${market.totalBorrow} ${market.borrowSymbol}`} />
              <InfoRow label="Utilization" value={`${market.utilization}%`} />
              <InfoRow label="LTV" value={`${market.ltv}%`} />
            </div>
          </div>
        </div>

        {/* Right: Supply/Borrow Form */}
        <div>
          <SupplyBorrowForm marketAddress={marketAddress} market={market} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
```

### 3.3: User Dashboard

**File: `app/dashboard/page.tsx`**

```typescript
'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useUserPositions } from '@/hooks/useUserPosition';
import PositionCard from '@/components/dashboard/PositionCard';
import HealthFactorDisplay from '@/components/dashboard/HealthFactorDisplay';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { data: positions, isLoading } = useUserPositions(address);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
        <p className="text-gray-600 mb-8">
          View your positions and manage your lending activities
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Dashboard</h1>

      {/* Health Factor Banner */}
      <HealthFactorDisplay positions={positions} />

      {/* Positions Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard title="Total Supplied" value="$0.00" />
        <StatCard title="Total Borrowed" value="$0.00" />
      </div>

      {/* Active Positions */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Your Positions</h2>
        {isLoading ? (
          <p>Loading positions...</p>
        ) : positions && positions.length > 0 ? (
          <div className="space-y-4">
            {positions.map((position) => (
              <PositionCard key={position.marketAddress} position={position} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No active positions</p>
            <p className="text-sm text-gray-500 mt-2">
              Start supplying or borrowing to see your positions here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
```

---

## 4. Smart Contract Integration

### 4.1: Custom Hooks for Contract Interaction

**File: `hooks/useMarkets.ts`**

```typescript
'use client';

import { useReadContract } from 'wagmi';
import { getContractAddress } from '@/lib/contracts/addresses';
import { ABIS } from '@/lib/contracts/abis';

export function useMarkets() {
  const { data, isLoading, error } = useReadContract({
    address: getContractAddress(84532, 'marketRegistry'),
    abi: ABIS.marketRegistry,
    functionName: 'getAllMarkets',
  });

  return {
    markets: data as `0x${string}`[] | undefined,
    isLoading,
    error,
  };
}
```

**File: `hooks/useMarketData.ts`**

```typescript
'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { ABIS } from '@/lib/contracts/abis';

export function useMarketData(marketAddress: `0x${string}`) {
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: marketAddress,
        abi: ABIS.lendingPool,
        functionName: 'totalSupplyAssets',
      },
      {
        address: marketAddress,
        abi: ABIS.lendingPool,
        functionName: 'totalBorrowAssets',
      },
      {
        address: marketAddress,
        abi: ABIS.lendingPool,
        functionName: 'getSupplyRate',
      },
      {
        address: marketAddress,
        abi: ABIS.lendingPool,
        functionName: 'getBorrowRate',
      },
      // Add more contract reads as needed
    ],
  });

  // Transform data into market object
  const market = data ? {
    totalSupply: data[0].result,
    totalBorrow: data[1].result,
    supplyRate: data[2].result,
    borrowRate: data[3].result,
    // Calculate APY from rates
    supplyApy: calculateAPY(data[2].result as bigint),
    borrowApy: calculateAPY(data[3].result as bigint),
  } : null;

  return { data: market, isLoading };
}

function calculateAPY(ratePerSecond: bigint): number {
  // Convert per-second rate to APY
  // APY = (1 + rate)^31536000 - 1
  const secondsPerYear = 31536000n;
  const rate = Number(ratePerSecond) / 1e18;
  const apy = (Math.pow(1 + rate, Number(secondsPerYear)) - 1) * 100;
  return parseFloat(apy.toFixed(2));
}
```

**File: `hooks/useUserPosition.ts`**

```typescript
'use client';

import { useReadContracts } from 'wagmi';
import { ABIS } from '@/lib/contracts/abis';
import { useMarkets } from './useMarkets';

export function useUserPositions(address?: `0x${string}`) {
  const { markets } = useMarkets();

  const { data, isLoading } = useReadContracts({
    contracts: markets?.flatMap((marketAddress) => [
      {
        address: marketAddress,
        abi: ABIS.lendingPool,
        functionName: 'balanceOfUnderlying',
        args: [address],
      },
      {
        address: marketAddress,
        abi: ABIS.lendingPool,
        functionName: 'collateralBalances',
        args: [address],
      },
      {
        address: marketAddress,
        abi: ABIS.lendingPool,
        functionName: 'getBorrowBalance',
        args: [address],
      },
    ]) || [],
  });

  // Transform data into positions array
  const positions = markets?.map((marketAddress, index) => {
    const baseIndex = index * 3;
    return {
      marketAddress,
      supplied: data?.[baseIndex]?.result as bigint,
      collateral: data?.[baseIndex + 1]?.result as bigint,
      borrowed: data?.[baseIndex + 2]?.result as bigint,
    };
  }).filter(p => p.supplied > 0n || p.collateral > 0n || p.borrowed > 0n);

  return { data: positions, isLoading };
}
```

### 4.2: Transaction Hooks

**File: `hooks/useDeposit.ts`**

```typescript
'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ABIS } from '@/lib/contracts/abis';
import { parseUnits } from 'viem';

export function useDeposit(marketAddress: `0x${string}`) {
  const { data: hash, writeContract, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: marketAddress,
      abi: ABIS.lendingPool,
      functionName: 'deposit',
      args: [amountInWei],
    });
  };

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
  };
}
```

---

## 5. Key Features Implementation

### 5.1: Supply/Borrow Form Component

**File: `components/markets/SupplyBorrowForm.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDeposit } from '@/hooks/useDeposit';
import { useBorrow } from '@/hooks/useBorrow';

type Tab = 'supply' | 'borrow' | 'repay' | 'withdraw';

export default function SupplyBorrowForm({
  marketAddress,
  market,
}: {
  marketAddress: `0x${string}`;
  market: any;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('supply');
  const [amount, setAmount] = useState('');
  const { isConnected } = useAccount();

  const { deposit, isPending: isDepositing, isSuccess: depositSuccess } = useDeposit(marketAddress);
  const { borrow, isPending: isBorrowing, isSuccess: borrowSuccess } = useBorrow(marketAddress);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    switch (activeTab) {
      case 'supply':
        deposit(amount, market.borrowDecimals);
        break;
      case 'borrow':
        borrow(amount, market.borrowDecimals);
        break;
      // Add repay and withdraw handlers
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="mb-4">Connect wallet to interact</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {(['supply', 'borrow', 'repay', 'withdraw'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Amount
          </label>
          <input
            type="number"
            step="0.000001"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Balance: 0.00</span>
            <button
              type="button"
              onClick={() => setAmount('0')} // Set to max balance
              className="text-blue-500 hover:underline"
            >
              MAX
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isDepositing || isBorrowing}
          className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isDepositing || isBorrowing ? 'Processing...' : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </button>
      </form>

      {/* Success Messages */}
      {depositSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg">
          Deposit successful!
        </div>
      )}
      {borrowSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg">
          Borrow successful!
        </div>
      )}
    </div>
  );
}
```

### 5.2: Health Factor Display

**File: `components/dashboard/HealthFactorDisplay.tsx`**

```typescript
export default function HealthFactorDisplay({ positions }: { positions: any[] }) {
  // Calculate aggregate health factor across all positions
  const healthFactor = calculateHealthFactor(positions);

  const getHealthStatus = (hf: number) => {
    if (hf >= 1.5) return { text: 'Safe', color: 'bg-green-500' };
    if (hf >= 1.2) return { text: 'Moderate', color: 'bg-yellow-500' };
    if (hf >= 1.0) return { text: 'At Risk', color: 'bg-orange-500' };
    return { text: 'Liquidatable', color: 'bg-red-500' };
  };

  const status = getHealthStatus(healthFactor);

  return (
    <div className={`rounded-lg p-6 mb-8 ${status.color} text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90 mb-1">Health Factor</p>
          <p className="text-4xl font-bold">{healthFactor.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <span className="px-4 py-2 bg-white bg-opacity-20 rounded-full font-semibold">
            {status.text}
          </span>
          <p className="text-sm mt-2 opacity-90">
            {healthFactor < 1.0 ? 'Position can be liquidated' : 'Position is safe'}
          </p>
        </div>
      </div>
    </div>
  );
}

function calculateHealthFactor(positions: any[]): number {
  // Implement health factor calculation
  // HF = (totalCollateralValue * liquidationThreshold) / totalDebtValue
  return 1.5; // Placeholder
}
```

---

## 6. Deployment

### 6.1: Environment Variables

Create `.env.local`:

```bash
# WalletConnect Project ID (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# RPC URLs
NEXT_PUBLIC_BASE_MAINNET_RPC=https://mainnet.base.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org

# Contract Addresses (from your deployment)
NEXT_PUBLIC_MARKET_REGISTRY_BASE_SEPOLIA=0x...
NEXT_PUBLIC_MARKET_FACTORY_BASE_SEPOLIA=0x...
```

### 6.2: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Production deployment
vercel --prod
```

**Alternative: GitHub Integration**
1. Push code to GitHub
2. Go to vercel.com → Import Project
3. Connect GitHub repo
4. Add environment variables in Vercel dashboard
5. Deploy automatically on every push

### 6.3: Custom Domain (Optional)

In Vercel dashboard:
1. Go to Project Settings → Domains
2. Add custom domain (e.g., `ism-protocol.xyz`)
3. Update DNS records as instructed

---

## 7. Testing Checklist

### Pre-Launch Testing

**Wallet Connection**
- [ ] Connect with MetaMask
- [ ] Connect with WalletConnect
- [ ] Disconnect wallet
- [ ] Switch networks (Base Mainnet ↔ Sepolia)

**Market Interactions**
- [ ] View all markets
- [ ] Supply assets to market
- [ ] Approve token spending (ERC20)
- [ ] Borrow against collateral
- [ ] Repay borrow
- [ ] Withdraw supplied assets
- [ ] Display correct balances after each action

**Dashboard**
- [ ] Display user positions accurately
- [ ] Calculate health factor correctly
- [ ] Show real-time interest accrual
- [ ] Update positions after transactions

**Error Handling**
- [ ] Handle insufficient balance
- [ ] Handle rejected transactions
- [ ] Handle network errors
- [ ] Display meaningful error messages

**Edge Cases**
- [ ] Zero balance in wallet
- [ ] Maximum borrow limit reached
- [ ] Low health factor warning
- [ ] Liquidation state display

---

## Additional Enhancements (Optional)

### Phase 2 Features (If Time Permits)

1. **Notifications**
   - Toast notifications for transactions
   - Browser notifications for low health factor

2. **Analytics**
   - Interest earned over time chart
   - Utilization rate graph
   - Historical APY trends

3. **Advanced Features**
   - Liquidation interface (trigger auctions, bid on collateral)
   - Multi-market borrow (aggregate positions)
   - Migrate positions between markets

4. **Mobile Optimization**
   - Responsive design for mobile devices
   - Mobile wallet support (Rainbow, Trust Wallet)

---

## Resources

**Official Docs**
- Next.js: https://nextjs.org/docs
- wagmi: https://wagmi.sh/react/getting-started
- RainbowKit: https://www.rainbowkit.com/docs/installation
- Tailwind CSS: https://tailwindcss.com/docs

**Inspiration**
- Aave UI: https://app.aave.com
- Compound: https://app.compound.finance
- Morpho: https://app.morpho.org

**Tools**
- WalletConnect Project ID: https://cloud.walletconnect.com
- Base RPC: https://docs.base.org/network-information
- Token Logos: https://github.com/trustwallet/assets

---

## Final Notes

**Development Tips**:
1. Start with read-only features (market display, balances)
2. Add wallet connection next
3. Implement one transaction type at a time (deposit → borrow → repay → withdraw)
4. Test on Base Sepolia testnet extensively before mainnet
5. Use browser console to debug Web3 errors

**Time Management**:
- Day 1: Setup, wallet connection, market display
- Day 2: Transaction flows (supply/borrow)
- Day 3: Dashboard, polish, deploy

**Success Criteria**:
- Users can connect wallet
- Users can supply assets and borrow
- Health factor displays correctly
- UI is deployed and accessible via URL

Good luck building! 🚀
