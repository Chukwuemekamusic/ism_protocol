# ISM Protocol Frontend Enhancement Plan

**Version**: 2.0
**Date**: 2026-03-17
**Status**: In Progress
**Approach**: Hybrid Liquidation with Subgraph Indexing

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Liquidation Strategy: Industry Research](#liquidation-strategy-industry-research)
3. [Feature 1: Liquidations Page (3 Layers)](#feature-1-liquidations-page-3-layers)
4. [Feature 2: Subgraph Deployment](#feature-2-subgraph-deployment)
5. [Feature 3: Enhanced Liquidation Bot](#feature-3-enhanced-liquidation-bot)
6. [Feature 4: Dashboard Analytics](#feature-4-dashboard-analytics)
7. [Feature 5: Core UX Enhancements](#feature-5-core-ux-enhancements)
8. [Implementation Timeline](#implementation-timeline)
9. [Technical Specifications](#technical-specifications)
10. [Testing Checklist](#testing-checklist)
11. [Success Metrics](#success-metrics)

---

## Overview

### Current State
- ✅ Frontend is 95%+ complete
- ✅ All core lending features working
- ✅ Production-ready deployment
- ⚠️ Missing: Liquidations page, Analytics, Subgraph, Bot enhancements

### Enhancement Goals
1. **Build Comprehensive Liquidations Page** - 3 layers (Opportunities, Active Auctions, History)
2. **Deploy Subgraph Indexer** - Index protocol events for fast queries
3. **Enhance Liquidation Bot** - Hybrid approach (permissionless + backup)
4. **Add Dashboard Analytics** - Historical insights with charts
5. **Polish Core UX** - Filtering, notifications, mobile experience

### Estimated Total Time
- **Subgraph Deployment**: 2-3 days
- **Liquidations Page (3 Layers)**: 3-4 days
- **Bot Enhancements**: 1-2 days
- **Dashboard Analytics**: 2-3 days
- **Core Enhancements**: 1-2 days
- **Total**: 9-14 days (2-3 weeks)

---

## Liquidation Strategy: Industry Research

### 🔍 Real-World Production Examples

Before building, we researched how major DeFi protocols handle liquidations:

#### **MakerDAO - The Gold Standard** ✅
- **Approach**: Fully permissionless with **official backup bots**
- **Strategy**: Runs 4 different keeper networks (MIP-63)
- **Rationale**: Learned from March 2020 event ($8.3M loss from zero-dollar liquidations)
- **Lesson**: Redundancy through protocol-operated infrastructure prevents systemic risk
- **Our takeaway**: It's acceptable and even recommended to run backup bots for protocol safety

#### **Euler Finance** ✅
- **Approach**: "Euler Labs maintains an open-source liquidation bot, and partners operate additional bots for redundancy"
- **Strategy**: Official bot + partner redundancy
- **Lesson**: Explicit backup strategy is transparent and builds trust
- **Our takeaway**: Partner bot model is a viable alternative to protocol-only bots

#### **Liquity Protocol** ✅
- **Approach**: Stability Pool primary + permissionless bots secondary
- **Innovation**: Built-in economic backup mechanism
- **Lesson**: Creative design can reduce bot dependency
- **Our takeaway**: Economic design matters, but bot backup still valuable

#### **Aave, Compound, Morpho**
- **Approach**: Fully permissionless with official reference implementations
- **Strategy**: Provide open-source bot code, rely on competitive ecosystem
- **Lesson**: Economic incentives usually sufficient for mature protocols
- **Our takeaway**: Works for established protocols, risky for new launches

### 🎯 ISM Protocol Strategy: Hybrid Approach

**Decision**: Implement **permissionless + bot backup** (inspired by MakerDAO and Euler)

**Why Hybrid?**
1. ✅ **Protocol Health**: Guaranteed liquidations prevent bad debt
2. ✅ **Decentralization**: Anyone can compete with protocol bot
3. ✅ **Cost-Efficient**: Bot only acts when community doesn't
4. ✅ **Launch Safety**: Critical before bot ecosystem matures
5. ✅ **Proven Approach**: MakerDAO and Euler do this successfully

**Implementation**:
```
Liquidatable Position Detected (HF < 1.0)
         ↓
Anyone can call startAuction() immediately ← PERMISSIONLESS
         ↓
If NO ONE starts auction for 10 minutes:
         ↓
Protocol bot calls startAuction() ← BACKUP SAFETY NET
         ↓
Auction is now active for ANYONE to liquidate
         ↓
First liquidator to participate wins collateral
```

---

## Feature 1: Liquidations Page (3 Layers)

### 🎯 Comprehensive Liquidation Discovery

Unlike the original plan (active auctions only), we're building a **full liquidation discovery system** with 3 data layers:

#### **Layer 1: Opportunities** 🔴
- Shows positions where `healthFactor < 1.0` but auction NOT yet started
- Allows users to discover and trigger auctions first
- **Action**: "Start Auction" button (anyone can trigger)
- **Data Source**: Subgraph query for unhealthy positions

#### **Layer 2: Active Auctions** 🟡
- Shows auctions currently in progress (Dutch auction descending)
- Real-time price updates and countdown timers
- **Action**: "Liquidate" button (participate in auction)
- **Data Source**: Contract query + subgraph for context

#### **Layer 3: History** 🟢
- Completed liquidations (protocol-wide)
- "My Liquidations" filtered view
- **Action**: View analytics, export data
- **Data Source**: Subgraph historical queries

---

### 📐 Updated Page Structure

**Route**: `/liquidations`

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Liquidations                                                    │
│ Discover opportunities, participate in auctions, track history  │
├─────────────────────────────────────────────────────────────────┤
│ [🔴 Opportunities] [🟡 Active] [🟢 History] [👤 My Liquidations]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ████ TAB 1: OPPORTUNITIES (Layer 1) ████                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Liquidatable Positions - Not Yet Auctioned (5 found)       │ │
│ │                                                             │ │
│ │ ┌────────────────────────────────────────┐                  │ │
│ │ │ 🔴 Position #1 - WETH/USDC             │                  │ │
│ │ │ Borrower: 0x1234...5678                │                  │ │
│ │ │ Health Factor: 0.92 ⚠️ LIQUIDATABLE!   │                  │ │
│ │ │                                        │                  │ │
│ │ │ Collateral: 10.5 WETH ($21,000)        │                  │ │
│ │ │ Debt: $22,850 USDC                     │                  │ │
│ │ │ Potential Profit: ~$1,050 (5.0%)       │                  │ │
│ │ │                                        │                  │ │
│ │ │ 💡 Be first to start auction!          │                  │ │
│ │ │ [START AUCTION] ← Anyone can trigger   │                  │ │
│ │ └────────────────────────────────────────┘                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ████ TAB 2: ACTIVE AUCTIONS (Layer 2) ████                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Active Auctions - Currently Running (3 active)              │ │
│ │                                                             │ │
│ │ ┌────────────────────────────────────────┐                  │ │
│ │ │ 🟡 Auction #123 - Started 15m ago      │                  │ │
│ │ │ Started by: 0xabcd...1234 (or Bot 🤖) │                  │ │
│ │ │ Borrower: 0x5678...efgh                │                  │ │
│ │ │                                        │                  │ │
│ │ │ Current Price: $19,425 (descending...) │                  │ │
│ │ │ Start: $21,000 (105%) → End: $18,500 (95%)               │ │
│ │ │ ├─────────●──────────────────────────┤                   │ │
│ │ │ Time Remaining: 15m 32s / 20m         │                  │ │
│ │ │ Progress: 72% complete                │                  │ │
│ │ │                                        │                  │ │
│ │ │ Your Profit: +$925 (4.7% ROI) 🟢      │                  │ │
│ │ │ [LIQUIDATE NOW] ← Compete with others │                  │ │
│ │ └────────────────────────────────────────┘                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ████ TAB 3: HISTORY (Layer 3) ████                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Completed Liquidations (Protocol-wide)                      │ │
│ │                                                             │ │
│ │ │ Date/Time   │ Liquidator  │ Borrower   │ Profit    │ ROI ││
│ │ │─────────────│─────────────│────────────│───────────│─────││
│ │ │ Mar 17 2PM  │ 0xabcd...   │ 0x1234...  │ +$950     │ 4.2%││
│ │ │ Mar 17 1PM  │ Bot 🤖      │ 0xefgh...  │ +$1,200   │ 5.8%││
│ │ │ Mar 17 12PM │ 0x5678...   │ 0xijkl...  │ +$780     │ 3.9%││
│ │ │ [Load More] [Export CSV] [Filter]                      ││
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ████ TAB 4: MY LIQUIDATIONS (Layer 3 filtered) ████             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Your Liquidation Performance                                │ │
│ │                                                             │ │
│ │ 💰 Total Earned: $2,150 from 3 liquidations                │ │
│ │ 📊 Average ROI: 4.6%                                        │ │
│ │ 🎯 Success Rate: 100% (3/3)                                 │ │
│ │                                                             │ │
│ │ Recent Activity:                                            │ │
│ │ Mar 17 2PM │ WETH/USDC │ +$950 (4.2%) │ [View Details]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🗂️ Updated File Structure

```
app/
└── liquidations/
    └── page.tsx                         # Main liquidations page (4 tabs)

components/
└── liquidations/
    ├── OpportunitiesTab.tsx            # Layer 1: Liquidatable positions
    │   ├── LiquidatablePositionCard.tsx # Position card with "Start Auction"
    │   └── StartAuctionModal.tsx        # Confirm starting auction
    ├── ActiveAuctionsTab.tsx           # Layer 2: Running auctions
    │   ├── AuctionCard.tsx              # Active auction display
    │   ├── AuctionProgress.tsx          # Visual progress bar
    │   ├── LiquidateModal.tsx           # Execute liquidation
    │   └── ProfitCalculator.tsx         # Real-time profit calc
    ├── HistoryTab.tsx                  # Layer 3: Completed
    │   ├── LiquidationHistoryTable.tsx  # Historical data table
    │   └── ExportData.tsx               # CSV export
    └── MyLiquidationsTab.tsx           # Layer 3: User filtered
        └── LiquidationStats.tsx         # User performance metrics

hooks/
├── useLiquidatablePositions.ts         # Layer 1: Query subgraph
├── useActiveAuctions.ts                 # Layer 2: Query contract + subgraph
├── useAuctionDetails.ts                 # Layer 2: Single auction
├── useAuctionPrice.ts                   # Layer 2: Real-time price
├── useStartAuction.ts                   # Layer 1: Start auction tx
├── useLiquidate.ts                      # Layer 2: Liquidate tx
├── useLiquidationHistory.ts             # Layer 3: Historical data
└── useUserLiquidations.ts               # Layer 3: User filtered
```

---

### 📝 New Components

#### **1. LiquidatablePositionCard** (Layer 1)
**File**: `components/liquidations/LiquidatablePositionCard.tsx`

```typescript
interface LiquidatablePositionCardProps {
  borrower: `0x${string}`;
  marketAddress: `0x${string}`;
  healthFactor: number;
  collateralAmount: bigint;
  collateralValue: bigint;
  debtAmount: bigint;
  estimatedProfit: bigint;
}

export default function LiquidatablePositionCard(props: LiquidatablePositionCardProps) {
  const [showModal, setShowModal] = useState(false);
  const { startAuction, isPending } = useStartAuction();

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Position #{props.borrower.slice(0, 8)}</span>
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">
              Liquidatable
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Market: {props.marketAddress.slice(0, 8)}...
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-red-600">
            HF: {props.healthFactor.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">Below 1.0</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Collateral</p>
          <p className="font-semibold">{formatTokenAmount(props.collateralAmount)}</p>
          <p className="text-xs text-gray-500">{formatUSD(props.collateralValue)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Debt</p>
          <p className="font-semibold">{formatUSD(props.debtAmount)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Est. Profit</p>
          <p className="font-semibold text-green-600">
            +{formatUSD(props.estimatedProfit)}
          </p>
          <p className="text-xs text-gray-500">
            {((Number(props.estimatedProfit) / Number(props.debtAmount)) * 100).toFixed(1)}% ROI
          </p>
        </div>
      </div>

      <div className="bg-blue-50 rounded p-3 mb-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Be the first!</strong> Start the auction and participate immediately for best profit.
        </p>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Start Auction
      </button>

      {showModal && (
        <StartAuctionModal
          {...props}
          onConfirm={() => startAuction(props.marketAddress, props.borrower)}
          onClose={() => setShowModal(false)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
```

---

#### **2. StartAuctionModal** (Layer 1)
**File**: `components/liquidations/StartAuctionModal.tsx`

```typescript
interface StartAuctionModalProps {
  borrower: `0x${string}`;
  marketAddress: `0x${string}`;
  healthFactor: number;
  estimatedProfit: bigint;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

export default function StartAuctionModal(props: StartAuctionModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Start Liquidation Auction</h3>

        <div className="bg-gray-50 rounded p-4 mb-4">
          <p className="text-sm text-gray-600 mb-2">You're about to start a Dutch auction for:</p>
          <div className="space-y-1">
            <p className="text-sm"><strong>Borrower:</strong> {props.borrower}</p>
            <p className="text-sm"><strong>Health Factor:</strong> {props.healthFactor.toFixed(2)}</p>
            <p className="text-sm"><strong>Est. Profit:</strong> {formatUSD(props.estimatedProfit)}</p>
          </div>
        </div>

        <div className="bg-blue-50 rounded p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Starting the auction costs gas (~$0.10). Once started, anyone can participate in the liquidation.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={props.onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
            disabled={props.isPending}
          >
            Cancel
          </button>
          <button
            onClick={props.onConfirm}
            disabled={props.isPending}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {props.isPending ? 'Starting...' : 'Confirm & Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 🎣 New Hook Implementations

#### **1. useLiquidatablePositions** (Layer 1)
**File**: `hooks/useLiquidatablePositions.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { gql, request } from 'graphql-request';

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/YOUR_SUBGRAPH_ID/ism-protocol/v0.0.1';

const LIQUIDATABLE_POSITIONS_QUERY = gql`
  query LiquidatablePositions {
    positions(
      where: { healthFactor_lt: "1.0", borrowed_gt: "0" }
      orderBy: healthFactor
      orderDirection: asc
    ) {
      id
      user
      market {
        id
        collateralToken
        borrowToken
      }
      collateralAmount
      borrowedAmount
      healthFactor
      lastUpdate
    }
  }
`;

interface LiquidatablePosition {
  id: string;
  borrower: `0x${string}`;
  marketAddress: `0x${string}`;
  collateralAmount: bigint;
  debtAmount: bigint;
  healthFactor: number;
}

export function useLiquidatablePositions() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['liquidatable-positions'],
    queryFn: async () => {
      const data = await request(SUBGRAPH_URL, LIQUIDATABLE_POSITIONS_QUERY);
      return (data.positions || []).map((p: any) => ({
        id: p.id,
        borrower: p.user as `0x${string}`,
        marketAddress: p.market.id as `0x${string}`,
        collateralAmount: BigInt(p.collateralAmount),
        debtAmount: BigInt(p.borrowedAmount),
        healthFactor: parseFloat(p.healthFactor),
      }));
    },
    refetchInterval: 12000, // 12 seconds
  });

  return {
    positions: (data as LiquidatablePosition[]) || [],
    isLoading,
    error,
    refetch,
  };
}
```

---

#### **2. useStartAuction** (Layer 1)
**File**: `hooks/useStartAuction.ts`

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { DUTCH_AUCTION_LIQUIDATOR_ABI } from '@/lib/contracts/abis';
import { getContractAddress } from '@/lib/contracts/addresses';
import { showToast } from '@/lib/utils/toast';

export function useStartAuction() {
  const { data: hash, writeContract, isPending, error } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        showToast.transaction(hash);
      },
      onError: (error) => {
        showToast.error(`Failed to start auction: ${error.message}`);
      },
    },
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    onSuccess: () => {
      showToast.success('Auction started successfully! You can now liquidate this position.');
    },
  });

  const startAuction = (poolAddress: `0x${string}`, borrower: `0x${string}`) => {
    writeContract({
      address: getContractAddress(84532, 'dutchAuctionLiquidator'),
      abi: DUTCH_AUCTION_LIQUIDATOR_ABI,
      functionName: 'startAuction',
      args: [poolAddress, borrower],
    });
  };

  return {
    startAuction,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
```

---

#### **3. useLiquidationHistory** (Layer 3)
**File**: `hooks/useLiquidationHistory.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { gql, request } from 'graphql-request';

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/YOUR_SUBGRAPH_ID/ism-protocol/v0.0.1';

const LIQUIDATION_HISTORY_QUERY = gql`
  query LiquidationHistory($first: Int!, $skip: Int!, $user: String) {
    liquidations(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
      where: { liquidator: $user }
    ) {
      id
      liquidator
      borrower
      auction {
        id
        market {
          id
        }
      }
      debtRepaid
      collateralReceived
      profit
      timestamp
      transactionHash
    }
  }
`;

interface Liquidation {
  id: string;
  liquidator: `0x${string}`;
  borrower: `0x${string}`;
  marketAddress: `0x${string}`;
  debtRepaid: bigint;
  collateralReceived: bigint;
  profit: bigint;
  timestamp: number;
  txHash: string;
}

export function useLiquidationHistory(userAddress?: `0x${string}`, limit = 50) {
  const { data, isLoading, error, fetchNextPage, hasNextPage } = useQuery({
    queryKey: ['liquidation-history', userAddress, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const data = await request(SUBGRAPH_URL, LIQUIDATION_HISTORY_QUERY, {
        first: limit,
        skip: pageParam,
        user: userAddress || null,
      });
      return (data.liquidations || []).map((l: any) => ({
        id: l.id,
        liquidator: l.liquidator as `0x${string}`,
        borrower: l.borrower as `0x${string}`,
        marketAddress: l.auction.market.id as `0x${string}`,
        debtRepaid: BigInt(l.debtRepaid),
        collateralReceived: BigInt(l.collateralReceived),
        profit: BigInt(l.profit),
        timestamp: parseInt(l.timestamp),
        txHash: l.transactionHash,
      }));
    },
  });

  return {
    liquidations: (data as Liquidation[]) || [],
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
  };
}
```

---

### ✅ Updated Implementation Checklist - Liquidations Page

#### Phase 1: Subgraph Setup (DAY 1-2)
- [ ] Set up The Graph project
- [ ] Define schema (Position, Auction, Liquidation entities)
- [ ] Implement event handlers
- [ ] Deploy to hosted service or studio
- [ ] Test queries
- [ ] **See Feature 2 for detailed guide**

#### Phase 2: Layer 1 - Opportunities (DAY 3)
- [ ] Create OpportunitiesTab component
- [ ] Implement useLiquidatablePositions hook
- [ ] Build LiquidatablePositionCard
- [ ] Build StartAuctionModal
- [ ] Implement useStartAuction hook
- [ ] Test with testnet positions

#### Phase 3: Layer 2 - Active Auctions (DAY 4)
- [ ] Create ActiveAuctionsTab component
- [ ] Update useActiveAuctions hook (add subgraph context)
- [ ] Build enhanced AuctionCard
- [ ] Implement real-time price updates
- [ ] Add countdown timer
- [ ] Build AuctionProgress visual
- [ ] Test auction flow

#### Phase 4: Layer 2 - Liquidation Execution (DAY 5)
- [ ] Build LiquidateModal component
- [ ] Implement useLiquidate hook
- [ ] Add ProfitCalculator
- [ ] Add token approval flow
- [ ] Add transaction preview
- [ ] Test liquidation on testnet

#### Phase 5: Layer 3 - History (DAY 6)
- [ ] Create HistoryTab component
- [ ] Implement useLiquidationHistory hook
- [ ] Build LiquidationHistoryTable
- [ ] Add pagination
- [ ] Implement CSV export
- [ ] Build MyLiquidationsTab
- [ ] Add user statistics

#### Phase 6: Integration & Polish (DAY 7)
- [ ] Integrate all tabs into main page
- [ ] Add tab switching logic
- [ ] Add loading states
- [ ] Add empty states
- [ ] Mobile responsiveness
- [ ] Add search/filtering
- [ ] Documentation

**Total Time Estimate**: 7 days (1 week)

---

## Feature 2: Subgraph Deployment

### 🎯 Why We Need a Subgraph

**Problem**: Blockchain doesn't store historical or aggregated data efficiently.

**Without Subgraph**:
- ❌ Must scan every block for events (slow, expensive)
- ❌ Can't query "all positions with HF < 1.0" (would take 1000s of RPC calls)
- ❌ No historical data (liquidations, APY history, etc.)
- ❌ Poor UX (slow page loads, high RPC costs)

**With Subgraph**:
- ✅ Events automatically indexed
- ✅ Fast GraphQL queries (milliseconds)
- ✅ Complex filtering and sorting
- ✅ Historical data aggregation
- ✅ Real-time updates

---

### 📊 Subgraph Schema

**File**: `subgraph/schema.graphql`

```graphql
type Market @entity {
  id: ID! # market address
  collateralToken: Bytes!
  borrowToken: Bytes!
  totalSupplyAssets: BigInt!
  totalBorrowAssets: BigInt!
  totalCollateral: BigInt!
  utilization: BigDecimal!
  supplyAPY: BigDecimal!
  borrowAPY: BigDecimal!
  createdAt: BigInt!
  positions: [Position!]! @derivedFrom(field: "market")
  auctions: [Auction!]! @derivedFrom(field: "market")
}

type Position @entity {
  id: ID! # market-user
  market: Market!
  user: Bytes!
  supplied: BigInt!
  collateral: BigInt!
  borrowed: BigInt!
  healthFactor: BigDecimal!
  lastUpdate: BigInt!
  isLiquidatable: Boolean!
}

type Auction @entity {
  id: ID! # auctionId from contract
  market: Market!
  borrower: Bytes!
  collateralAmount: BigInt!
  debtAmount: BigInt!
  startTime: BigInt!
  endTime: BigInt!
  startPrice: BigInt!
  endPrice: BigInt!
  isActive: Boolean!
  startedBy: Bytes! # who triggered the auction
  liquidation: Liquidation # null until liquidated
}

type Liquidation @entity {
  id: ID! # tx-logIndex
  auction: Auction!
  liquidator: Bytes!
  borrower: Bytes!
  market: Market!
  debtRepaid: BigInt!
  collateralReceived: BigInt!
  profit: BigInt!
  timestamp: BigInt!
  transactionHash: Bytes!
}

type User @entity {
  id: ID! # user address
  positions: [Position!]! @derivedFrom(field: "user")
  liquidationsAsLiquidator: [Liquidation!]! @derivedFrom(field: "liquidator")
  liquidationsAsBorrower: [Liquidation!]! @derivedFrom(field: "borrower")
  totalLiquidationProfit: BigInt!
  liquidationCount: Int!
}

type ProtocolMetric @entity {
  id: ID! # "protocol"
  totalValueLocked: BigInt!
  totalBorrowed: BigInt!
  totalMarkets: Int!
  totalLiquidations: Int!
  totalLiquidationVolume: BigInt!
  lastUpdate: BigInt!
}
```

---

### 🛠️ Subgraph Setup Guide

#### Step 1: Install The Graph CLI

```bash
npm install -g @graphprotocol/graph-cli
```

#### Step 2: Initialize Subgraph Project

```bash
cd ism_protocol
mkdir subgraph
cd subgraph

graph init \
  --protocol ethereum \
  --product hosted-service \
  --network base-sepolia \
  YOUR_GITHUB_USERNAME/ism-protocol \
  ism-protocol
```

#### Step 3: Configure `subgraph.yaml`

**File**: `subgraph/subgraph.yaml`

```yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  # LendingPool Events (need one per market - or use templates)
  - kind: ethereum/contract
    name: LendingPool
    network: base-sepolia
    source:
      # We'll use templates to index all markets dynamically
      abi: LendingPool
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Position
        - Market
      abis:
        - name: LendingPool
          file: ../contracts/out/LendingPool.sol/LendingPool.json
      eventHandlers:
        - event: Deposit(indexed address,uint256,uint256)
          handler: handleDeposit
        - event: Borrow(indexed address,uint256)
          handler: handleBorrow
        - event: Repay(indexed address,uint256)
          handler: handleRepay
        - event: Withdraw(indexed address,uint256,uint256)
          handler: handleWithdraw
        - event: DepositCollateral(indexed address,uint256)
          handler: handleDepositCollateral
        - event: WithdrawCollateral(indexed address,uint256)
          handler: handleWithdrawCollateral
      file: ./src/lending-pool.ts

  # DutchAuctionLiquidator Events
  - kind: ethereum/contract
    name: DutchAuctionLiquidator
    network: base-sepolia
    source:
      address: "0x7514D0B0883cfCb2f7Cc5AeB512D9c5ab91160E2" # From your .env
      abi: DutchAuctionLiquidator
      startBlock: 0 # Set to deployment block for faster sync
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Auction
        - Liquidation
      abis:
        - name: DutchAuctionLiquidator
          file: ../contracts/out/DutchAuctionLiquidator.sol/DutchAuctionLiquidator.json
        - name: LendingPool
          file: ../contracts/out/LendingPool.sol/LendingPool.json
      eventHandlers:
        - event: AuctionStarted(uint256,indexed address,indexed address,uint256,uint256)
          handler: handleAuctionStarted
        - event: Liquidated(uint256,indexed address,uint256,uint256)
          handler: handleLiquidated
      file: ./src/liquidator.ts

  # MarketRegistry Events (to track new markets)
  - kind: ethereum/contract
    name: MarketRegistry
    network: base-sepolia
    source:
      address: "0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4" # From your .env
      abi: MarketRegistry
      startBlock: 0
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Market
      abis:
        - name: MarketRegistry
          file: ../contracts/out/MarketRegistry.sol/MarketRegistry.json
      eventHandlers:
        - event: MarketRegistered(indexed address,address,address)
          handler: handleMarketRegistered
      file: ./src/registry.ts

# Templates for dynamically indexing new markets
templates:
  - kind: ethereum/contract
    name: LendingPoolTemplate
    network: base-sepolia
    source:
      abi: LendingPool
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Position
        - Market
      abis:
        - name: LendingPool
          file: ../contracts/out/LendingPool.sol/LendingPool.json
      eventHandlers:
        - event: Deposit(indexed address,uint256,uint256)
          handler: handleDeposit
        - event: Borrow(indexed address,uint256)
          handler: handleBorrow
        - event: Repay(indexed address,uint256)
          handler: handleRepay
        - event: Withdraw(indexed address,uint256,uint256)
          handler: handleWithdraw
        - event: DepositCollateral(indexed address,uint256)
          handler: handleDepositCollateral
        - event: WithdrawCollateral(indexed address,uint256)
          handler: handleWithdrawCollateral
      file: ./src/lending-pool.ts
```

#### Step 4: Implement Event Handlers

**File**: `subgraph/src/lending-pool.ts`

```typescript
import { Deposit, Borrow, Repay, WithdrawCollateral, DepositCollateral } from '../generated/LendingPool/LendingPool'
import { Position, Market } from '../generated/schema'
import { BigInt, Address, BigDecimal, log } from '@graphprotocol/graph-ts'

// Helper: Calculate health factor
function calculateHealthFactor(
  collateralValue: BigInt,
  borrowedValue: BigInt,
  liquidationThreshold: BigInt // e.g., 80% = 8000 (basis points)
): BigDecimal {
  if (borrowedValue.equals(BigInt.fromI32(0))) {
    return BigDecimal.fromString('999999'); // Infinite (no debt)
  }

  // HF = (collateralValue * liquidationThreshold / 10000) / borrowedValue
  let numerator = collateralValue.times(liquidationThreshold).div(BigInt.fromI32(10000));
  let hf = numerator.toBigDecimal().div(borrowedValue.toBigDecimal());

  return hf;
}

// Helper: Load or create position
function loadOrCreatePosition(marketAddress: Address, userAddress: Address): Position {
  let id = marketAddress.toHex() + '-' + userAddress.toHex();
  let position = Position.load(id);

  if (position == null) {
    position = new Position(id);
    position.market = marketAddress.toHex();
    position.user = userAddress;
    position.supplied = BigInt.fromI32(0);
    position.collateral = BigInt.fromI32(0);
    position.borrowed = BigInt.fromI32(0);
    position.healthFactor = BigDecimal.fromString('999999');
    position.lastUpdate = BigInt.fromI32(0);
    position.isLiquidatable = false;
  }

  return position;
}

export function handleDeposit(event: Deposit): void {
  let position = loadOrCreatePosition(event.address, event.params.user);

  position.supplied = position.supplied.plus(event.params.assets);
  position.lastUpdate = event.block.timestamp;

  position.save();
}

export function handleBorrow(event: Borrow): void {
  let position = loadOrCreatePosition(event.address, event.params.user);

  position.borrowed = position.borrowed.plus(event.params.amount);
  position.lastUpdate = event.block.timestamp;

  // Fetch collateral and debt values from contract
  // (You'd need to call contract functions here for precise HF)
  // For simplicity, assume values are passed via events or use approximation

  // Example (simplified):
  let liquidationThreshold = BigInt.fromI32(8000); // 80%
  position.healthFactor = calculateHealthFactor(
    position.collateral, // This needs to be in USD terms
    position.borrowed,   // This needs to be in USD terms
    liquidationThreshold
  );

  position.isLiquidatable = position.healthFactor.lt(BigDecimal.fromString('1.0'));

  position.save();
}

export function handleRepay(event: Repay): void {
  let position = loadOrCreatePosition(event.address, event.params.user);

  position.borrowed = position.borrowed.minus(event.params.amount);
  position.lastUpdate = event.block.timestamp;

  // Recalculate health factor
  let liquidationThreshold = BigInt.fromI32(8000);
  position.healthFactor = calculateHealthFactor(
    position.collateral,
    position.borrowed,
    liquidationThreshold
  );

  position.isLiquidatable = position.healthFactor.lt(BigDecimal.fromString('1.0'));

  position.save();
}

export function handleDepositCollateral(event: DepositCollateral): void {
  let position = loadOrCreatePosition(event.address, event.params.user);

  position.collateral = position.collateral.plus(event.params.amount);
  position.lastUpdate = event.block.timestamp;

  // Recalculate HF
  let liquidationThreshold = BigInt.fromI32(8000);
  position.healthFactor = calculateHealthFactor(
    position.collateral,
    position.borrowed,
    liquidationThreshold
  );

  position.isLiquidatable = position.healthFactor.lt(BigDecimal.fromString('1.0'));

  position.save();
}

export function handleWithdrawCollateral(event: WithdrawCollateral): void {
  let position = loadOrCreatePosition(event.address, event.params.user);

  position.collateral = position.collateral.minus(event.params.amount);
  position.lastUpdate = event.block.timestamp;

  // Recalculate HF
  let liquidationThreshold = BigInt.fromI32(8000);
  position.healthFactor = calculateHealthFactor(
    position.collateral,
    position.borrowed,
    liquidationThreshold
  );

  position.isLiquidatable = position.healthFactor.lt(BigDecimal.fromString('1.0'));

  position.save();
}
```

**File**: `subgraph/src/liquidator.ts`

```typescript
import { AuctionStarted, Liquidated } from '../generated/DutchAuctionLiquidator/DutchAuctionLiquidator'
import { Auction, Liquidation, User } from '../generated/schema'
import { BigInt, Address } from '@graphprotocol/graph-ts'

export function handleAuctionStarted(event: AuctionStarted): void {
  let auction = new Auction(event.params.auctionId.toString());

  auction.market = event.params.pool.toHex();
  auction.borrower = event.params.borrower;
  auction.collateralAmount = event.params.collateralAmount;
  auction.debtAmount = event.params.debtAmount;
  auction.startTime = event.block.timestamp;
  auction.endTime = event.block.timestamp.plus(BigInt.fromI32(1200)); // 20 min default
  auction.startPrice = BigInt.fromI32(0); // Fetch from contract if available
  auction.endPrice = BigInt.fromI32(0); // Fetch from contract if available
  auction.isActive = true;
  auction.startedBy = event.transaction.from;

  auction.save();
}

export function handleLiquidated(event: Liquidated): void {
  // Load auction
  let auction = Auction.load(event.params.auctionId.toString());
  if (auction == null) {
    return; // Should not happen
  }

  // Mark auction as inactive
  auction.isActive = false;
  auction.save();

  // Create liquidation record
  let liquidation = new Liquidation(event.transaction.hash.toHex() + '-' + event.logIndex.toString());

  liquidation.auction = auction.id;
  liquidation.liquidator = event.params.liquidator;
  liquidation.borrower = auction.borrower;
  liquidation.market = auction.market;
  liquidation.debtRepaid = event.params.debtRepaid;
  liquidation.collateralReceived = event.params.collateralReceived;
  liquidation.profit = event.params.collateralReceived.minus(event.params.debtRepaid); // Simplified
  liquidation.timestamp = event.block.timestamp;
  liquidation.transactionHash = event.transaction.hash;

  liquidation.save();

  // Update user statistics
  let user = User.load(event.params.liquidator.toHex());
  if (user == null) {
    user = new User(event.params.liquidator.toHex());
    user.totalLiquidationProfit = BigInt.fromI32(0);
    user.liquidationCount = 0;
  }

  user.totalLiquidationProfit = user.totalLiquidationProfit.plus(liquidation.profit);
  user.liquidationCount = user.liquidationCount + 1;

  user.save();
}
```

**File**: `subgraph/src/registry.ts`

```typescript
import { MarketRegistered } from '../generated/MarketRegistry/MarketRegistry'
import { Market } from '../generated/schema'
import { LendingPoolTemplate } from '../generated/templates'

export function handleMarketRegistered(event: MarketRegistered): void {
  let market = new Market(event.params.pool.toHex());

  market.collateralToken = event.params.collateralToken;
  market.borrowToken = event.params.borrowToken;
  market.totalSupplyAssets = BigInt.fromI32(0);
  market.totalBorrowAssets = BigInt.fromI32(0);
  market.totalCollateral = BigInt.fromI32(0);
  market.utilization = BigDecimal.fromString('0');
  market.supplyAPY = BigDecimal.fromString('0');
  market.borrowAPY = BigDecimal.fromString('0');
  market.createdAt = event.block.timestamp;

  market.save();

  // Start indexing events from this new market
  LendingPoolTemplate.create(event.params.pool);
}
```

#### Step 5: Build and Deploy

```bash
# Generate types from schema and ABIs
graph codegen

# Build subgraph (compiles to WASM)
graph build

# Deploy to The Graph Studio (or hosted service)
graph auth --studio YOUR_DEPLOY_KEY
graph deploy --studio ism-protocol
```

#### Step 6: Query Your Subgraph

Once deployed, you'll get a GraphQL endpoint:
```
https://api.studio.thegraph.com/query/YOUR_SUBGRAPH_ID/ism-protocol/v0.0.1
```

**Example Queries**:

```graphql
# Get liquidatable positions
query LiquidatablePositions {
  positions(
    where: { isLiquidatable: true }
    orderBy: healthFactor
    orderDirection: asc
  ) {
    id
    user
    market {
      id
      collateralToken
      borrowToken
    }
    collateral
    borrowed
    healthFactor
  }
}

# Get active auctions
query ActiveAuctions {
  auctions(where: { isActive: true }) {
    id
    borrower
    market {
      id
    }
    collateralAmount
    debtAmount
    startTime
    endTime
    startedBy
  }
}

# Get liquidation history
query LiquidationHistory($liquidator: Bytes!) {
  liquidations(
    where: { liquidator: $liquidator }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    borrower
    debtRepaid
    collateralReceived
    profit
    timestamp
    transactionHash
  }
}

# Get user stats
query UserStats($address: ID!) {
  user(id: $address) {
    totalLiquidationProfit
    liquidationCount
    positions {
      id
      market {
        id
      }
      healthFactor
    }
  }
}
```

---

### ✅ Subgraph Deployment Checklist

#### Phase 1: Setup (4 hours)
- [ ] Install Graph CLI
- [ ] Initialize subgraph project
- [ ] Copy contract ABIs to subgraph folder
- [ ] Define schema.graphql

#### Phase 2: Event Handlers (8 hours)
- [ ] Implement lending pool handlers
- [ ] Implement liquidator handlers
- [ ] Implement registry handlers
- [ ] Add helper functions (HF calculation)
- [ ] Test locally with graph-node (optional)

#### Phase 3: Deploy (2 hours)
- [ ] Codegen and build
- [ ] Deploy to The Graph Studio
- [ ] Wait for sync (can take 30 min - 2 hours)
- [ ] Test queries in GraphiQL playground

#### Phase 4: Integration (2 hours)
- [ ] Update frontend hooks to use subgraph
- [ ] Test all queries
- [ ] Add error handling
- [ ] Document endpoints

**Total Time Estimate**: 16 hours (2 days)

---

## Feature 3: Enhanced Liquidation Bot

### 🤖 Hybrid Approach Implementation

Update the existing liquidation bot (`liquidation_bot/`) to support the hybrid approach inspired by MakerDAO and Euler.

---

### 🔧 Bot Configuration

**File**: `liquidation_bot/src/config.ts`

```typescript
export const LIQUIDATION_BOT_CONFIG = {
  // Operating mode
  mode: process.env.BOT_MODE || 'backup', // 'competitive' | 'backup' | 'always' | 'disabled'

  // Backup mode delay (minutes to wait before starting auction)
  backupDelayMinutes: parseInt(process.env.BACKUP_DELAY_MINUTES || '10'),

  // Minimum profit threshold (in USD)
  minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || '50'),

  // Max gas price willing to pay (gwei)
  maxGasPriceGwei: parseInt(process.env.MAX_GAS_PRICE_GWEI || '10'),

  // Monitoring interval (seconds)
  monitoringIntervalSeconds: parseInt(process.env.MONITORING_INTERVAL_SECONDS || '30'),

  // Subgraph endpoint
  subgraphUrl: process.env.SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/.../ism-protocol/v0.0.1',
};

// Mode descriptions:
// 'competitive': Start auctions immediately when found (compete with community)
// 'backup': Wait backupDelayMinutes before starting (safety net only)
// 'always': Start ALL auctions instantly (centralized, not recommended for production)
// 'disabled': Only participate in existing auctions, never start new ones
```

---

### 📊 Enhanced Bot Logic

**File**: `liquidation_bot/src/liquidation/auctionMonitor.ts`

```typescript
import { gql, request } from 'graphql-request';
import { LIQUIDATION_BOT_CONFIG } from '../config';
import { getContractAddress } from '../contracts/addresses';
import { startAuction, liquidate } from './executor';
import logger from '../logger';

interface LiquidatablePosition {
  borrower: string;
  market: string;
  healthFactor: number;
  collateral: bigint;
  debt: bigint;
  lastUpdate: number; // timestamp when position became liquidatable
}

// Track when each position became liquidatable (for backup delay)
const liquidatablePositionsTracker = new Map<string, number>();

async function fetchLiquidatablePositions(): Promise<LiquidatablePosition[]> {
  const query = gql`
    query {
      positions(where: { isLiquidatable: true }) {
        user
        market { id }
        healthFactor
        collateral
        borrowed
        lastUpdate
      }
    }
  `;

  try {
    const data = await request(LIQUIDATION_BOT_CONFIG.subgraphUrl, query);
    return data.positions.map((p: any) => ({
      borrower: p.user,
      market: p.market.id,
      healthFactor: parseFloat(p.healthFactor),
      collateral: BigInt(p.collateral),
      debt: BigInt(p.borrowed),
      lastUpdate: parseInt(p.lastUpdate),
    }));
  } catch (error) {
    logger.error('Failed to fetch liquidatable positions from subgraph', { error });
    return [];
  }
}

async function checkExistingAuction(market: string, borrower: string): Promise<boolean> {
  const query = gql`
    query($market: String!, $borrower: Bytes!) {
      auctions(where: { market: $market, borrower: $borrower, isActive: true }) {
        id
      }
    }
  `;

  try {
    const data = await request(LIQUIDATION_BOT_CONFIG.subgraphUrl, query, { market, borrower });
    return data.auctions.length > 0;
  } catch (error) {
    logger.error('Failed to check existing auction', { error });
    return false;
  }
}

function getTimeUnderwaterMinutes(borrower: string, market: string): number {
  const key = `${market}-${borrower}`;
  const firstSeenTime = liquidatablePositionsTracker.get(key);

  if (!firstSeenTime) {
    // First time seeing this position as liquidatable
    liquidatablePositionsTracker.set(key, Date.now());
    return 0;
  }

  const minutesElapsed = (Date.now() - firstSeenTime) / 1000 / 60;
  return minutesElapsed;
}

export async function monitorLiquidations() {
  logger.info('Starting liquidation monitoring', {
    mode: LIQUIDATION_BOT_CONFIG.mode,
    backupDelay: LIQUIDATION_BOT_CONFIG.backupDelayMinutes,
  });

  const positions = await fetchLiquidatablePositions();

  if (positions.length === 0) {
    logger.info('No liquidatable positions found');
    return;
  }

  logger.info(`Found ${positions.length} liquidatable positions`);

  for (const position of positions) {
    logger.info('Evaluating position', {
      borrower: position.borrower,
      market: position.market,
      healthFactor: position.healthFactor,
    });

    // Check if auction already exists
    const auctionExists = await checkExistingAuction(position.market, position.borrower);

    if (auctionExists) {
      logger.info('Auction already exists, attempting to liquidate', {
        borrower: position.borrower,
      });

      // Try to liquidate existing auction
      await attemptLiquidation(position);
      continue;
    }

    // No auction exists - decide whether to start one based on mode
    const shouldStart = await shouldStartAuction(position);

    if (shouldStart) {
      logger.warn(`Starting auction for ${position.borrower}`, {
        healthFactor: position.healthFactor,
        mode: LIQUIDATION_BOT_CONFIG.mode,
      });

      await startAuction(position.market, position.borrower);

      // Optionally, immediately try to liquidate it ourselves
      // (Uncomment if you want bot to be aggressive)
      // await attemptLiquidation(position);
    } else {
      const timeUnderwater = getTimeUnderwaterMinutes(position.borrower, position.market);
      logger.info(`Waiting for community to start auction`, {
        borrower: position.borrower,
        timeUnderwater: `${timeUnderwater.toFixed(1)} minutes`,
        backupDelay: `${LIQUIDATION_BOT_CONFIG.backupDelayMinutes} minutes`,
      });
    }
  }
}

async function shouldStartAuction(position: LiquidatablePosition): Promise<boolean> {
  const mode = LIQUIDATION_BOT_CONFIG.mode;

  if (mode === 'disabled') {
    return false;
  }

  if (mode === 'always') {
    return true; // Start every liquidatable position immediately
  }

  if (mode === 'competitive') {
    return true; // Compete with community, start immediately
  }

  if (mode === 'backup') {
    // Only start if position has been liquidatable for longer than backup delay
    const timeUnderwater = getTimeUnderwaterMinutes(position.borrower, position.market);
    const shouldStart = timeUnderwater >= LIQUIDATION_BOT_CONFIG.backupDelayMinutes;

    if (shouldStart) {
      logger.warn(`BACKUP MODE ACTIVATED - Community did not start auction within ${LIQUIDATION_BOT_CONFIG.backupDelayMinutes} minutes`);
    }

    return shouldStart;
  }

  return false;
}

async function attemptLiquidation(position: LiquidatablePosition) {
  // Calculate if liquidation is profitable
  // (You'd query oracle prices, calculate profit, compare to gas cost)

  const isProfitable = true; // Placeholder - implement profit check

  if (!isProfitable) {
    logger.info('Liquidation not profitable, skipping', {
      borrower: position.borrower,
    });
    return;
  }

  logger.info('Attempting liquidation', {
    borrower: position.borrower,
    estimatedProfit: 'TBD',
  });

  // Execute liquidation
  await liquidate(position.market, position.borrower, position.debt);
}

// Main loop
export async function startMonitoring() {
  setInterval(async () => {
    try {
      await monitorLiquidations();
    } catch (error) {
      logger.error('Error in monitoring loop', { error });
    }
  }, LIQUIDATION_BOT_CONFIG.monitoringIntervalSeconds * 1000);

  // Run immediately on start
  await monitorLiquidations();
}
```

---

### 📊 Bot Dashboard (Optional)

**File**: `liquidation_bot/src/dashboard/server.ts`

```typescript
import express from 'express';
import { getLiquidationStats } from '../stats';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

app.get('/stats', async (req, res) => {
  const stats = await getLiquidationStats();
  res.json(stats);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: LIQUIDATION_BOT_CONFIG.mode,
    uptime: process.uptime(),
  });
});

app.listen(PORT, () => {
  console.log(`Bot dashboard running on http://localhost:${PORT}`);
});
```

---

### ✅ Bot Enhancement Checklist

#### Phase 1: Configuration (2 hours)
- [ ] Add mode configuration (competitive/backup/always/disabled)
- [ ] Add backup delay parameter
- [ ] Add profit threshold settings
- [ ] Update environment variables

#### Phase 2: Subgraph Integration (3 hours)
- [ ] Install graphql-request
- [ ] Implement fetchLiquidatablePositions
- [ ] Implement checkExistingAuction
- [ ] Test queries against deployed subgraph

#### Phase 3: Mode Logic (4 hours)
- [ ] Implement shouldStartAuction logic
- [ ] Add time tracking for backup mode
- [ ] Add profit calculator
- [ ] Implement startAuction function
- [ ] Test each mode (competitive/backup/disabled)

#### Phase 4: Monitoring & Logging (2 hours)
- [ ] Enhanced logging for each decision
- [ ] Dashboard endpoint (optional)
- [ ] Metrics tracking (auctions started, profits, etc.)
- [ ] Alert system (optional - Telegram/Discord bot)

#### Phase 5: Testing (3 hours)
- [ ] Test backup mode delay
- [ ] Test competitive mode
- [ ] Test liquidation execution
- [ ] Monitor gas usage
- [ ] Verify profit calculations

**Total Time Estimate**: 14 hours (2 days)

---

## Feature 4: Dashboard Analytics

*(Keep existing Feature 2 content from original plan - unchanged)*

### 🎯 Goals
- Visualize interest earned over time
- Display historical APY trends
- Show utilization rate graphs
- Track portfolio performance
- Provide time-range filters (24h, 7d, 30d, All)

### 📊 Analytics Components

*(Same as original plan - pages 447-946 of original)*

---

### ✅ Implementation Checklist - Dashboard Analytics

*(Same as original plan)*

---

## Feature 5: Core UX Enhancements

*(Keep existing Feature 3 content from original plan - unchanged)*

### Enhancement 5.1: Filter Buttons on Home Page
### Enhancement 5.2: Toast Notifications
### Enhancement 5.3: Mobile Optimization

*(Same as original plan - pages 949-1316 of original)*

---

## Implementation Timeline

### 🗓️ Updated Timeline (2-3 Weeks)

#### **Week 1: Infrastructure**

**Day 1-2: Subgraph Deployment**
- [ ] Morning: Set up The Graph project, define schema
- [ ] Afternoon: Implement event handlers for lending pools
- [ ] Evening: Implement liquidator event handlers
- [ ] Next Day: Deploy to Studio, test queries

**Day 3: Bot Enhancement**
- [ ] Morning: Add mode configuration (backup/competitive)
- [ ] Afternoon: Integrate subgraph queries into bot
- [ ] Evening: Test backup mode delay logic

**Day 4-5: Liquidations Page - Layer 1 & 2**
- [ ] Morning: Build OpportunitiesTab with liquidatable positions
- [ ] Afternoon: Implement useStartAuction hook
- [ ] Evening: Build ActiveAuctionsTab
- [ ] Next Day: Implement liquidation execution

**Day 6: Liquidations Page - Layer 3**
- [ ] Morning: Build HistoryTab with subgraph queries
- [ ] Afternoon: Build MyLiquidationsTab
- [ ] Evening: Add CSV export, polish UI

**Day 7: Liquidations Testing**
- [ ] Full end-to-end testing of all 3 layers
- [ ] Test on testnet with real positions
- [ ] Fix bugs, add loading states

---

#### **Week 2: Analytics & Polish**

**Day 8-9: Dashboard Analytics**
- [ ] Install Recharts
- [ ] Build Interest Earned chart
- [ ] Build APY History chart
- [ ] Build Utilization chart
- [ ] Build Portfolio Value chart

**Day 10: Analytics Integration**
- [ ] Add AnalyticsSection to dashboard
- [ ] Implement time range filtering
- [ ] Connect to subgraph for historical data
- [ ] Test charts with real data

**Day 11: Core Enhancements**
- [ ] Implement filter buttons on home page
- [ ] Add toast notifications system
- [ ] Test notification flows

**Day 12-13: Mobile Optimization**
- [ ] Responsive header and navigation
- [ ] Mobile-friendly forms
- [ ] Responsive charts
- [ ] Test on multiple devices

**Day 14: Final Testing & Documentation**
- [ ] End-to-end testing of all features
- [ ] Fix bugs
- [ ] Update documentation
- [ ] Deploy to production

---

## Technical Specifications

### State Management
- **Local State**: React `useState` for UI state
- **Server State**: wagmi hooks with React Query caching
- **Subgraph Queries**: graphql-request with React Query
- **Refetch Intervals**: 12 seconds (Base block time)

### Performance Optimizations
- **Batch Contract Reads**: Use `useReadContracts` for multiple calls
- **Memoization**: `useMemo` for expensive calculations
- **Lazy Loading**: Code-split charts with `dynamic()` imports
- **Debouncing**: Debounce user inputs (search, filters)
- **Subgraph Caching**: React Query caches subgraph responses

### Error Handling
- Use existing `errorMessages.ts` utility
- Display user-friendly messages via toast
- Log errors to console in development
- Consider Sentry for production error tracking

### Accessibility
- Keyboard navigation support
- ARIA labels for charts
- Screen reader announcements for transactions
- High contrast mode support

---

## Testing Checklist

### Subgraph
- [ ] Schema compiles without errors
- [ ] Event handlers process events correctly
- [ ] Entities are created and updated
- [ ] Queries return expected data
- [ ] Syncs from deployment block

### Liquidations Page - Layer 1
- [ ] Liquidatable positions display correctly
- [ ] Health factors calculated accurately
- [ ] Start auction button works
- [ ] Gas estimation accurate
- [ ] Empty state displays when no positions

### Liquidations Page - Layer 2
- [ ] Active auctions display correctly
- [ ] Real-time price updates every second
- [ ] Countdown timer accurate
- [ ] Profit calculator shows correct values
- [ ] Liquidation execution successful
- [ ] Handles auction expiration

### Liquidations Page - Layer 3
- [ ] Historical liquidations display
- [ ] My Liquidations filter works
- [ ] CSV export works
- [ ] Pagination works
- [ ] Statistics accurate

### Liquidation Bot
- [ ] Backup mode waits correct delay
- [ ] Competitive mode starts immediately
- [ ] Profit calculations accurate
- [ ] Gas price limits respected
- [ ] Handles RPC errors gracefully
- [ ] Logging is clear and useful

### Dashboard Analytics
- [ ] All charts render correctly
- [ ] Time range filters work
- [ ] Data loads from subgraph
- [ ] Empty states display
- [ ] Export functionality works
- [ ] Mobile responsive

### Core Enhancements
- [ ] Filter buttons work correctly
- [ ] Toast notifications appear
- [ ] Transaction toasts link to explorer
- [ ] Mobile menu works
- [ ] Mobile forms usable
- [ ] Touch interactions work

---

## Success Metrics

### Completion Criteria
- ✅ Subgraph deployed and syncing
- ✅ All 3 liquidation layers functional
- ✅ Bot running in backup mode
- ✅ Analytics charts displaying historical data
- ✅ Mobile responsive across all pages
- ✅ Documentation updated

### User Experience Goals
- Liquidatable positions are discoverable before auctions start
- Users can compete fairly in auctions
- Analytics provide clear historical insights
- UI is intuitive on desktop and mobile
- Transactions smooth with clear feedback
- Bot provides safety net without centralizing

### Performance Targets
- Page load time < 2 seconds
- Subgraph queries < 500ms
- Chart rendering < 500ms
- Real-time auction price updates every 1s
- Bot monitoring cycle < 30s
- Mobile animations smooth (60fps)

### Protocol Safety Metrics
- Zero instances of bad debt accumulation
- 100% of liquidatable positions auctioned within 15 minutes
- Bot backup activates < 5% of the time (community handles 95%+)
- Average liquidation profit > $50

---

## Real-World Production Examples

### Lessons from Leading Protocols

#### **MakerDAO** (MIP-63)
- **Strategy**: Runs 4 keeper networks for redundancy
- **Rationale**: March 2020 event taught importance of backup
- **Our Adoption**: Backup mode with 10-minute delay

#### **Euler Finance**
- **Strategy**: Official bot + partner redundancy
- **Quote**: "Partners operate additional bots for redundancy"
- **Our Adoption**: Could add partner bot program in future

#### **Liquity**
- **Strategy**: Stability Pool + bot backup
- **Innovation**: Economic design reduces bot dependency
- **Our Adoption**: Focus on economic incentives (auction design)

---

## Future Enhancements (Post-MVP)

### Phase 2 Features
1. **Partner Bot Program**
   - Whitelist partner bots for redundancy
   - Dashboard for partner bot performance
   - Revenue sharing model

2. **Advanced Analytics**
   - Liquidation profitability charts
   - Bot performance comparison
   - Market health indicators
   - Risk scores

3. **Notifications**
   - Telegram bot for liquidation alerts
   - Email alerts for large opportunities
   - Discord integration

4. **MEV Protection**
   - Flashbot integration
   - Private mempool submission
   - MEV profit sharing

---

## Resources

### Documentation
- The Graph Docs: https://thegraph.com/docs/
- Recharts Docs: https://recharts.org/en-US/
- React Hot Toast: https://react-hot-toast.com/
- wagmi Docs: https://wagmi.sh/
- graphql-request: https://github.com/jasonkuhrt/graphql-request

### Inspiration
- MakerDAO MIP-63: https://mips.makerdao.com/mips/details/MIP63
- Euler Liquidation Bot: https://github.com/euler-xyz/liquidation-bot-v2
- Liquity LiqBot: https://github.com/liquity/liqbot
- Aave Liquidations: https://app.aave.com/liquidations

### Tools
- The Graph Studio: https://thegraph.com/studio/
- Base Sepolia Explorer: https://sepolia.basescan.org/
- GraphiQL Playground: (in The Graph Studio)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-17 | Initial plan created |
| 2.0 | 2026-03-17 | **Major update**: Added 3-layer liquidations, hybrid approach, subgraph, bot enhancements, real-world examples |

---

**Ready to build the complete liquidation system! 🚀**

**Key Improvements in v2.0**:
- ✅ 3-layer liquidation discovery (Opportunities/Active/History)
- ✅ Hybrid bot approach (MakerDAO-inspired)
- ✅ Complete subgraph deployment guide
- ✅ Real-world production examples
- ✅ Enhanced timeline (2-3 weeks)
- ✅ Bot safety net with backup mode
