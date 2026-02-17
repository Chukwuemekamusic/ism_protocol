'use client';

import { useParams } from 'next/navigation';
import { useMarketData, useMarketTokenSymbols } from '@/hooks/useMarketData';
import { useUserMarketPosition } from '@/hooks/useUserPosition';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useAccount } from 'wagmi';
import { formatTokenAmount, formatAPY, formatPercent } from '@/lib/utils/formatters';
import {
  SupplyBorrowFormEnhanced,
  PositionOverview,
  InterestRatesCard,
} from '@/components/markets';
import { AddressDisplay } from '@/components/ui/AddressDisplay';
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

  // Fetch token prices from oracle
  const { collateralPrice, borrowPrice, isLoading: pricesLoading } = useTokenPrices(
    market?.collateralToken || '0x0',
    market?.borrowToken || '0x0'
  );

  if (marketLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
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

  const userPosition = {
    supplied,
    collateral,
    borrowed,
    healthFactor,
    maxBorrow,
  };

  const hasPosition = supplied > 0n || collateral > 0n || borrowed > 0n;

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
        <AddressDisplay address={marketAddress} className="text-gray-500" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Market Information & Position Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Position Overview (if user has a position) */}
          {address && hasPosition && !pricesLoading && collateralPrice > 0n && borrowPrice > 0n && (
            <PositionOverview
              userPosition={userPosition}
              marketData={{
                collateralPrice,
                borrowPrice,
                collateralDecimals: market.collateralDecimals,
                borrowDecimals: market.borrowDecimals,
              }}
              collateralSymbol={collateralSymbol}
              borrowSymbol={borrowSymbol}
            />
          )}

          {/* Interest Rates Card */}
          <InterestRatesCard
            supplyAPY={market.supplyAPY}
            borrowAPY={market.borrowAPY}
            utilization={market.utilization}
            borrowSymbol={borrowSymbol}
          />

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
                <p className="text-sm text-gray-600 mb-2">Collateral Token</p>
                <AddressDisplay address={market.collateralToken} className="mb-2" />
                <p className="text-sm font-semibold text-gray-700">{collateralSymbol} ({market.collateralDecimals} decimals)</p>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-2">Borrow Token</p>
                <AddressDisplay address={market.borrowToken} className="mb-2" />
                <p className="text-sm font-semibold text-gray-700">{borrowSymbol} ({market.borrowDecimals} decimals)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Enhanced Supply/Borrow Form */}
        <div className="lg:col-span-1">
          {!pricesLoading && collateralPrice > 0n && borrowPrice > 0n ? (
            <SupplyBorrowFormEnhanced
              marketAddress={marketAddress}
              market={market}
              collateralSymbol={collateralSymbol}
              borrowSymbol={borrowSymbol}
              userPosition={userPosition}
              collateralPrice={collateralPrice}
              borrowPrice={borrowPrice}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
              <p className="text-sm text-gray-500 mt-4">Loading prices...</p>
            </div>
          )}
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
