'use client';

import { useReadContracts } from 'wagmi';
import { useMarkets } from './useMarkets';
import { LENDING_POOL_ABI, ORACLE_ROUTER_ABI } from '@/lib/contracts/abis';
import { getContractAddress } from '@/lib/contracts/addresses';
import { useChainId } from 'wagmi';
import { useMemo } from 'react';

export interface ProtocolStats {
  totalValueLockedUSD: number; // Total value locked across all markets in USD
  totalActiveBorrowsUSD: number; // Total active borrows across all markets in USD
  totalMarketsCount: number;
  isLoading: boolean;
}

/**
 * Hook to fetch aggregated protocol statistics across all markets
 * Calculates TVL and Active Borrows in USD by summing data from all markets
 */
export function useProtocolStats(): ProtocolStats {
  const chainId = useChainId();
  const { markets, isLoading: marketsLoading } = useMarkets();
  const oracleRouterAddress = getContractAddress(chainId, 'oracleRouter');

  // Build contract calls for all markets to fetch:
  // 1. totalSupplyAssets
  // 2. totalBorrowAssets
  // 3. borrowToken address
  // 4. borrowDecimals
  const contracts = useMemo(() => {
    if (!markets || markets.length === 0) return [];

    return markets.flatMap((marketAddress) => [
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
        functionName: 'borrowToken',
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: 'borrowDecimals',
      },
    ]);
  }, [markets]);

  const { data: marketData, isLoading: marketDataLoading } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 12000,
    },
  });

  // Extract borrow tokens to fetch their prices
  const borrowTokens = useMemo(() => {
    if (!marketData || marketData.length === 0) return [];

    const tokens: `0x${string}`[] = [];
    // Data is in groups of 4: [supply, borrow, borrowToken, decimals, ...]
    for (let i = 2; i < marketData.length; i += 4) {
      const tokenAddress = marketData[i]?.result as `0x${string}` | undefined;
      if (tokenAddress) tokens.push(tokenAddress);
    }
    return tokens;
  }, [marketData]);

  // Fetch prices for all borrow tokens
  const priceContracts = useMemo(() => {
    return borrowTokens.map((token) => ({
      address: oracleRouterAddress,
      abi: ORACLE_ROUTER_ABI,
      functionName: 'getPrice',
      args: [token],
    }));
  }, [borrowTokens, oracleRouterAddress]);

  const { data: priceData, isLoading: priceDataLoading } = useReadContracts({
    contracts: priceContracts,
    query: {
      enabled: priceContracts.length > 0,
      refetchInterval: 12000,
    },
  });

  // Aggregate the results
  const stats = useMemo(() => {
    if (!marketData || marketData.length === 0 || !priceData || priceData.length === 0) {
      return {
        totalValueLockedUSD: 0,
        totalActiveBorrowsUSD: 0,
        totalMarketsCount: markets?.length || 0,
        isLoading: marketsLoading || marketDataLoading || priceDataLoading,
      };
    }

    let totalSupplyUSD = 0;
    let totalBorrowUSD = 0;

    // Process each market
    const marketCount = marketData.length / 4;
    for (let i = 0; i < marketCount; i++) {
      const baseIndex = i * 4;

      const supplyAssets = marketData[baseIndex]?.result as bigint | undefined;
      const borrowAssets = marketData[baseIndex + 1]?.result as bigint | undefined;
      const decimals = marketData[baseIndex + 3]?.result as number | undefined;
      const price = priceData[i]?.result as bigint | undefined;

      if (supplyAssets && decimals !== undefined && price) {
        // Convert to USD: (assets / 10^decimals) * (price / 1e18)
        const supplyUSD = (Number(supplyAssets) / Math.pow(10, decimals)) * (Number(price) / 1e18);
        totalSupplyUSD += supplyUSD;
      }

      if (borrowAssets && decimals !== undefined && price) {
        const borrowUSD = (Number(borrowAssets) / Math.pow(10, decimals)) * (Number(price) / 1e18);
        totalBorrowUSD += borrowUSD;
      }
    }

    return {
      totalValueLockedUSD: totalSupplyUSD,
      totalActiveBorrowsUSD: totalBorrowUSD,
      totalMarketsCount: markets?.length || 0,
      isLoading: false,
    };
  }, [marketData, priceData, markets, marketsLoading, marketDataLoading, priceDataLoading]);

  return stats;
}
