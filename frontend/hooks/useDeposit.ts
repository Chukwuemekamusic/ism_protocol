'use client';

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { LENDING_POOL_ABI, ERC20_ABI } from '@/lib/contracts/abis';
import { parseUnits } from 'viem';
import { GAS_LIMITS } from '@/lib/utils/constants';

/**
 * Hook for depositing (supplying) assets to a lending pool
 */
export function useDeposit(marketAddress: `0x${string}`, borrowToken: `0x${string}`) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: marketAddress,
      abi: LENDING_POOL_ABI,
      functionName: 'deposit',
      args: [amountInWei],
      gas: GAS_LIMITS.DEPOSIT,
    });
  };

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook for approving token spending
 */
export function useApprove(tokenAddress: `0x${string}`, spenderAddress: `0x${string}`) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (amount: string, decimals: number) => {
    const amountInWei = parseUnits(amount, decimals);

    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, amountInWei],
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to check token allowance
 */
export function useAllowance(
  tokenAddress: `0x${string}`,
  owner: `0x${string}` | undefined,
  spender: `0x${string}`
) {
  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner as `0x${string}`, spender],
    query: {
      enabled: !!owner,
    },
  });

  return {
    allowance: (allowance as bigint) || 0n,
    refetch,
  };
}
