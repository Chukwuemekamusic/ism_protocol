'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LENDING_POOL_ABI } from '@/lib/contracts/abis';
import { parseUnits } from 'viem';
import { GAS_LIMITS } from '@/lib/utils/constants';

/**
 * Hook for repaying borrowed assets
 */
export function useRepay(marketAddress: `0x${string}`) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const repay = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: marketAddress,
      abi: LENDING_POOL_ABI,
      functionName: 'repay',
      args: [amountInWei],
      gas: GAS_LIMITS.REPAY,
    });
  };

  return {
    repay,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook for withdrawing collateral
 */
export function useWithdrawCollateral(marketAddress: `0x${string}`) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawCollateral = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: marketAddress,
      abi: LENDING_POOL_ABI,
      functionName: 'withdrawCollateral',
      args: [amountInWei],
      gas: GAS_LIMITS.WITHDRAW_COLLATERAL,
    });
  };

  return {
    withdrawCollateral,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
