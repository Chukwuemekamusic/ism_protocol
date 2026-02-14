'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LENDING_POOL_ABI } from '@/lib/contracts/abis';
import { parseUnits } from 'viem';
import { GAS_LIMITS } from '@/lib/utils/constants';

/**
 * Hook for withdrawing supplied assets
 */
export function useWithdraw(marketAddress: `0x${string}`) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: marketAddress,
      abi: LENDING_POOL_ABI,
      functionName: 'withdraw',
      args: [amountInWei],
      gas: GAS_LIMITS.WITHDRAW,
    });
  };

  return {
    withdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
