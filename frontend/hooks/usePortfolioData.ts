'use client';

import { useReadContracts, useChainId } from 'wagmi';
import { LENDING_POOL_ABI, ORACLE_ROUTER_ABI, ERC20_ABI } from '@/lib/contracts/abis';
import { getContractAddress } from '@/lib/contracts/addresses';
import { UserPosition } from './useUserPosition';
import { useMemo } from 'react';

export interface EnrichedPosition extends UserPosition {
  collateralToken: `0x${string}`;
  borrowToken: `0x${string}`;
  collateralSymbol: string;
  borrowSymbol: string;
  collateralDecimals: number;
  borrowDecimals: number;
  collateralPrice: bigint;
  borrowPrice: bigint;
  healthFactor: number;
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  // Calculated USD values
  suppliedUSD: number;
  collateralUSD: number;
  borrowedUSD: number;
  netValueUSD: number;
}

export interface PortfolioSummary {
  totalSuppliedUSD: number;
  totalCollateralUSD: number;
  totalBorrowedUSD: number;
  netValueUSD: number;
  averageHealthFactor: number;
  lowestHealthFactor: number;
  totalSupplyAPY: number; // Weighted average
  totalBorrowAPY: number; // Weighted average
  isLoading: boolean;
}

/**
 * Hook to enrich user positions with market data, prices, and USD values
 */
