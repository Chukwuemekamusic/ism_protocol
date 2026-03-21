# ISM Protocol - Developer Integration Guide

This guide helps developers integrate ISM Protocol into their applications.

---

## Quick Start

### Installation

```bash
npm install ethers@6
# or for React apps
npm install wagmi viem @tanstack/react-query
```

### Basic Example: Read Market Data

```typescript
import { ethers } from 'ethers';
import LendingPoolABI from './abis/LendingPool.json';

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const poolAddress = '0x2C201C3FCdB6073d0f895D29bf8F8A93d2D67A0E';
const pool = new ethers.Contract(poolAddress, LendingPoolABI, provider);

async function getMarketInfo() {
  const totalSupply = await pool.totalSupplyAssets();
  const totalBorrow = await pool.totalBorrowAssets();
  console.log('Total Supply:', ethers.formatUnits(totalSupply, 6), 'USDC');
  console.log('Total Borrow:', ethers.formatUnits(totalBorrow, 6), 'USDC');
}
```

---

## Contract Addresses & ABIs

### Base Sepolia Testnet

| Contract | Address |
|----------|---------|
| **MarketFactory** | `0x403276c627737cAb896BbdDEfEd4538d9a6aE5C0` |
| **MarketRegistry** | `0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4` |
| **OracleRouter** | `0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97` |
| **WETH/USDC Pool** | `0x2C201C3FCdB6073d0f895D29bf8F8A93d2D67A0E` |

See [TESTNET.md](./TESTNET.md) for complete list.

### ABIs

ABIs available in `contracts/out/[ContractName].sol/[ContractName].json`

Or import from deployment JSON:
```typescript
import deployments from './deployments/84532.json';
```

---

## Core Integration Patterns

### 1. Reading User Positions

```typescript
async function getUserPosition(poolAddress, userAddress) {
  const pool = new ethers.Contract(poolAddress, LendingPoolABI, provider);
  
  const supplied = await pool.balanceOfUnderlying(userAddress);
  const position = await pool.positions(userAddress);
  const debt = await pool.getUserDebt(userAddress);
  const healthFactor = await pool.healthFactor(userAddress);

  return {
    supplied,
    collateral: position.collateralAmount,
    borrowed: debt,
    healthFactor: Number(healthFactor) / 1e18
  };
}
```

### 2. Fetching Prices

```typescript
async function getTokenPrice(tokenAddress) {
  const oracleAddress = '0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97';
  const oracle = new ethers.Contract(oracleAddress, OracleRouterABI, provider);
  const price = await oracle.getPrice(tokenAddress);
  return Number(price) / 1e18; // Returns USD price
}
```

### 3. Supplying Assets

```typescript
async function supplyUSDC(signer, amount) {
  const poolAddress = '0x2C201C3FCdB6073d0f895D29bf8F8A93d2D67A0E';
  const usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

  const pool = new ethers.Contract(poolAddress, LendingPoolABI, signer);
  const usdc = new ethers.Contract(usdcAddress, ERC20ABI, signer);

  // 1. Approve
  await usdc.approve(poolAddress, amount);
  
  // 2. Supply
  await pool.deposit(amount);
}
```

---

## React/wagmi Integration

### Custom Hook: useMarketData

```typescript
import { useReadContracts } from 'wagmi';

export function useMarketData(marketAddress: `0x${string}`) {
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'totalSupplyAssets',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'totalBorrowAssets',
      },
    ],
  }) as { data: any; isLoading: boolean };

  return {
    totalSupply: data?.[0]?.result || 0n,
    totalBorrow: data?.[1]?.result || 0n,
    isLoading,
  };
}
```

---

## Subgraph Integration

### Endpoint
```
https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest
```

### Example Query

```graphql
query GetMarkets {
  markets {
    id
    totalSupply
    totalBorrow
    utilization
  }
}
```

### JavaScript Integration

```typescript
async function querySubgraph(query: string) {
  const response = await fetch(
    'https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }
  );
  return await response.json();
}
```

---

## Error Handling

```typescript
try {
  await pool.borrow(amount);
} catch (error) {
  if (error.message.includes('WouldBeUndercollateralized')) {
    alert('Insufficient collateral');
  } else if (error.message.includes('InsufficientLiquidity')) {
    alert('Not enough liquidity');
  }
}
```

### Common Errors

| Error | Solution |
|-------|----------|
| `WouldBeUndercollateralized` | Reduce borrow or add collateral |
| `InsufficientLiquidity` | Try smaller amount |
| `OracleNotConfigured` | Price feed unavailable |

---

## Testing Your Integration

### Fork Testing

```typescript
// hardhat.config.ts
export default {
  networks: {
    hardhat: {
      forking: {
        url: 'https://sepolia.base.org',
      },
    },
  },
};
```

---

## Resources

- **Contract Source**: [GitHub](https://github.com/Chukwuemekamusic/ism_protocol/tree/main/contracts/src)
- **User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)
- **Testnet Info**: [TESTNET.md](./TESTNET.md)
- **FAQ**: [FAQ.md](./FAQ.md)

---

**Built with ❤️ on Base**
