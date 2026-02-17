'use client';

import { UserPosition } from '@/hooks/useUserPosition';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { AlertTriangle, Shield, PieChart } from 'lucide-react';

interface PortfolioRiskCardProps {
  positions: UserPosition[];
}

export default function PortfolioRiskCard({ positions }: PortfolioRiskCardProps) {
  const { summary, enrichedPositions, isLoading } = usePortfolioData(positions);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const getRiskLevel = () => {
    if (summary.lowestHealthFactor === 0 || summary.totalBorrowedUSD === 0) {
      return { level: 'None', color: 'gray', description: 'No active borrow positions' };
    }
    if (summary.lowestHealthFactor < 1.0) {
      return { level: 'Critical', color: 'red', description: 'Position at risk of liquidation' };
    }
    if (summary.lowestHealthFactor < 1.2) {
      return { level: 'High', color: 'orange', description: 'Close to liquidation threshold' };
    }
    if (summary.lowestHealthFactor < 1.5) {
      return { level: 'Moderate', color: 'yellow', description: 'Monitor position closely' };
    }
    return { level: 'Low', color: 'green', description: 'Healthy position' };
  };

  const riskLevel = getRiskLevel();

  const colorClasses = {
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' },
  };

  const colors = colorClasses[riskLevel.color as keyof typeof colorClasses];

  // Calculate allocation percentages
  const totalAssets = summary.totalSuppliedUSD + summary.totalCollateralUSD;
  const supplyPercentage = totalAssets > 0 ? (summary.totalSuppliedUSD / totalAssets) * 100 : 0;
  const collateralPercentage = totalAssets > 0 ? (summary.totalCollateralUSD / totalAssets) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Risk Overview Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Portfolio Risk</h2>
        </div>

        <div className={`${colors.bg} ${colors.border} border rounded-lg p-4 mb-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Risk Level</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
              {riskLevel.level}
            </span>
          </div>
          <p className={`text-xs ${colors.text}`}>{riskLevel.description}</p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Lowest Health Factor</span>
            <span className={`text-sm font-bold ${colors.text}`}>
              {summary.lowestHealthFactor === 0
                ? 'N/A'
                : summary.lowestHealthFactor === Infinity
                ? '∞'
                : summary.lowestHealthFactor.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Average Health Factor</span>
            <span className="text-sm font-semibold text-gray-900">
              {summary.averageHealthFactor === 0
                ? 'N/A'
                : summary.averageHealthFactor === Infinity
                ? '∞'
                : summary.averageHealthFactor.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Positions</span>
            <span className="text-sm font-semibold text-gray-900">{enrichedPositions.length}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Positions with Debt</span>
            <span className="text-sm font-semibold text-gray-900">
              {enrichedPositions.filter((p) => p.borrowed > 0n).length}
            </span>
          </div>
        </div>

        {/* Warning for risky positions */}
        {summary.lowestHealthFactor > 0 && summary.lowestHealthFactor < 1.2 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700">
                <p className="font-semibold mb-1">Action Required</p>
                <p>
                  One or more positions are close to liquidation. Consider adding more collateral or repaying debt.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Portfolio Allocation Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Portfolio Allocation</h2>
        </div>

        <div className="space-y-4">
          {/* Supply Allocation */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Supply Assets</span>
              <span className="text-sm font-semibold text-gray-900">{supplyPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${supplyPercentage}%` }}
              />
            </div>
          </div>

          {/* Collateral Allocation */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Collateral Assets</span>
              <span className="text-sm font-semibold text-gray-900">{collateralPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${collateralPercentage}%` }}
              />
            </div>
          </div>

          {/* Utilization Rate */}
          {summary.totalBorrowedUSD > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Debt Utilization</span>
                <span className="text-sm font-semibold text-gray-900">
                  {totalAssets > 0 ? ((summary.totalBorrowedUSD / totalAssets) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${totalAssets > 0 ? Math.min((summary.totalBorrowedUSD / totalAssets) * 100, 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Debt as % of total assets</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-sm p-6 border border-blue-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Portfolio Metrics</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Active Markets</span>
            <span className="text-xs font-bold text-gray-900">{enrichedPositions.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Unique Tokens</span>
            <span className="text-xs font-bold text-gray-900">
              {new Set([
                ...enrichedPositions.map((p) => p.collateralSymbol),
                ...enrichedPositions.map((p) => p.borrowSymbol),
              ]).size}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