export function usePortfolioData(positions: UserPosition[]) {
  const chainId = useChainId();
  const oracleRouterAddress = getContractAddress(chainId, 'oracleRouter');

  // Build contracts array to fetch all market data
  const contracts = useMemo(() => {
    if (!positions || positions.length === 0) return [];

    return positions.flatMap((position) => [
      // Market data
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'collateralToken' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'borrowToken' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'collateralDecimals' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'borrowDecimals' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'getSupplyRate' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'getBorrowRate' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'totalSupplyAssets' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'totalBorrowAssets' },
    ]);
  }, [positions]);

  const { data: marketData, isLoading: marketDataLoading } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 12000,
    },
  });

  // Extract tokens for symbol and price fetching
  const tokens = useMemo(() => {
    if (!marketData || marketData.length === 0) return { collateralTokens: [], borrowTokens: [] };

    const collateralTokens: `0x${string}`[] = [];
    const borrowTokens: `0x${string}`[] = [];

    for (let i = 0; i < positions.length; i++) {
      const baseIndex = i * 8;
      const collateralToken = marketData[baseIndex]?.result as `0x${string}` | undefined;
      const borrowToken = marketData[baseIndex + 1]?.result as `0x${string}` | undefined;

      if (collateralToken) collateralTokens.push(collateralToken);
      if (borrowToken) borrowTokens.push(borrowToken);
    }

    return { collateralTokens, borrowTokens };
  }, [marketData, positions]);

  // Fetch token symbols and prices
  const symbolAndPriceContracts = useMemo(() => {
    const { collateralTokens, borrowTokens } = tokens;
    const allTokens = [...new Set([...collateralTokens, ...borrowTokens])]; // Unique tokens

    return allTokens.flatMap((token) => [
      { address: token, abi: ERC20_ABI, functionName: 'symbol' },
      { address: oracleRouterAddress, abi: ORACLE_ROUTER_ABI, functionName: 'getPrice', args: [token] },
    ]);
  }, [tokens, oracleRouterAddress]);

  const { data: symbolAndPriceData, isLoading: priceDataLoading } = useReadContracts({
    contracts: symbolAndPriceContracts,
    query: {
      enabled: symbolAndPriceContracts.length > 0,
      refetchInterval: 12000,
    },
  });

  // Build token data map
  const tokenDataMap = useMemo(() => {
    if (!symbolAndPriceData) return new Map();

    const map = new Map<string, { symbol: string; price: bigint }>();
    const { collateralTokens, borrowTokens } = tokens;
    const allTokens = [...new Set([...collateralTokens, ...borrowTokens])];

    allTokens.forEach((token, index) => {
      const baseIndex = index * 2;
      const symbol = symbolAndPriceData[baseIndex]?.result as string | undefined;
      const price = symbolAndPriceData[baseIndex + 1]?.result as bigint | undefined;

      if (symbol && price) {
        map.set(token.toLowerCase(), { symbol, price });
      }
    });

    return map;
  }, [symbolAndPriceData, tokens]);

  // Helper function to calculate APY
  const calculateAPY = (ratePerSecond: bigint): number => {
    if (ratePerSecond === 0n) return 0;
    const rate = Number(ratePerSecond) / 1e18;
    const apy = (Math.pow(1 + rate, 31536000) - 1) * 100;
    return parseFloat(apy.toFixed(2));
  };

  // Enrich positions with market data and USD values
  const enrichedPositions: EnrichedPosition[] = useMemo(() => {
    if (!marketData || marketData.length === 0 || tokenDataMap.size === 0) return [];

    return positions.map((position, index) => {
      const baseIndex = index * 8;

      const collateralToken = (marketData[baseIndex]?.result as `0x${string}`) || '0x0';
      const borrowToken = (marketData[baseIndex + 1]?.result as `0x${string}`) || '0x0';
      const collateralDecimals = (marketData[baseIndex + 2]?.result as number) || 18;
      const borrowDecimals = (marketData[baseIndex + 3]?.result as number) || 18;
      const supplyRate = (marketData[baseIndex + 4]?.result as bigint) || 0n;
      const borrowRate = (marketData[baseIndex + 5]?.result as bigint) || 0n;
      const totalSupply = (marketData[baseIndex + 6]?.result as bigint) || 0n;
      const totalBorrow = (marketData[baseIndex + 7]?.result as bigint) || 0n;

      const collateralData = tokenDataMap.get(collateralToken.toLowerCase());
      const borrowData = tokenDataMap.get(borrowToken.toLowerCase());

      const collateralPrice = collateralData?.price || 0n;
      const borrowPrice = borrowData?.price || 0n;

      // Calculate USD values
      const suppliedUSD = position.supplied > 0n && borrowPrice > 0n
        ? (Number(position.supplied) / Math.pow(10, borrowDecimals)) * (Number(borrowPrice) / 1e18)
        : 0;

      const collateralUSD = position.collateral > 0n && collateralPrice > 0n
        ? (Number(position.collateral) / Math.pow(10, collateralDecimals)) * (Number(collateralPrice) / 1e18)
        : 0;

      const borrowedUSD = position.borrowed > 0n && borrowPrice > 0n
        ? (Number(position.borrowed) / Math.pow(10, borrowDecimals)) * (Number(borrowPrice) / 1e18)
        : 0;

      const netValueUSD = suppliedUSD + collateralUSD - borrowedUSD;

      // Calculate health factor
      const liquidationThreshold = 0.8; // 80%
      const healthFactor = borrowedUSD > 0
        ? (collateralUSD * liquidationThreshold) / borrowedUSD
        : Infinity;

      // Calculate utilization
      const totalAssets = totalSupply + totalBorrow;
      const utilization = totalAssets > 0n
        ? (Number(totalBorrow) / Number(totalAssets)) * 100
        : 0;

      return {
        ...position,
        collateralToken,
        borrowToken,
        collateralSymbol: collateralData?.symbol || 'Unknown',
        borrowSymbol: borrowData?.symbol || 'Unknown',
        collateralDecimals,
        borrowDecimals,
        collateralPrice,
        borrowPrice,
        healthFactor,
        supplyAPY: calculateAPY(supplyRate),
        borrowAPY: calculateAPY(borrowRate),
        utilization,
        suppliedUSD,
        collateralUSD,
        borrowedUSD,
        netValueUSD,
      };
    });
  }, [positions, marketData, tokenDataMap]);

  // Calculate portfolio summary
  const summary: PortfolioSummary = useMemo(() => {
    if (enrichedPositions.length === 0) {
      return {
        totalSuppliedUSD: 0,
        totalCollateralUSD: 0,
        totalBorrowedUSD: 0,
        netValueUSD: 0,
        averageHealthFactor: 0,
        lowestHealthFactor: 0,
        totalSupplyAPY: 0,
        totalBorrowAPY: 0,
        isLoading: marketDataLoading || priceDataLoading,
      };
    }

    const totalSuppliedUSD = enrichedPositions.reduce((sum, p) => sum + p.suppliedUSD, 0);
    const totalCollateralUSD = enrichedPositions.reduce((sum, p) => sum + p.collateralUSD, 0);
    const totalBorrowedUSD = enrichedPositions.reduce((sum, p) => sum + p.borrowedUSD, 0);
    const netValueUSD = totalSuppliedUSD + totalCollateralUSD - totalBorrowedUSD;

    // Calculate health factors
    const healthFactors = enrichedPositions
      .filter((p) => p.borrowedUSD > 0)
      .map((p) => p.healthFactor);

    const averageHealthFactor = healthFactors.length > 0
      ? healthFactors.reduce((sum, hf) => sum + hf, 0) / healthFactors.length
      : 0;

    const lowestHealthFactor = healthFactors.length > 0
      ? Math.min(...healthFactors)
      : 0;

    // Calculate weighted APYs
    const totalSupplyAPY = totalSuppliedUSD > 0
      ? enrichedPositions.reduce((sum, p) => sum + (p.supplyAPY * p.suppliedUSD), 0) / totalSuppliedUSD
      : 0;

    const totalBorrowAPY = totalBorrowedUSD > 0
      ? enrichedPositions.reduce((sum, p) => sum + (p.borrowAPY * p.borrowedUSD), 0) / totalBorrowedUSD
      : 0;

    return {
      totalSuppliedUSD,
      totalCollateralUSD,
      totalBorrowedUSD,
      netValueUSD,
      averageHealthFactor,
      lowestHealthFactor,
      totalSupplyAPY,
      totalBorrowAPY,
      isLoading: false,
    };
  }, [enrichedPositions, marketDataLoading, priceDataLoading]);

  return {
    enrichedPositions,
    summary,
    isLoading: marketDataLoading || priceDataLoading,
  };
}
