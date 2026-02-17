"use client";

import { useReadContracts, useAccount } from "wagmi";
import { LENDING_POOL_ABI, ERC20_ABI } from "@/lib/contracts/abis";
import { useMarkets } from "./useMarkets";

export interface UserPosition {
  marketAddress: `0x${string}`;
  supplied: bigint;
  collateral: bigint;
  borrowed: bigint;
  shares: bigint;
}

/**
 * Hook to fetch user's positions across all markets
 */
export function useUserPositions() {
  const { address } = useAccount();
  const { markets } = useMarkets();

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts:
      markets?.flatMap((marketAddress) => [
        {
          address: marketAddress,
          abi: LENDING_POOL_ABI,
          functionName: "balanceOfUnderlying",
          args: [address as `0x${string}`],
        },
        {
          address: marketAddress,
          abi: LENDING_POOL_ABI,
          functionName: "positions",
          args: [address as `0x${string}`],
        },
        {
          address: marketAddress,
          abi: LENDING_POOL_ABI,
          functionName: "getUserDebt",
          args: [address as `0x${string}`],
        },
      ]) || [],
    query: {
      enabled: !!address && markets.length > 0,
      refetchInterval: 12000,
    },
  });

  // Transform data into positions array
  const positions: UserPosition[] =
    markets
      ?.map((marketAddress, index) => {
        const baseIndex = index * 3;
        const supplied = (data?.[baseIndex]?.result as unknown as bigint) || 0n;
        const positionData = data?.[baseIndex + 1]?.result as unknown as
          | [bigint, bigint]
          | undefined;
        const borrowed =
          (data?.[baseIndex + 2]?.result as unknown as bigint) || 0n;

        return {
          marketAddress,
          supplied,
          collateral: positionData?.[0] || 0n, // First value is collateralAmount
          borrowed,
          shares: positionData?.[1] || 0n, // Second value is borrowShares
        };
      })
      .filter((p) => p.supplied > 0n || p.collateral > 0n || p.borrowed > 0n) ||
    [];

  return {
    positions,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch user's position in a specific market
 */
export function useUserMarketPosition(marketAddress: `0x${string}`) {
  const { address } = useAccount();

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: "poolToken",
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: "totalSupplyAssets",
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: "totalSupplyShares",
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: "positions",
        args: [address as `0x${string}`],
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: "getUserDebt",
        args: [address as `0x${string}`],
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: "healthFactor",
        args: [address as `0x${string}`],
      },
      {
        address: marketAddress,
        abi: LENDING_POOL_ABI,
        functionName: "getMaxBorrow",
        args: [address as `0x${string}`],
      },
    ],
    query: {
      enabled: !!address,
      refetchInterval: 12000,
    },
  });

  // Get pool token address and read user's shares
  const poolTokenAddress = data?.[0]?.result as `0x${string}` | undefined;

  const { data: poolTokenData } = useReadContracts({
    contracts: poolTokenAddress
      ? [
          {
            address: poolTokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          },
        ]
      : [],
    query: {
      enabled: !!address && !!poolTokenAddress,
      refetchInterval: 12000,
    },
  });

  const userShares = (poolTokenData?.[0]?.result as bigint) || 0n;
  const totalAssets = (data?.[1]?.result as bigint) || 0n;
  const totalShares = (data?.[2]?.result as bigint) || 0n;

  // Calculate supplied amount: shares * totalAssets / totalShares
  const supplied =
    totalShares > 0n ? (userShares * totalAssets) / totalShares : userShares;

  const positionData = data?.[3]?.result as [bigint, bigint] | undefined;

  return {
    supplied,
    collateral: positionData?.[0] || 0n, // First value is collateralAmount
    shares: positionData?.[1] || 0n, // Second value is borrowShares
    borrowed: (data?.[4]?.result as bigint) || 0n,
    healthFactor: Number(data?.[5]?.result || 0n) / 1e18, // Convert from WAD
    maxBorrow: (data?.[6]?.result as bigint) || 0n,
    isLoading,
    error,
    refetch,
  };
}
