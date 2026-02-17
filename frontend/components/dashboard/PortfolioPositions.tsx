"use client";

import { UserPosition } from "@/hooks/useUserPosition";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import {
  formatUSD,
  formatTokenAmount,
  formatAPY,
} from "@/lib/utils/formatters";
import { HealthFactorBadge } from "@/components/markets";
import { ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { AddressDisplay } from "@/components/ui/AddressDisplay";

interface PortfolioPositionsProps {
  positions: UserPosition[];
}

export default function PortfolioPositions({
  positions,
}: PortfolioPositionsProps) {
  const { enrichedPositions, isLoading } = usePortfolioData(positions);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-semibold">Your Positions</h2>
        <p className="text-sm text-gray-600 mt-1">
          {enrichedPositions.length} active{" "}
          {enrichedPositions.length === 1 ? "position" : "positions"} across
          markets
        </p>
      </div>

      {/* Positions List */}
      <div className="divide-y divide-gray-100">
        {enrichedPositions.map((position, index) => (
          <PositionRow key={index} position={position} />
        ))}
      </div>
    </div>
  );
}

function PositionRow({ position }: { position: any }) {
  const hasSupply = position.supplied > 0n;
  const hasCollateral = position.collateral > 0n;
  const hasBorrow = position.borrowed > 0n;

  return (
    <Link
      href={`/markets/${position.marketAddress}`}
      className="block p-6 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        {/* Market Info */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold">
              {position.collateralSymbol} / {position.borrowSymbol}
            </h3>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </div>
          <AddressDisplay address={position.marketAddress} />
        </div>

        {/* Health Factor (if borrowed) */}
        {hasBorrow && (
          <HealthFactorBadge healthFactor={position.healthFactor} size="sm" />
        )}
      </div>

      {/* Position Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Supplied */}
        {hasSupply && (
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <p className="text-xs font-medium text-green-700">Supplied</p>
            </div>
            <p className="text-sm font-bold text-green-900">
              {formatTokenAmount(position.supplied, position.borrowDecimals, 2)}{" "}
              {position.borrowSymbol}
            </p>
            <p className="text-xs text-green-600">
              {formatUSD(position.suppliedUSD)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {formatAPY(position.supplyAPY)} APY
            </p>
          </div>
        )}

        {/* Collateral */}
        {hasCollateral && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs font-medium text-blue-700 mb-1">Collateral</p>
            <p className="text-sm font-bold text-blue-900">
              {formatTokenAmount(
                position.collateral,
                position.collateralDecimals,
                2,
              )}{" "}
              {position.collateralSymbol}
            </p>
            <p className="text-xs text-blue-600">
              {formatUSD(position.collateralUSD)}
            </p>
          </div>
        )}

        {/* Borrowed */}
        {hasBorrow && (
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-3 h-3 text-orange-600" />
              <p className="text-xs font-medium text-orange-700">Borrowed</p>
            </div>
            <p className="text-sm font-bold text-orange-900">
              {formatTokenAmount(position.borrowed, position.borrowDecimals, 2)}{" "}
              {position.borrowSymbol}
            </p>
            <p className="text-xs text-orange-600">
              {formatUSD(position.borrowedUSD)}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              {formatAPY(position.borrowAPY)} APY
            </p>
          </div>
        )}

        {/* Net Value */}
        <div
          className={`${position.netValueUSD >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"} rounded-lg p-3 border`}
        >
          <p
            className={`text-xs font-medium mb-1 ${position.netValueUSD >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            Net Value
          </p>
          <p
            className={`text-sm font-bold ${position.netValueUSD >= 0 ? "text-emerald-900" : "text-red-900"}`}
          >
            {formatUSD(position.netValueUSD)}
          </p>
          <p
            className={`text-xs mt-1 ${position.netValueUSD >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {position.netValueUSD >= 0 ? "Positive equity" : "Negative equity"}
          </p>
        </div>
      </div>
    </Link>
  );
}
