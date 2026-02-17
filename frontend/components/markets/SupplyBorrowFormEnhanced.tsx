"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDeposit, useApprove, useAllowance } from "@/hooks/useDeposit";
import {
  useBorrow,
  useDepositCollateral,
  useWithdrawCollateral,
} from "@/hooks/useBorrow";
import { useRepay } from "@/hooks/useRepay";
import { useWithdraw } from "@/hooks/useWithdraw";
import { formatTokenAmount, parseTokenInput } from "@/lib/utils/formatters";
import { MarketData } from "@/hooks/useMarketData";
import { formatUnits } from "viem";
import {
  parseContractError,
  getErrorTitle,
  isCriticalError,
} from "@/lib/utils/errorMessages";
import TransactionPreview from "./TransactionPreview";
import HealthFactorDisplay from "./HealthFactorDisplay";
import { LENDING_POOL_ABI } from "@/lib/contracts/abis";

type Tab =
  | "supply"
  | "withdraw"
  | "depositCollateral"
  | "withdrawCollateral"
  | "borrow"
  | "repay";

interface SupplyBorrowFormEnhancedProps {
  marketAddress: `0x${string}`;
  market: MarketData;
  collateralSymbol: string;
  borrowSymbol: string;
  userPosition: {
    supplied: bigint;
    collateral: bigint;
    borrowed: bigint;
    healthFactor: number;
    maxBorrow: bigint;
  };
  collateralPrice: bigint;
  borrowPrice: bigint;
}

