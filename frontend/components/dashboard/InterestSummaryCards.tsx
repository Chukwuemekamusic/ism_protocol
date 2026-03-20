"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import { useAccount } from "wagmi";
import { getUserTransactions } from "@/lib/subgraph";
import { formatUSD } from "@/lib/utils/formatters";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useUserPositions } from "@/hooks/useUserPosition";

interface InterestStats {
  totalEarned: number;
  totalPaid: number;
  netProfit: number;
  earnAPY: number;
}

// Cache with 60s TTL
const CACHE_TTL = 60000; // 60 seconds
const statsCache = new Map<
  string,
  { data: InterestStats; timestamp: number }
>();

export function InterestSummaryCards() {
  const { address } = useAccount();
  const { positions } = useUserPositions();
  const { summary } = usePortfolioData(positions);
  const [stats, setStats] = useState<InterestStats>({
    totalEarned: 0,
    totalPaid: 0,
    netProfit: 0,
    earnAPY: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [rateLimitError, setRateLimitError] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);

  const calculateInterestStats = useCallback(async () => {
    if (!address) return;

    // Skip if no positions (nothing to calculate)
    if (!positions || positions.length === 0) {
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = address.toLowerCase();
    const cached = statsCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
      setStats(cached.data);
      setIsLoading(false);
      return;
    }

    // Rate limit: Don't fetch more than once per 30 seconds
    if (now - lastFetchRef.current < 30000) {
      setIsLoading(false);
      return;
    }

    lastFetchRef.current = now;

    try {
      setIsLoading(true);
      setRateLimitError(false);

      // Get user transactions (reduced to 100 to avoid rate limits)
      const { transactions } = await getUserTransactions(
        address.toLowerCase(),
        100,
      );

      // Calculate interest earned from supplies
      // This is a simplified calculation - in production, track actual interest accrued
      const deposits = transactions.filter((tx) => tx.type === "DEPOSIT");
      const withdrawals = transactions.filter((tx) => tx.type === "WITHDRAW");

      // Estimate earned interest (withdrawn - deposited gives profit)
      const totalDeposited = deposits.reduce(
        (sum, tx) => sum + parseFloat(tx.amountUSD),
        0,
      );
      const totalWithdrawn = withdrawals.reduce(
        (sum, tx) => sum + parseFloat(tx.amountUSD),
        0,
      );

      // Simple estimation: interest earned = withdrawn - deposited (if positive)
      const estimatedEarned = Math.max(0, totalWithdrawn - totalDeposited);

      // Calculate interest paid from borrows
      const borrows = transactions.filter((tx) => tx.type === "BORROW");
      const repays = transactions.filter((tx) => tx.type === "REPAY");

      const totalBorrowed = borrows.reduce(
        (sum, tx) => sum + parseFloat(tx.amountUSD),
        0,
      );
      const totalRepaid = repays.reduce(
        (sum, tx) => sum + parseFloat(tx.amountUSD),
        0,
      );

      // Simple estimation: interest paid = repaid - borrowed (if positive)
      const estimatedPaid = Math.max(0, totalRepaid - totalBorrowed);

      // Net profit
      const netProfit = estimatedEarned - estimatedPaid;

      // Use portfolio summary for current APY
      const earnAPY = summary.totalSupplyAPY || 0;

      const newStats = {
        totalEarned: estimatedEarned,
        totalPaid: estimatedPaid,
        netProfit,
        earnAPY,
      };

      setStats(newStats);

      // Update cache
      statsCache.set(cacheKey, { data: newStats, timestamp: Date.now() });
    } catch (error: any) {
      // Check if it's a rate limit error
      const isRateLimitError =
        error?.message?.includes("429") ||
        error?.message?.includes("Too many requests");

      // Only log non-429 errors to console (429s are gracefully handled with UI banner)
      if (!isRateLimitError) {
        console.error("Error calculating interest stats:", error);
      }

      if (isRateLimitError) {
        setRateLimitError(true);
      }

      // Set stats to 0 on error, but keep current APY from portfolio
      setStats({
        totalEarned: 0,
        totalPaid: 0,
        netProfit: 0,
        earnAPY: summary.totalSupplyAPY || 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [address, positions, summary]);

  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    // Debounce API calls by 500ms
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      calculateInterestStats();
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [address, positions?.length, summary, calculateInterestStats]);

  // Don't show if user has no positions
  if (!positions || positions.length === 0) {
    return null;
  }

  const cards = [
    {
      title: "Interest Earned",
      value: formatUSD(stats.totalEarned),
      subtext: "From supplying assets",
      icon: TrendingUp,
      color: "green",
      bgColor: "bg-green-50",
      borderColor: "border-green-100",
      textColor: "text-green-700",
      valueColor: "text-green-600",
      iconColor: "text-green-600",
    },
    {
      title: "Interest Paid",
      value: formatUSD(stats.totalPaid),
      subtext: "From borrowing assets",
      icon: TrendingDown,
      color: "red",
      bgColor: "bg-red-50",
      borderColor: "border-red-100",
      textColor: "text-red-700",
      valueColor: "text-red-600",
      iconColor: "text-red-600",
    },
    {
      title: "Net Earnings",
      value: formatUSD(stats.netProfit),
      subtext: stats.netProfit >= 0 ? "Total profit" : "Net cost",
      icon: DollarSign,
      color: stats.netProfit >= 0 ? "blue" : "orange",
      bgColor: stats.netProfit >= 0 ? "bg-blue-50" : "bg-orange-50",
      borderColor:
        stats.netProfit >= 0 ? "border-blue-100" : "border-orange-100",
      textColor: stats.netProfit >= 0 ? "text-blue-700" : "text-orange-700",
      valueColor: stats.netProfit >= 0 ? "text-blue-600" : "text-orange-600",
      iconColor: stats.netProfit >= 0 ? "text-blue-600" : "text-orange-600",
    },
    {
      title: "Current Supply APY",
      value: `${stats.earnAPY.toFixed(2)}%`,
      subtext: "Weighted average rate",
      icon: Activity,
      color: "purple",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-100",
      textColor: "text-purple-700",
      valueColor: "text-purple-600",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-1">Interest & Earnings</h2>
        <p className="text-sm text-gray-600">
          Track your returns from supplying and costs from borrowing
        </p>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`${card.bgColor} rounded-xl shadow-sm p-6 border ${card.borderColor}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-sm font-medium ${card.textColor}`}>
                    {card.title}
                  </p>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <p
                  className={`text-2xl lg:text-3xl font-bold ${card.valueColor} mb-1`}
                >
                  {card.value}
                </p>
                <p className="text-xs text-gray-600">{card.subtext}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Rate Limit Error */}
      {rateLimitError && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-700">
            <strong>⚠️ Rate Limit Reached:</strong> Unable to fetch transaction
            history from The Graph after multiple retries. Displaying current
            APY only. The data will automatically refresh in 60 seconds, or you
            can refresh the page manually.
          </p>
        </div>
      )}

      {/* Info Note */}
      {!rateLimitError && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> Interest calculations are estimated based on
            transaction history. Actual interest earned/paid may vary due to
            continuous compounding and rate changes.
          </p>
        </div>
      )}
    </div>
  );
}
