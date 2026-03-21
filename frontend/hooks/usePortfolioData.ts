'use client';

import { useReadContracts, useChainId } from 'wagmi';
import { LENDING_POOL_ABI, ORACLE_ROUTER_ABI, ERC20_ABI, INTEREST_RATE_MODEL_ABI } from '@/lib/contracts/abis';
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
      // Market data (9 calls per position)
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'collateralToken' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'borrowToken' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'collateralDecimals' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'borrowDecimals' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'totalSupplyAssets' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'totalBorrowAssets' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'reserveFactor' },
      { address: position.marketAddress, abi: LENDING_POOL_ABI, functionName: 'interestRateModel' },
    ]);
  }, [positions]);

  const { data: marketData, isLoading: marketDataLoading } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 12000,
    },
  }) as { data: any; isLoading: boolean };

  // Extract tokens and interest rate model addresses
  const tokens = useMemo(() => {
    if (!marketData || marketData.length === 0) return {
      collateralTokens: [],
      borrowTokens: [],
      rateModelData: [] as Array<{address: `0x${string}`, totalSupply: bigint, totalBorrow: bigint, reserveFactor: bigint}>
    };

    const collateralTokens: `0x${string}`[] = [];
    const borrowTokens: `0x${string}`[] = [];
    const rateModelData: Array<{address: `0x${string}`, totalSupply: bigint, totalBorrow: bigint, reserveFactor: bigint}> = [];

    for (let i = 0; i < positions.length; i++) {
      const baseIndex = i * 8; // Now 8 items per position
      const collateralToken = marketData[baseIndex]?.result as `0x${string}` | undefined;
      const borrowToken = marketData[baseIndex + 1]?.result as `0x${string}` | undefined;
      const totalSupply = marketData[baseIndex + 4]?.result as bigint | undefined;
      const totalBorrow = marketData[baseIndex + 5]?.result as bigint | undefined;
      const reserveFactor = marketData[baseIndex + 6]?.result as bigint | undefined;
      const interestRateModel = marketData[baseIndex + 7]?.result as `0x${string}` | undefined;

      if (collateralToken) collateralTokens.push(collateralToken);
      if (borrowToken) borrowTokens.push(borrowToken);
      if (interestRateModel && totalSupply && totalBorrow && reserveFactor) {
        rateModelData.push({
          address: interestRateModel,
          totalSupply,
          totalBorrow,
          reserveFactor
        });
      }
    }

    return { collateralTokens, borrowTokens, rateModelData };
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
  }) as { data: any; isLoading: boolean };

  // Fetch interest rates from InterestRateModel contracts
  const rateContracts = useMemo(() => {
    return tokens.rateModelData.flatMap((data) => [
      {
        address: data.address,
        abi: INTEREST_RATE_MODEL_ABI,
        functionName: 'getBorrowRate',
        args: [data.totalSupply, data.totalBorrow],
      },
      {
        address: data.address,
        abi: INTEREST_RATE_MODEL_ABI,
        functionName: 'getSupplyRate',
        args: [data.totalSupply, data.totalBorrow, data.reserveFactor],
      },
    ]);
  }, [tokens.rateModelData]);

  const { data: rateData, isLoading: rateDataLoading } = useReadContracts({
    contracts: rateContracts,
    query: {
      enabled: rateContracts.length > 0,
      refetchInterval: 12000,
    },
  }) as { data: any; isLoading: boolean };

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
      const baseIndex = index * 8; // Now 8 items per position

      const collateralToken = (marketData[baseIndex]?.result as unknown as `0x${string}`) || '0x0';
      const borrowToken = (marketData[baseIndex + 1]?.result as unknown as `0x${string}`) || '0x0';
      const collateralDecimals = (marketData[baseIndex + 2]?.result as unknown as number) || 18;
      const borrowDecimals = (marketData[baseIndex + 3]?.result as unknown as number) || 18;
      const totalSupply = (marketData[baseIndex + 4]?.result as unknown as bigint) || 0n;
      const totalBorrow = (marketData[baseIndex + 5]?.result as unknown as bigint) || 0n;

      // Get interest rates from InterestRateModel
      const rateIndex = index * 2; // 2 calls per position (borrow rate, supply rate)
      const borrowRate = (rateData?.[rateIndex]?.result as unknown as bigint) || 0n;
      const supplyRate = (rateData?.[rateIndex + 1]?.result as unknown as bigint) || 0n;

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
  }, [positions, marketData, tokenDataMap, rateData]);

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
        isLoading: marketDataLoading || priceDataLoading || rateDataLoading,
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
  }, [enrichedPositions, marketDataLoading, priceDataLoading, rateDataLoading]);

  return {
    enrichedPositions,
    summary,
    isLoading: marketDataLoading || priceDataLoading || rateDataLoading,
  };
}
