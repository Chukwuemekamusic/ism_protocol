'use client';

import { useReadContracts } from 'wagmi';
import { LENDING_POOL_ABI, ERC20_ABI } from '@/lib/contracts/abis';
import { calculateAPY, calculateUtilization } from '@/lib/utils/calculations';
import { formatUnits } from 'viem';

export interface MarketData {
  address: `0x${string}`;
  collateralToken: `0x${string}`;
  borrowToken: `0x${string}`;
  collateralSymbol: string;
  borrowSymbol: string;
  collateralDecimals: number;
  borrowDecimals: number;
  totalSupply: bigint;
  totalBorrow: bigint;
  supplyRate: bigint;
  borrowRate: bigint;
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  ltv: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
  reserveFactor: number;
}

/**
 * Hook to fetch detailed data for a single market
 */
export function useMarketData(marketAddress: `0x${string}`) {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      // Pool data
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
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'collateralToken',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'borrowToken',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'collateralDecimals',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'borrowDecimals',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'ltv',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'liquidationThreshold',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'liquidationPenalty',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'reserveFactor',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'getBorrowRate',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'getSupplyRate',
      },
    ],
    query: {
      refetchInterval: 12000,
    },
  });

  // Parse the results
  const marketData: MarketData | null = data
    ? {
        address: marketAddress,
        totalSupply: (data[0]?.result as bigint) || 0n,
        totalBorrow: (data[1]?.result as bigint) || 0n,
        collateralToken: (data[2]?.result as `0x${string}`) || '0x',
        borrowToken: (data[3]?.result as `0x${string}`) || '0x',
        collateralDecimals: (data[4]?.result as number) || 18,
        borrowDecimals: (data[5]?.result as number) || 18,
        ltv: Number(data[6]?.result || 0) / 1e18 * 100, // Convert from WAD to percentage
        liquidationThreshold: Number(data[7]?.result || 0) / 1e18 * 100,
        liquidationPenalty: Number(data[8]?.result || 0) / 1e18 * 100,
        reserveFactor: Number(data[9]?.result || 0) / 1e18 * 100,
        borrowRate: (data[10]?.result as bigint) || 0n,
        supplyRate: (data[11]?.result as bigint) || 0n,
        borrowAPY: calculateAPY((data[10]?.result as bigint) || 0n),
        supplyAPY: calculateAPY((data[11]?.result as bigint) || 0n),
        utilization: calculateUtilization(
          (data[1]?.result as bigint) || 0n,
          (data[0]?.result as bigint) || 0n
        ),
        collateralSymbol: '', // Will be fetched separately if needed
        borrowSymbol: '',
      }
    : null;

  return {
    data: marketData,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch token symbols for a market
 */
export function useMarketTokenSymbols(collateralToken: `0x${string}`, borrowToken: `0x${string}`) {
  const { data } = useReadContracts({
    contracts: [
      {
        address: collateralToken,
        abi: ERC20_ABI,
        functionName: 'symbol',
      },
      {
        address: borrowToken,
        abi: ERC20_ABI,
        functionName: 'symbol',
      },
    ],
  });

  return {
    collateralSymbol: (data?.[0]?.result as string) || 'Unknown',
    borrowSymbol: (data?.[1]?.result as string) || 'Unknown',
  };
}
