import { useReadContracts } from "wagmi";
import { ORACLE_ROUTER_ABI } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";

/**
 * Hook to fetch token prices from OracleRouter
 * Prices are returned in 1e18 format (WAD)
 */
export function useTokenPrices(
  collateralToken: `0x${string}`,
  borrowToken: `0x${string}`,
) {
  const oracleRouter = CONTRACTS.oracleRouter as `0x${string}`;

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: oracleRouter,
        abi: ORACLE_ROUTER_ABI,
        functionName: "getPrice",
        args: [collateralToken],
      },
      {
        address: oracleRouter,
        abi: ORACLE_ROUTER_ABI,
        functionName: "getPrice",
        args: [borrowToken],
      },
    ],
    query: {
      refetchInterval: 30000, // Refetch prices every 30 seconds
    },
  });

  const collateralPrice = (data?.[0]?.result as bigint) || 0n;
  const borrowPrice = (data?.[1]?.result as bigint) || 0n;

  return {
    collateralPrice,
    borrowPrice,
    isLoading,
    error,
    refetch,
  };
}
