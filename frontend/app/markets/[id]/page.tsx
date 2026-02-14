'use client';

import { useParams } from 'next/navigation';
import { useMarketData, useMarketTokenSymbols } from '@/hooks/useMarketData';
import { useUserMarketPosition } from '@/hooks/useUserPosition';
import { useAccount } from 'wagmi';
import { formatTokenAmount, formatAPY, formatPercent } from '@/lib/utils/formatters';
import SupplyBorrowForm from '@/components/markets/SupplyBorrowForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function MarketDetailPage() {
  const params = useParams();
  const marketAddress = params.id as `0x${string}`;
  const { address } = useAccount();

  const { data: market, isLoading: marketLoading } = useMarketData(marketAddress);
  const { collateralSymbol, borrowSymbol } = useMarketTokenSymbols(
    market?.collateralToken || '0x0',
    market?.borrowToken || '0x0'
  );

  const {
    supplied,
    collateral,
    borrowed,
    healthFactor,
    maxBorrow,
    isLoading: positionLoading,
  } = useUserMarketPosition(marketAddress);

  if (marketLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold mb-4">Market Not Found</h1>
          <p className="text-gray-600 mb-8">The market you're looking for doesn't exist.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Markets
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <span>{collateralSymbol}</span>
          <span className="text-gray-400">/</span>
          <span>{borrowSymbol}</span>
          <span className="text-xl font-normal text-gray-500">Market</span>
        </h1>
        <p className="text-sm text-gray-500 font-mono">{marketAddress}</p>
      </div>

      {/* User Position Banner (if connected) */}
      {address && (supplied > 0n || collateral > 0n || borrowed > 0n) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h3 className="font-semibold mb-4">Your Position</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Supplied</p>
              <p className="text-lg font-semibold">
                {formatTokenAmount(supplied, market.borrowDecimals, 4)} {borrowSymbol}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Collateral</p>
              <p className="text-lg font-semibold">
                {formatTokenAmount(collateral, market.collateralDecimals, 4)} {collateralSymbol}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Borrowed</p>
              <p className="text-lg font-semibold">
                {formatTokenAmount(borrowed, market.borrowDecimals, 4)} {borrowSymbol}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Health Factor</p>
              <p className={`text-lg font-semibold ${
                healthFactor >= 1.5 ? 'text-green-600' :
                healthFactor >= 1.2 ? 'text-yellow-600' :
                healthFactor >= 1.0 ? 'text-orange-600' : 'text-red-600'
              }`}>
                {healthFactor === Infinity ? '∞' : healthFactor.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Market Information */}
        <div className="space-y-6">
          {/* APY Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">Interest Rates</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Supply APY</p>
                <p className="text-3xl font-bold text-green-600">{formatAPY(market.supplyAPY)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Borrow APY</p>
                <p className="text-3xl font-bold text-blue-600">{formatAPY(market.borrowAPY)}</p>
              </div>
            </div>
          </div>

          {/* Market Stats */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">Market Information</h2>
            <div className="space-y-4">
              <InfoRow
                label="Total Supplied"
                value={`${formatTokenAmount(market.totalSupply, market.borrowDecimals, 2)} ${borrowSymbol}`}
              />
              <InfoRow
                label="Total Borrowed"
                value={`${formatTokenAmount(market.totalBorrow, market.borrowDecimals, 2)} ${borrowSymbol}`}
              />
              <InfoRow
                label="Utilization Rate"
                value={formatPercent(market.utilization)}
                highlight={market.utilization > 90 ? 'text-red-600' : market.utilization > 75 ? 'text-yellow-600' : ''}
              />
              <InfoRow
                label="Available Liquidity"
                value={`${formatTokenAmount(market.totalSupply - market.totalBorrow, market.borrowDecimals, 2)} ${borrowSymbol}`}
              />
            </div>
          </div>

          {/* Risk Parameters */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">Risk Parameters</h2>
            <div className="space-y-4">
              <InfoRow
                label="Max LTV"
                value={`${market.ltv}%`}
                description="Maximum loan-to-value ratio for borrowing"
              />
              <InfoRow
                label="Liquidation Threshold"
                value={`${market.liquidationThreshold}%`}
                description="Position becomes liquidatable below this threshold"
              />
              <InfoRow
                label="Liquidation Penalty"
                value={`${market.liquidationPenalty}%`}
                description="Penalty paid to liquidators"
              />
              <InfoRow
                label="Reserve Factor"
                value={`${market.reserveFactor}%`}
                description="Protocol fee on interest"
              />
            </div>
          </div>

          {/* Token Information */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">Token Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Collateral Token</p>
                <p className="font-mono text-sm">{market.collateralToken}</p>
                <p className="text-sm font-semibold">{collateralSymbol} ({market.collateralDecimals} decimals)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Borrow Token</p>
                <p className="font-mono text-sm">{market.borrowToken}</p>
                <p className="text-sm font-semibold">{borrowSymbol} ({market.borrowDecimals} decimals)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Supply/Borrow Form */}
        <div>
          <SupplyBorrowForm
            marketAddress={marketAddress}
            market={market}
            collateralSymbol={collateralSymbol}
            borrowSymbol={borrowSymbol}
            userPosition={{
              supplied,
              collateral,
              borrowed,
              healthFactor,
              maxBorrow,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  description,
  highlight,
}: {
  label: string;
  value: string;
  description?: string;
  highlight?: string;
}) {
  return (
    <div className="flex justify-between items-start">
      <div>
        <p className="text-gray-600">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </div>
      <p className={`font-semibold ${highlight || ''}`}>{value}</p>
    </div>
  );
}
