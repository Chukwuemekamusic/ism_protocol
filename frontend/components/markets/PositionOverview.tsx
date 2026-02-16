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
  // Formula: liquidationPrice = debtValue / (collateralAmount * liquidationThreshold)
  // Using liquidationThreshold = 0.80
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

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
      <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
        <span>📊</span>
        Your Position
      </h3>

      <div className="space-y-4">
        {/* Supply Section */}
        {userPosition.supplied > 0n && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-xs text-green-700 font-medium mb-2">Supplied (Earning Interest)</div>
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold text-green-800">
                {parseFloat(formatUnits(userPosition.supplied, marketData.borrowDecimals)).toFixed(4)}
              </span>
              <span className="text-sm text-green-700">{borrowSymbol}</span>
            </div>
          </div>
        )}

        {/* Collateral Section */}
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Collateral</span>
          <div className="text-right">
            <div className="font-semibold">
              {parseFloat(formatUnits(userPosition.collateral, marketData.collateralDecimals)).toFixed(6)}{' '}
              {collateralSymbol}
            </div>
            <div className="text-xs text-gray-500">${collateralValueUSD.toFixed(2)}</div>
          </div>
        </div>

        {/* Debt Section */}
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Borrowed</span>
          <div className="text-right">
            <div className="font-semibold">
              {parseFloat(formatUnits(userPosition.borrowed, marketData.borrowDecimals)).toFixed(6)}{' '}
              {borrowSymbol}
            </div>
            <div className="text-xs text-gray-500">${debtValueUSD.toFixed(2)}</div>
          </div>
        </div>

        {/* Health Factor */}
        {userPosition.borrowed > 0n && (
          <div className="pt-2">
            <HealthFactorDisplay healthFactor={userPosition.healthFactor} size="sm" />
          </div>
        )}

        {/* Liquidation Price */}
        {userPosition.borrowed > 0n && liquidationPrice > 0 && (
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-gray-700 font-medium">Liquidation Price</span>
              <span className="font-bold text-orange-700">
                ${liquidationPrice.toFixed(2)} / {collateralSymbol}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>Current Price:</span>
              <span className="font-medium">${currentCollateralPrice.toFixed(2)}</span>
            </div>
            <div className="mt-2 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-600">Safety Margin:</span>
                <span
                  className={`font-semibold ${
                    safetyMarginPercent > 50
                      ? 'text-green-700'
                      : safetyMarginPercent > 20
                        ? 'text-yellow-700'
                        : 'text-red-700'
                  }`}
                >
                  {safetyMarginPercent.toFixed(1)}% ↓
                </span>
              </div>
              <div className="text-gray-600">
                Price must drop {safetyMarginPercent.toFixed(1)}% to reach liquidation
              </div>
            </div>
          </div>
        )}

        {/* Borrow Capacity */}
        {userPosition.maxBorrow > 0n && (
          <div>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-gray-600 font-medium">Borrow Capacity</span>
              <span className="text-xs text-gray-500">
                ${debtValueUSD.toFixed(2)} / ${maxBorrowValueUSD.toFixed(2)} (
                {borrowLimitUsage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
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
            <div className="mt-1 text-xs text-gray-600">
              Available to borrow:{' '}
              {parseFloat(
                formatUnits(userPosition.maxBorrow - userPosition.borrowed, marketData.borrowDecimals)
              ).toFixed(6)}{' '}
              {borrowSymbol}
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Total Value</div>
            <div className="text-lg font-bold text-gray-800">
              ${(collateralValueUSD + debtValueUSD).toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Net Value</div>
            <div
              className={`text-lg font-bold ${
                collateralValueUSD - debtValueUSD >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              ${(collateralValueUSD - debtValueUSD).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {borrowLimitUsage > 90 && (
        <div className="mt-4 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
          ⚠️ You're using {borrowLimitUsage.toFixed(1)}% of your borrow capacity. Consider adding
          more collateral or repaying debt.
        </div>
      )}
    </div>
  );
}