export default function SupplyBorrowFormEnhanced({
  marketAddress,
  market,
  collateralSymbol,
  borrowSymbol,
  userPosition,
  collateralPrice,
  borrowPrice,
}: SupplyBorrowFormEnhancedProps) {
  const [activeTab, setActiveTab] = useState<Tab>("supply");
  const [amount, setAmount] = useState("");
  const { address, isConnected } = useAccount();

  // Get user's token balances
  const { data: borrowTokenBalance } = useBalance({
    address,
    token: market.borrowToken,
  });

  const { data: collateralTokenBalance } = useBalance({
    address,
    token: market.collateralToken,
  });

  // Get available liquidity for withdraw
  const { data: availableLiquidity } = useReadContract({
    address: marketAddress,
    abi: LENDING_POOL_ABI,
    functionName: "totalSupplyAssets",
    query: {
      select: (totalSupply) => {
        // Available = totalSupply - totalBorrow
        return totalSupply > market.totalBorrow
          ? totalSupply - market.totalBorrow
          : 0n;
      },
    },
  });

  // Check allowances
  const { allowance: borrowAllowance, refetch: refetchBorrowAllowance } =
    useAllowance(market.borrowToken, address, marketAddress);

  const {
    allowance: collateralAllowance,
    refetch: refetchCollateralAllowance,
  } = useAllowance(market.collateralToken, address, marketAddress);

  // Transaction hooks
  const depositHook = useDeposit(marketAddress, market.borrowToken);
  const borrowHook = useBorrow(marketAddress);
  const repayHook = useRepay(marketAddress);
  const withdrawHook = useWithdraw(marketAddress);
  const depositCollateralHook = useDepositCollateral(marketAddress);
  const withdrawCollateralHook = useWithdrawCollateral(marketAddress);

  const borrowApprove = useApprove(market.borrowToken, marketAddress);
  const collateralApprove = useApprove(market.collateralToken, marketAddress);

  // Reset form on tab change or success
  useEffect(() => {
    if (
      depositHook.isSuccess ||
      borrowHook.isSuccess ||
      repayHook.isSuccess ||
      withdrawHook.isSuccess ||
      depositCollateralHook.isSuccess ||
      withdrawCollateralHook.isSuccess
    ) {
      setAmount("");
      refetchBorrowAllowance();
      refetchCollateralAllowance();
    }
  }, [
    depositHook.isSuccess,
    borrowHook.isSuccess,
    repayHook.isSuccess,
    withdrawHook.isSuccess,
    depositCollateralHook.isSuccess,
    withdrawCollateralHook.isSuccess,
  ]);

  // Refetch allowances after approval succeeds
  useEffect(() => {
    if (borrowApprove.isSuccess || collateralApprove.isSuccess) {
      const timer = setTimeout(() => {
        refetchBorrowAllowance();
        refetchCollateralAllowance();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [borrowApprove.isSuccess, collateralApprove.isSuccess]);

  // Improved MAX button logic
  const handleMaxClick = () => {
    switch (activeTab) {
      case "supply":
        // Use wallet balance
        if (borrowTokenBalance) {
          setAmount(
            formatUnits(borrowTokenBalance.value, borrowTokenBalance.decimals),
          );
        }
        break;

      case "withdraw":
        // Use minimum of deposited amount and available liquidity
        if (availableLiquidity !== undefined) {
          const maxWithdraw =
            userPosition.supplied < availableLiquidity
              ? userPosition.supplied
              : availableLiquidity;
          setAmount(formatUnits(maxWithdraw, market.borrowDecimals));
        } else {
          // Fallback to supplied balance if liquidity data unavailable
          setAmount(formatUnits(userPosition.supplied, market.borrowDecimals));
        }
        break;

      case "depositCollateral":
        // Use wallet balance
        if (collateralTokenBalance) {
          setAmount(
            formatUnits(
              collateralTokenBalance.value,
              collateralTokenBalance.decimals,
            ),
          );
        }
        break;

      case "withdrawCollateral":
        // If has borrows, need to be careful
        // For now use total collateral (contract will reject if unhealthy)
        // TODO: Add getMaxWithdrawCollateral when contract function is available
        setAmount(
          formatUnits(userPosition.collateral, market.collateralDecimals),
        );
        break;

      case "borrow":
        // Use contract's maxBorrow, but also check available liquidity
        if (availableLiquidity !== undefined) {
          const maxBorrow =
            userPosition.maxBorrow < availableLiquidity
              ? userPosition.maxBorrow
              : availableLiquidity;
          setAmount(formatUnits(maxBorrow, market.borrowDecimals));
        } else {
          setAmount(formatUnits(userPosition.maxBorrow, market.borrowDecimals));
        }
        break;

      case "repay":
        // Use minimum of debt and wallet balance
        if (borrowTokenBalance) {
          const maxRepay =
            borrowTokenBalance.value < userPosition.borrowed
              ? borrowTokenBalance.value
              : userPosition.borrowed;
          setAmount(formatUnits(maxRepay, borrowTokenBalance.decimals));
        }
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    switch (activeTab) {
      case "supply": {
        const amountBigInt = parseTokenInput(amount, market.borrowDecimals);
        if (borrowTokenBalance && borrowTokenBalance.value < amountBigInt) {
          alert(
            `Insufficient balance. You have ${formatUnits(borrowTokenBalance.value, borrowTokenBalance.decimals)} ${borrowSymbol}`,
          );
          return;
        }
        if (borrowAllowance < amountBigInt) {
          borrowApprove.approve(amount, market.borrowDecimals);
        } else {
          depositHook.deposit(amount, market.borrowDecimals);
        }
        break;
      }

      case "withdraw":
        withdrawHook.withdraw(amount, market.borrowDecimals);
        break;

      case "depositCollateral": {
        const amountBigInt = parseTokenInput(amount, market.collateralDecimals);
        if (
          collateralTokenBalance &&
          collateralTokenBalance.value < amountBigInt
        ) {
          alert(
            `Insufficient balance. You have ${formatUnits(collateralTokenBalance.value, collateralTokenBalance.decimals)} ${collateralSymbol}`,
          );
          return;
        }
        if (collateralAllowance < amountBigInt) {
          collateralApprove.approve(amount, market.collateralDecimals);
        } else {
          depositCollateralHook.depositCollateral(
            amount,
            market.collateralDecimals,
          );
        }
        break;
      }

      case "withdrawCollateral":
        withdrawCollateralHook.withdrawCollateral(
          amount,
          market.collateralDecimals,
        );
        break;

      case "borrow":
        borrowHook.borrow(amount, market.borrowDecimals);
        break;

      case "repay": {
        const amountBigInt = parseTokenInput(amount, market.borrowDecimals);

        // Check if user is repaying all debt (amount equals or exceeds total debt)
        const isRepayingAll = amountBigInt >= userPosition.borrowed;

        // When repaying all, add 1% buffer to account for accrued interest between approval and repay
        // This ensures we have enough approval even if interest accrues
        const amountToApprove = isRepayingAll
          ? (userPosition.borrowed * 101n) / 100n // 1% buffer for accrued interest
          : amountBigInt;

        if (borrowTokenBalance && borrowTokenBalance.value < amountBigInt) {
          alert(
            `Insufficient balance. You have ${formatUnits(borrowTokenBalance.value, borrowTokenBalance.decimals)} ${borrowSymbol}`,
          );
          return;
        }

        // Check allowance - when repaying all, we need extra buffer for accrued interest
        if (borrowAllowance < amountToApprove) {
          // Approve with buffer when repaying all
          const approvalAmount = isRepayingAll
            ? formatUnits(amountToApprove, market.borrowDecimals)
            : amount;
          borrowApprove.approve(approvalAmount, market.borrowDecimals);
        } else {
          // Pass repayAll flag to trigger max uint256 for full repayment
          repayHook.repay(amount, market.borrowDecimals, isRepayingAll);
        }
        break;
      }
    }
  };

  const getAvailableBalance = () => {
    switch (activeTab) {
      case "supply":
        return borrowTokenBalance
          ? formatTokenAmount(
              borrowTokenBalance.value,
              borrowTokenBalance.decimals,
              6,
            )
          : "0";
      case "withdraw":
        return formatTokenAmount(
          userPosition.supplied,
          market.borrowDecimals,
          6,
        );
      case "depositCollateral":
        return collateralTokenBalance
          ? formatTokenAmount(
              collateralTokenBalance.value,
              collateralTokenBalance.decimals,
              6,
            )
          : "0";
      case "withdrawCollateral":
        return formatTokenAmount(
          userPosition.collateral,
          market.collateralDecimals,
          6,
        );
      case "borrow":
        return formatTokenAmount(
          userPosition.maxBorrow,
          market.borrowDecimals,
          6,
        );
      case "repay":
        return formatTokenAmount(
          userPosition.borrowed,
          market.borrowDecimals,
          6,
        );
      default:
        return "0";
    }
  };

  const getButtonText = () => {
    if (activeTab === "supply") {
      const amountBigInt = amount
        ? parseTokenInput(amount, market.borrowDecimals)
        : 0n;
      if (borrowAllowance < amountBigInt) return `Approve ${borrowSymbol}`;
      return "Supply";
    }
    if (activeTab === "depositCollateral") {
      const amountBigInt = amount
        ? parseTokenInput(amount, market.collateralDecimals)
        : 0n;
      if (collateralAllowance < amountBigInt)
        return `Approve ${collateralSymbol}`;
      return "Deposit Collateral";
    }
    if (activeTab === "repay") {
      const amountBigInt = amount
        ? parseTokenInput(amount, market.borrowDecimals)
        : 0n;
      if (borrowAllowance < amountBigInt) return `Approve ${borrowSymbol}`;
      return "Repay";
    }

    if (activeTab === "withdraw") return "Withdraw";
    if (activeTab === "withdrawCollateral") return "Withdraw Collateral";
    if (activeTab === "borrow") return "Borrow";

    return "Submit";
  };

  const isProcessing = () => {
    return (
      depositHook.isPending ||
      depositHook.isConfirming ||
      borrowHook.isPending ||
      borrowHook.isConfirming ||
      repayHook.isPending ||
      repayHook.isConfirming ||
      withdrawHook.isPending ||
      withdrawHook.isConfirming ||
      depositCollateralHook.isPending ||
      depositCollateralHook.isConfirming ||
      withdrawCollateralHook.isPending ||
      withdrawCollateralHook.isConfirming ||
      borrowApprove.isPending ||
      borrowApprove.isConfirming ||
      collateralApprove.isPending ||
      collateralApprove.isConfirming
    );
  };

  // Get current error (if any)
  const getCurrentError = () => {
    return (
      depositHook.error ||
      borrowHook.error ||
      repayHook.error ||
      withdrawHook.error ||
      depositCollateralHook.error ||
      withdrawCollateralHook.error ||
      borrowApprove.error ||
      collateralApprove.error
    );
  };

  const currentError = getCurrentError();

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center sticky top-8">
        <p className="mb-4 text-gray-600">
          Connect your wallet to interact with this market
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 sticky top-8">
      <h2 className="text-xl font-semibold mb-6">Manage Position</h2>

      {/* Health Factor Display (if user has position) */}
      {(userPosition.collateral > 0n || userPosition.borrowed > 0n) && (
        <div className="mb-6">
          <HealthFactorDisplay
            healthFactor={userPosition.healthFactor}
            size="md"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <TabButton
            tab="supply"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setAmount={setAmount}
            label="Supply"
          />
          <TabButton
            tab="depositCollateral"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setAmount={setAmount}
            label="Collateral"
          />
          <TabButton
            tab="borrow"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setAmount={setAmount}
            label="Borrow"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <TabButton
            tab="withdraw"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setAmount={setAmount}
            label="Withdraw"
          />
          <TabButton
            tab="withdrawCollateral"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setAmount={setAmount}
            label="Remove"
          />
          <TabButton
            tab="repay"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setAmount={setAmount}
            label="Repay"
          />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Amount (
            {activeTab === "depositCollateral" ||
            activeTab === "withdrawCollateral"
              ? collateralSymbol
              : borrowSymbol}
            )
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleMaxClick}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
            >
              MAX
            </button>
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>
              {activeTab === "supply"
                ? "Wallet Balance"
                : activeTab === "withdraw"
                  ? "Supplied Balance"
                  : activeTab === "depositCollateral"
                    ? "Wallet Balance"
                    : activeTab === "withdrawCollateral"
                      ? "Collateral Balance"
                      : activeTab === "borrow"
                        ? "Max Borrow"
                        : "Current Debt"}
            </span>
            <span className="font-medium">{getAvailableBalance()}</span>
          </div>

          {/* Show max borrow hint */}
          {activeTab === "borrow" && userPosition.maxBorrow > 0n && (
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
              💡 Max safe borrow:{" "}
              {formatTokenAmount(
                userPosition.maxBorrow,
                market.borrowDecimals,
                6,
              )}{" "}
              {borrowSymbol} (75% LTV)
              {availableLiquidity !== undefined &&
                availableLiquidity < userPosition.maxBorrow && (
                  <div className="text-orange-600 mt-1">
                    ⚠️ Limited by pool liquidity:{" "}
                    {formatTokenAmount(
                      availableLiquidity,
                      market.borrowDecimals,
                      6,
                    )}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Transaction Preview */}
        {/* {amount && parseFloat(amount) > 0 && (
          <TransactionPreview
            mode={activeTab}
            amount={amount}
            currentPosition={userPosition}
            marketData={{
              collateralPrice,
              borrowPrice,
              collateralDecimals: market.collateralDecimals,
              borrowDecimals: market.borrowDecimals,
              liquidationThreshold: market.liquidationThreshold,
            }}
            collateralSymbol={collateralSymbol}
            borrowSymbol={borrowSymbol}
          />
        )} */}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!amount || parseFloat(amount) <= 0 || isProcessing()}
          className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mt-4"
        >
          {isProcessing() ? "Processing..." : getButtonText()}
        </button>
      </form>

      {/* Success Messages */}
      {depositHook.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✓ Supply successful!
        </div>
      )}
      {depositCollateralHook.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✓ Collateral deposited successfully!
        </div>
      )}
      {borrowHook.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✓ Borrow successful!
        </div>
      )}
      {repayHook.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✓ Repay successful!
        </div>
      )}
      {withdrawHook.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✓ Withdrawal successful!
        </div>
      )}
      {withdrawCollateralHook.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✓ Collateral withdrawn successfully!
        </div>
      )}
      {(borrowApprove.isSuccess || collateralApprove.isSuccess) && (
        <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          ✓ Approval successful! You can now proceed with your transaction.
        </div>
      )}

      {/* Enhanced Error Messages */}
      {currentError && (
        <div
          className={`mt-4 p-4 rounded-lg text-sm ${
            isCriticalError(currentError)
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-orange-50 text-orange-800 border border-orange-200"
          }`}
        >
          <div className="font-semibold mb-1">
            {getErrorTitle(currentError)}
          </div>
          <div>{parseContractError(currentError)}</div>
        </div>
      )}

      {/* Transaction Links */}
      {(depositHook.hash ||
        borrowHook.hash ||
        repayHook.hash ||
        withdrawHook.hash ||
        depositCollateralHook.hash ||
        withdrawCollateralHook.hash) && (
        <div className="mt-4 text-sm">
          <a
            href={`https://sepolia.basescan.org/tx/${depositHook.hash || borrowHook.hash || repayHook.hash || withdrawHook.hash || depositCollateralHook.hash || withdrawCollateralHook.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View transaction →
          </a>
        </div>
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({
  tab,
  activeTab,
  setActiveTab,
  setAmount,
  label,
}: {
  tab: Tab;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  setAmount: (amount: string) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        setActiveTab(tab);
        setAmount("");
      }}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
        activeTab === tab
          ? "bg-blue-500 text-white shadow-sm"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
