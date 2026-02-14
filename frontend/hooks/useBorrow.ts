'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LENDING_POOL_ABI } from '@/lib/contracts/abis';
import { parseUnits } from 'viem';
import { GAS_LIMITS } from '@/lib/utils/constants';

/**
 * Hook for borrowing assets from a lending pool
 */
export function useBorrow(marketAddress: `0x${string}`) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const borrow = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: marketAddress,
      abi: LENDING_POOL_ABI,
      functionName: 'borrow',
      args: [amountInWei],
      gas: GAS_LIMITS.BORROW,
    });
  };

  return {
    borrow,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook for depositing collateral
 */
export function useDepositCollateral(marketAddress: `0x${string}`) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const depositCollateral = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: marketAddress,
      abi: LENDING_POOL_ABI,
      functionName: 'depositCollateral',
      args: [amountInWei],
      gas: GAS_LIMITS.DEPOSIT_COLLATERAL,
    });
  };

  return {
    depositCollateral,
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
