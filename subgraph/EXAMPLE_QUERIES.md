# ISM Protocol Subgraph - Example Queries

**Endpoint**: https://api.studio.thegraph.com/query/122239/ism-protocol/v0.1

Test these queries in the [GraphQL Playground](https://api.studio.thegraph.com/query/122239/ism-protocol/v0.1) or use them in your frontend.

## 🎯 Liquidation Queries

### 1. Get All Liquidatable Positions

Find positions ready for liquidation (health factor < 1.0):

```graphql
query LiquidatablePositions {
  positions(
    where: {
      healthFactor_lt: "1.0"
      borrowedAmount_gt: "0"
    }
    orderBy: healthFactor
    orderDirection: asc
    first: 50
  ) {
    id
    user {
      id
    }
    market {
      id
      collateralToken {
        symbol
        decimals
      }
      borrowToken {
        symbol
        decimals
      }
    }
    collateralAmount
    borrowedAmount
    healthFactor
    timeUnderwater
    underwaterSince
    lastUpdate
  }
}
```

### 2. Get Active Auctions

Find ongoing Dutch auctions:

```graphql
query ActiveAuctions {
  auctions(
    where: { isActive: true }
    orderBy: startTime
    orderDirection: desc
    first: 20
  ) {
    id
    borrower {
      id
    }
    market {
      id
      collateralToken { symbol }
      borrowToken { symbol }
    }
    collateralAmount
    debtAmount
    startTime
    endTime
    startPriceMultiplier
    endPriceMultiplier
    currentPriceMultiplier
    startedBy
  }
}
```

### 3. Get Liquidation History

View completed liquidations:

```graphql
query LiquidationHistory($first: Int = 50, $skip: Int = 0) {
  liquidations(
    orderBy: timestamp
    orderDirection: desc
    first: $first
    skip: $skip
  ) {
    id
    liquidator {
      id
    }
    borrower {
      id
    }
    market {
      id
      collateralToken { symbol }
      borrowToken { symbol }
    }
    debtRepaid
    collateralReceived
    penalty
    profitUSD
    timestamp
    transactionHash
    blockNumber
  }
}
```

### 4. Get User's Liquidation Activity

Find liquidations executed by a specific user:

```graphql
query UserLiquidations($userAddress: String!) {
  liquidations(
    where: { liquidator: $userAddress }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    borrower { id }
    market {
      collateralToken { symbol }
      borrowToken { symbol }
    }
    debtRepaid
    collateralReceived
    profitUSD
    timestamp
  }
}
```

## 📊 Market Queries

### 5. Get All Markets

List all lending markets:

```graphql
query Markets {
  markets(first: 100) {
    id
    collateralToken {
      symbol
      name
      decimals
    }
    borrowToken {
      symbol
      name
      decimals
    }
    totalSupplyAssets
    totalBorrowAssets
    totalCollateral
    utilizationRate
    borrowRate
    supplyRate
    ltv
    liquidationThreshold
    createdAt
  }
}
```

### 6. Get Market Details

Get specific market data:

```graphql
query MarketDetails($marketId: ID!) {
  market(id: $marketId) {
    id
    collateralToken {
      symbol
      name
      decimals
    }
    borrowToken {
      symbol
      name
      decimals
    }
    totalSupplyAssets
    totalBorrowAssets
    totalCollateral
    totalReserves
    utilizationRate
    borrowRate
    supplyRate
    borrowIndex
    ltv
    liquidationThreshold
    liquidationPenalty
    createdAt
    lastUpdate
  }
}
```

## 👤 User Queries

### 7. Get User Positions

View all positions for a user:

```graphql
query UserPositions($userAddress: String!) {
  positions(where: { user: $userAddress }) {
    id
    market {
      id
      collateralToken { symbol }
      borrowToken { symbol }
    }
    suppliedAssets
    suppliedShares
    collateralAmount
    borrowedAmount
    borrowShares
    healthFactor
    isLiquidatable
    timeUnderwater
    lastUpdate
  }
}
```

### 8. Get User Profile

Complete user activity overview:

```graphql
query UserProfile($userAddress: ID!) {
  user(id: $userAddress) {
    id
    totalSuppliedUSD
    totalBorrowedUSD
    totalLiquidations
    totalLiquidationsExecuted
    totalProfitUSD
    firstInteraction
    lastInteraction
    positions {
      id
      market { id }
      healthFactor
      isLiquidatable
    }
    liquidationsReceived {
      id
      timestamp
      debtRepaid
    }
    liquidationsExecuted {
      id
      timestamp
      profitUSD
    }
  }
}
```

## 📈 Analytics Queries

### 9. Get Daily Market Snapshots

Historical data for charts:

```graphql
query MarketSnapshots($marketId: ID!, $days: Int = 30) {
  marketSnapshots(
    where: { market: $marketId }
    orderBy: day
    orderDirection: desc
    first: $days
  ) {
    id
    day
    totalSupplyAssets
    totalBorrowAssets
    totalCollateral
    borrowRate
    supplyRate
    utilizationRate
    dailyDeposits
    dailyWithdrawals
    dailyBorrows
    dailyRepayments
    dailyLiquidations
    dailyDepositVolumeUSD
    dailyBorrowVolumeUSD
    timestamp
  }
}
```

### 10. Get Protocol Overview

Global protocol statistics:

```graphql
query ProtocolOverview {
  protocol(id: "protocol") {
    totalMarkets
    totalValueLockedUSD
    totalBorrowedUSD
    totalLiquidationsUSD
    lastUpdate
  }
  markets(first: 10, orderBy: totalSupplyAssets, orderDirection: desc) {
    id
    totalSupplyAssets
    totalBorrowAssets
    utilizationRate
  }
}
```

## 🔍 Transaction Queries

### 11. Get Recent Transactions

Latest protocol activity:

```graphql
query RecentTransactions($first: Int = 50) {
  transactions(
    orderBy: timestamp
    orderDirection: desc
    first: $first
  ) {
    id
    type
    user { id }
    market {
      id
      collateralToken { symbol }
      borrowToken { symbol }
    }
    amount
    amountUSD
    timestamp
    transactionHash
    blockNumber
  }
}
```

### 12. Get User Transaction History

All transactions for a specific user:

```graphql
query UserTransactions($userAddress: String!, $first: Int = 100) {
  transactions(
    where: { user: $userAddress }
    orderBy: timestamp
    orderDirection: desc
    first: $first
  ) {
    id
    type
    market {
      collateralToken { symbol }
      borrowToken { symbol }
    }
    amount
    amountUSD
    timestamp
    transactionHash
  }
}
```

## 🎲 Advanced Queries

### 13. Find High-Value Liquidation Opportunities

Positions with significant debt and low health factor:

```graphql
query HighValueOpportunities {
  positions(
    where: {
      healthFactor_lt: "1.0"
      borrowedAmount_gt: "1000000000000000000" # > 1 token
    }
    orderBy: borrowedAmount
    orderDirection: desc
    first: 20
  ) {
    id
    user { id }
    market {
      borrowToken { symbol decimals }
      collateralToken { symbol decimals }
    }
    borrowedAmount
    collateralAmount
    healthFactor
    timeUnderwater
  }
}
```

### 14. Monitor Auction Price Decay

Track auction price changes:

```graphql
query AuctionPriceTracking($auctionId: ID!) {
  auction(id: $auctionId) {
    id
    borrower { id }
    collateralAmount
    debtAmount
    startTime
    endTime
    startPriceMultiplier
    endPriceMultiplier
    currentPriceMultiplier
    isActive
    liquidation {
      id
      debtRepaid
      collateralReceived
      timestamp
    }
  }
}
```

### 15. Market Utilization Trends

Track how markets are being used:

```graphql
query MarketUtilizationTrends {
  markets(
    orderBy: utilizationRate
    orderDirection: desc
    first: 10
  ) {
    id
    collateralToken { symbol }
    borrowToken { symbol }
    totalSupplyAssets
    totalBorrowAssets
    utilizationRate
    borrowRate
    supplyRate
  }
}
```

## 🧪 Testing Tips

1. **Start Simple**: Test with query #1 or #5 to verify data is being indexed
2. **Check Timestamps**: Look at `lastUpdate` fields to see how fresh the data is
3. **Use Variables**: GraphQL variables make queries reusable
4. **Pagination**: Use `first` and `skip` for large result sets
5. **Monitor Studio**: Check indexing progress at https://thegraph.com/studio/subgraph/ism-protocol

## 🔧 Using in Frontend

Example with React Query:

```typescript
import { useQuery } from '@tanstack/react-query';
import { request, gql } from 'graphql-request';

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL!;

export function useLiquidatablePositions() {
  return useQuery({
    queryKey: ['liquidatable-positions'],
    queryFn: async () => {
      const query = gql`
        query {
          positions(where: { healthFactor_lt: "1.0" }) {
            id
            healthFactor
            borrowedAmount
          }
        }
      `;
      return request(SUBGRAPH_URL, query);
    },
    refetchInterval: 12000, // 12 seconds
  });
}
```

## 📚 Resources

- [GraphQL Playground](https://api.studio.thegraph.com/query/122239/ism-protocol/v0.1)
- [The Graph Studio](https://thegraph.com/studio/subgraph/ism-protocol)
- [GraphQL Docs](https://graphql.org/learn/)
