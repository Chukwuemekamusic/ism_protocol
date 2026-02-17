"use client";

import { formatAPY, formatPercent } from "@/lib/utils/formatters";
import { TrendingUp, TrendingDown, Info } from "lucide-react";

interface InterestRatesCardProps {
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  borrowSymbol: string;
}

export function InterestRatesCard({
  supplyAPY,
  borrowAPY,
  utilization,
  borrowSymbol,
}: InterestRatesCardProps) {
  // Calculate the spread (difference between borrow and supply rates)
  const spread = borrowAPY - supplyAPY;

  // Determine utilization status
  const getUtilizationStatus = () => {
    if (utilization >= 90)
      return { color: "text-red-600", bg: "bg-red-50", label: "Very High" };
    if (utilization >= 75)
      return { color: "text-orange-600", bg: "bg-orange-50", label: "High" };
    if (utilization >= 50)
      return {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        label: "Moderate",
      };
    return { color: "text-green-600", bg: "bg-green-50", label: "Low" };
  };

  const utilizationStatus = getUtilizationStatus();

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Interest Rates</h2>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Info className="w-3 h-3" />
          <span>Live rates</span>
        </div>
      </div>

      {/* Main APY Display */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-green-700">Supply APY</p>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {formatAPY(supplyAPY)}
          </p>
          <p className="text-xs text-green-600 mt-1">
            Earn by supplying {borrowSymbol}
          </p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-700">Borrow APY</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {formatAPY(borrowAPY)}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Cost to borrow {borrowSymbol}
          </p>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Utilization Rate
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold ${utilizationStatus.color}`}
            >
              {formatPercent(utilization)}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${utilizationStatus.bg} ${utilizationStatus.color}`}
            >
              {utilizationStatus.label}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              utilization >= 90
                ? "bg-red-500"
                : utilization >= 75
                  ? "bg-orange-500"
                  : utilization >= 50
                    ? "bg-yellow-500"
                    : "bg-green-500"
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Percentage of supplied {borrowSymbol} currently being borrowed
        </p>
      </div>
    </div>
  );
}
