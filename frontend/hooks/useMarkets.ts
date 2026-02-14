'use client';

import { useReadContract } from 'wagmi';
import { getContractAddress } from '@/lib/contracts/addresses';
import { MARKET_REGISTRY_ABI } from '@/lib/contracts/abis';
import { useChainId } from 'wagmi';

/**
 * Hook to fetch all markets from the MarketRegistry
 */
export function useMarkets() {
  const chainId = useChainId();

  const registryAddress = getContractAddress(chainId, 'marketRegistry');

  console.log('🔍 useMarkets Debug:');
  console.log('  - chainId:', chainId);
  console.log('  - registry address:', registryAddress);

  const { data, isLoading, error, refetch } = useReadContract({
    address: registryAddress,
    abi: MARKET_REGISTRY_ABI,
    functionName: 'getActiveMarkets',
    query: {
      refetchInterval: 12000, // Refetch every 12 seconds (Base block time)
    },
  });

  console.log('  - data:', data);
  console.log('  - isLoading:', isLoading);
  console.log('  - error:', error);
  console.log('  - markets count:', (data as `0x${string}`[])?.length || 0);

  return {
    markets: (data as `0x${string}`[]) || [],
    isLoading,
    error,
    refetch,
  };
}
