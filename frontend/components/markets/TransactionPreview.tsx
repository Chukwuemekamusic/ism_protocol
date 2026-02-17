'use client';

import { formatUnits, parseUnits } from 'viem';
import { calculateHealthFactor } from '@/lib/utils/calculations';
import HealthFactorDisplay from './HealthFactorDisplay';

type ActionMode =
  | 'supply'
  | 'withdraw'
  | 'borrow'
  | 'repay'
  | 'depositCollateral'
  | 'withdrawCollateral';

interface UserPosition {
  supplied: bigint;
  collateral: bigint;
  borrowed: bigint;
  healthFactor: number;
  maxBorrow: bigint;
}

interface MarketData {
  collateralPrice: bigint;
  borrowPrice: bigint;
  collateralDecimals: number;
  borrowDecimals: number;
  liquidationThreshold: number; // in basis points (8000 = 80%)
}

interface TransactionPreviewProps {
  mode: ActionMode;
  amount: string;
  currentPosition: UserPosition;
  marketData: MarketData;
  collateralSymbol: string;
  borrowSymbol: string;
}

export default function TransactionPreview({
  mode,
  amount,
  currentPosition,
  marketData,
  collateralSymbol,
  borrowSymbol,
}: TransactionPreviewProps) {
  // Parse amount based on mode
  const getDecimals = () => {
    if (mode === 'depositCollateral' || mode === 'withdrawCollateral') {
      return marketData.collateralDecimals;
    }
    return marketData.borrowDecimals;
  };

  const amountBigInt = amount ? parseUnits(amount, getDecimals()) : 0n;

  if (!amount || amountBigInt === 0n) {
    return null; // Don't show preview if no amount entered
  }

  // Calculate new position based on action
  const calculateNewPosition = () => {
    const newPos = { ...currentPosition };

    switch (mode) {
      case 'supply':
        newPos.supplied = currentPosition.supplied + amountBigInt;
        break;

      case 'withdraw':
        newPos.supplied = currentPosition.supplied - amountBigInt;
        break;

      case 'depositCollateral':
        newPos.collateral = currentPosition.collateral + amountBigInt;
        break;

      case 'withdrawCollateral':
        newPos.collateral = currentPosition.collateral - amountBigInt;
        break;

      case 'borrow':
        newPos.borrowed = currentPosition.borrowed + amountBigInt;
        break;

      case 'repay':
        newPos.borrowed = currentPosition.borrowed - amountBigInt;
        if (newPos.borrowed < 0n) newPos.borrowed = 0n;
        break;
    }

    return newPos;
  };

  const newPosition = calculateNewPosition();

  // Calculate health factors
  const currentHF = currentPosition.healthFactor;

  // Calculate new health factor
  const calculateNewHealthFactor = () => {
    // If no debt, health factor is infinite
    if (newPosition.borrowed === 0n) return Infinity;

    // Calculate collateral value in USD (price is in 1e18)
    const collateralValueUSD =
      (newPosition.collateral * marketData.collateralPrice) /
      BigInt(10 ** marketData.collateralDecimals);

    // Calculate debt value in USD (price is in 1e18)
    const debtValueUSD =
      (newPosition.borrowed * marketData.borrowPrice) /
      BigInt(10 ** marketData.borrowDecimals);

    return calculateHealthFactor(
      collateralValueUSD,
      debtValueUSD,
      marketData.liquidationThreshold
    );
  };

  const newHF = calculateNewHealthFactor();

  // Determine if action is safe
  // Only show warnings for actions that WORSEN health factor
  const isRiskyAction = mode === 'borrow' || mode === 'withdrawCollateral' || mode === 'withdraw';
  const isSafe = newHF >= 1.0;
  const isRisky = isRiskyAction && newHF < 1.5 && newHF >= 1.0;
  const isCritical = isRiskyAction && newHF < 1.0;

  // Format values for display
  const formatValue = (value: bigint, decimals: number, symbol: string) => {
    return `${parseFloat(formatUnits(value, decimals)).toFixed(6)} ${symbol}`;
  };

  const formatChange = (oldValue: bigint, newValue: bigint, decimals: number, symbol: string) => {
    const diff = newValue - oldValue;
    const isIncrease = diff > 0n;
    const prefix = isIncrease ? '+' : '';

    return (
      <span className={isIncrease ? 'text-green-600' : 'text-red-600'}>
        ({prefix}
        {parseFloat(formatUnits(diff, decimals)).toFixed(6)} {symbol})
      </span>
    );
  };

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-white mt-4">
      <h3 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
        <span className="text-lg">📊</span>
        Transaction Preview
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Current State */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-500 mb-2 font-medium">Current</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Collateral:</span>
              <span className="font-medium">
                {formatValue(
                  currentPosition.collateral,
                  marketData.collateralDecimals,
                  collateralSymbol
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Debt:</span>
              <span className="font-medium">
                {formatValue(currentPosition.borrowed, marketData.borrowDecimals, borrowSymbol)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-100">
              <span className="text-gray-600">HF:</span>
              <span className="font-medium">
                {currentHF === Infinity ? '∞' : currentHF.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* New State */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-500 mb-2 font-medium">After Transaction</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-600">Collateral:</span>
              <div className="text-right">
                <div className="font-medium">
                  {formatValue(
                    newPosition.collateral,
                    marketData.collateralDecimals,
                    collateralSymbol
                  )}
                </div>
                {newPosition.collateral !== currentPosition.collateral && (
                  <div className="text-xs mt-0.5">
                    {formatChange(
                      currentPosition.collateral,
                      newPosition.collateral,
                      marketData.collateralDecimals,
                      collateralSymbol
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-gray-600">Debt:</span>
              <div className="text-right">
                <div className="font-medium">
                  {formatValue(newPosition.borrowed, marketData.borrowDecimals, borrowSymbol)}
                </div>
                {newPosition.borrowed !== currentPosition.borrowed && (
                  <div className="text-xs mt-0.5">
                    {formatChange(
                      currentPosition.borrowed,
                      newPosition.borrowed,
                      marketData.borrowDecimals,
                      borrowSymbol
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-100">
              <span className="text-gray-600">HF:</span>
              <span
                className={`font-medium ${
                  newHF >= currentHF ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {newHF === Infinity ? '∞' : newHF.toFixed(2)}
                {newHF !== Infinity && currentHF !== Infinity && (
                  <span className="text-xs ml-1">
                    {newHF > currentHF ? '↑' : newHF < currentHF ? '↓' : ''}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Health Factor Visualization */}
      {(mode === 'borrow' ||
        mode === 'withdrawCollateral' ||
        mode === 'repay' ||
        mode === 'depositCollateral') && (
        <div className="mb-3">
          <HealthFactorDisplay
            healthFactor={newHF}
            size="sm"
            showBar={newHF !== Infinity}
          />
        </div>
      )}

      {/* Safety Assessment */}
      {isCritical ? (
        <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
          <div className="flex items-start gap-2">
            <span className="text-xl">⛔</span>
            <div>
              <div className="font-semibold mb-1">Critical Risk - Transaction Blocked!</div>
              <div>
                This {mode} would make your position <strong>liquidatable</strong> (Health Factor
                &lt; 1.0).
                {mode === 'borrow' && ' Reduce the borrow amount or add more collateral first.'}
                {mode === 'withdrawCollateral' && ' You cannot withdraw this much collateral with your current debt.'}
                {mode === 'withdraw' && ' Withdraw less or repay some debt first.'}
              </div>
            </div>
          </div>
        </div>
      ) : isRisky ? (
        <div className="p-3 bg-orange-50 border border-orange-300 rounded-lg text-sm text-orange-800">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-semibold mb-1">High Risk Warning</div>
              <div>
                This {mode} will reduce your health factor to <strong>{newHF.toFixed(2)}</strong>.
                Your position will be at higher risk of liquidation. Consider maintaining HF above 1.5 for safety.
              </div>
            </div>
          </div>
        </div>
      ) : newHF !== Infinity && newHF < currentHF ? (
        <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">ℹ️</span>
            <div>
              Your health factor will decrease to <strong>{newHF.toFixed(2)}</strong>, but remains safe.
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">✓</span>
            <strong>Safe to proceed</strong>
            {newHF > currentHF && currentHF !== Infinity && ' - This action improves your health factor'}
          </div>
        </div>
      )}
    </div>
  );
}
