'use client';

import { formatUnits } from 'viem';
import HealthFactorDisplay from './HealthFactorDisplay';
import { calculateBorrowLimitUsage } from '@/lib/utils/calculations';

interface PositionOverviewProps {
  userPosition: {
    supplied: bigint;
    collateral: bigint;
    borrowed: bigint;
    healthFactor: number;
    maxBorrow: bigint;
  };
  marketData: {
    collateralPrice: bigint;
    borrowPrice: bigint;
    collateralDecimals: number;
    borrowDecimals: number;
  };
  collateralSymbol: string;
  borrowSymbol: string;
}

export default function PositionOverview({
  userPosition,
  marketData,
  collateralSymbol,
  borrowSymbol,
}: PositionOverviewProps) {
  // Calculate USD values
  const collateralValueUSD =
    (Number(userPosition.collateral) *
      Number(formatUnits(marketData.collateralPrice, 18))) /
    10 ** marketData.collateralDecimals;

  const debtValueUSD =
    (Number(userPosition.borrowed) * Number(formatUnits(marketData.borrowPrice, 18))) /
    10 ** marketData.borrowDecimals;

  const maxBorrowValueUSD =
    (Number(userPosition.maxBorrow) * Number(formatUnits(marketData.borrowPrice, 18))) /
    10 ** marketData.borrowDecimals;

  const borrowLimitUsage = calculateBorrowLimitUsage(
    userPosition.borrowed,
    userPosition.maxBorrow
  );

  // Calculate liquidation price (price at which ETH would trigger liquidation)
  const liquidationPrice =
    userPosition.collateral > 0n && userPosition.borrowed > 0n
      ? (debtValueUSD / Number(formatUnits(userPosition.collateral, marketData.collateralDecimals))) /
        0.8
      : 0;

  const currentCollateralPrice = Number(formatUnits(marketData.collateralPrice, 18));

  // Calculate safety margin (how much price can drop before liquidation)
  const safetyMarginPercent =
    currentCollateralPrice > 0 && liquidationPrice > 0
      ? ((currentCollateralPrice - liquidationPrice) / currentCollateralPrice) * 100
      : 0;

  // Check if user has any position
  const hasPosition = userPosition.collateral > 0n || userPosition.borrowed > 0n || userPosition.supplied > 0n;

  if (!hasPosition) {
    return (
      <div className="border rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white shadow-sm">
        <h3 className="font-semibold mb-2 text-gray-800">Your Position</h3>
        <p className="text-sm text-gray-600">
          You don't have any position in this market yet. Supply assets to earn interest or deposit
          collateral to borrow.
        </p>
      </div>
    );
  }

  const netValue = collateralValueUSD - debtValueUSD;

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2 mb-4">
        <span>📊</span>
        Your Position
      </h3>

      {/* Top Grid: Main Position Values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Supplied */}
        {userPosition.supplied > 0n && (
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-xs text-green-700 mb-1">Supplied</p>
            <p className="text-lg font-bold text-green-800">
              {parseFloat(formatUnits(userPosition.supplied, marketData.borrowDecimals)).toFixed(2)}
            </p>
            <p className="text-xs text-green-700">{borrowSymbol}</p>
          </div>
        )}

        {/* Collateral */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <p className="text-xs text-blue-700 mb-1">Collateral</p>
          <p className="text-lg font-bold text-blue-800">
            {parseFloat(formatUnits(userPosition.collateral, marketData.collateralDecimals)).toFixed(4)}
          </p>
          <p className="text-xs text-blue-700">{collateralSymbol} (${collateralValueUSD.toFixed(2)})</p>
        </div>

        {/* Borrowed */}
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
          <p className="text-xs text-orange-700 mb-1">Borrowed</p>
          <p className="text-lg font-bold text-orange-800">
            {parseFloat(formatUnits(userPosition.borrowed, marketData.borrowDecimals)).toFixed(2)}
          </p>
          <p className="text-xs text-orange-700">{borrowSymbol} (${debtValueUSD.toFixed(2)})</p>
        </div>

        {/* Net Value */}
        <div className={`rounded-lg p-3 border ${netValue >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs mb-1 ${netValue >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Value</p>
          <p className={`text-lg font-bold ${netValue >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            ${Math.abs(netValue).toFixed(2)}
          </p>
          <p className={`text-xs ${netValue >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {netValue >= 0 ? 'Equity' : 'Deficit'}
          </p>
        </div>
      </div>

      {/* Health Factor & Borrow Capacity Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Health Factor */}
        {userPosition.borrowed > 0n && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <HealthFactorDisplay healthFactor={userPosition.healthFactor} size="sm" />
          </div>
        )}

        {/* Borrow Capacity */}
        {userPosition.maxBorrow > 0n && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-gray-700 font-medium">Borrow Capacity</span>
              <span className="text-xs text-gray-500">
                {borrowLimitUsage.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  borrowLimitUsage > 90
                    ? 'bg-red-500'
                    : borrowLimitUsage > 75
                      ? 'bg-orange-500'
                      : borrowLimitUsage > 50
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(borrowLimitUsage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>${debtValueUSD.toFixed(2)} used</span>
              <span>${maxBorrowValueUSD.toFixed(2)} max</span>
            </div>
          </div>
        )}
      </div>

      {/* Liquidation Info (Compact) */}
      {userPosition.borrowed > 0n && liquidationPrice > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-3 border border-orange-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-600 mb-1">Liquidation Price</p>
              <p className="font-bold text-orange-700">
                ${liquidationPrice.toFixed(2)} / {collateralSymbol}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 mb-1">Current Price</p>
              <p className="font-semibold text-gray-800">${currentCollateralPrice.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 mb-1">Safety Margin</p>
              <p
                className={`font-bold ${
                  safetyMarginPercent > 50
                    ? 'text-green-700'
                    : safetyMarginPercent > 20
                      ? 'text-yellow-700'
                      : 'text-red-700'
                }`}
              >
                {safetyMarginPercent.toFixed(1)}% ↓
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning for high utilization */}
      {borrowLimitUsage > 90 && (
        <div className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
          ⚠️ High borrow utilization ({borrowLimitUsage.toFixed(0)}%). Consider adding more collateral or repaying debt.
        </div>
      )}
    </div>
  );
}
