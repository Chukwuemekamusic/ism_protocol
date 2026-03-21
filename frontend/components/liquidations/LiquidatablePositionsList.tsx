'use client';

import { useState } from 'react';
import { AlertCircle, User, Coins, TrendingDown, Clock, RefreshCw } from 'lucide-react';
import { LiquidatablePosition } from '@/lib/subgraph';
import {
  formatHealthFactor,
  formatTimeUnderwater,
  isCriticallyUndunderwater,
} from '@/lib/subgraph';
import { formatTokenAmount } from '@/lib/utils/formatters';
import { AddressDisplay } from '@/components/ui/AddressDisplay';
import { is429Error, getUserFriendlyError } from '@/lib/utils/errorHandling';

interface Props {
  positions: LiquidatablePosition[];
  isLoading: boolean;
  error: any;
  refetch?: () => Promise<any>;
}

export default function LiquidatablePositionsList({ positions, isLoading, error, refetch }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!refetch || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  // Handle non-rate-limit errors (show error, no cached data)
  if (error && !is429Error(error)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Error loading liquidatable positions</span>
        </div>
        <p className="text-red-600 text-sm">{getUserFriendlyError(error)}</p>
      </div>
    );
  }

  // Handle 429 rate limit error WITH no cached data
  if (error && is429Error(error) && positions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-yellow-700 mb-3">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Rate Limited</span>
          </div>
          <p className="text-yellow-800 text-sm mb-3">
            The data provider is temporarily rate limiting requests. Polling is paused for 5 minutes to respect rate limits.
          </p>
          <p className="text-yellow-700 text-xs mb-4">
            💡 Tip: Click the Refresh button below to try again, or wait for automatic polling to resume.
          </p>
          {refetch && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              title="Manually refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Show empty state if no positions and no error
  if (positions.length === 0 && !error) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <AlertCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Liquidatable Positions</h3>
        <p className="text-gray-600">All positions are healthy. Check back later for opportunities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rate limit banner (if 429 error with cached data) */}
      {error && is429Error(error) && positions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-yellow-700 mb-2">
            <Clock className="h-4 w-4" />
            <span className="font-semibold text-sm">Rate Limited - Showing Cached Data</span>
          </div>
          <p className="text-yellow-800 text-xs">
            The data provider is temporarily rate limiting requests. Showing cached data below. Polling is paused for 5 minutes. Use the Refresh button above to update manually.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {positions.length} Liquidatable Position{positions.length !== 1 ? 's' : ''}
        </h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">Sorted by health factor (lowest first)</p>
          {refetch && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              title="Manually refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {positions.map((position) => {
        const isCritical = isCriticallyUndunderwater(position.healthFactor);
        const hf = formatHealthFactor(position.healthFactor);
        const timeUnderwater = formatTimeUnderwater(position.timeUnderwater);

        return (
          <div
            key={position.id}
            className={`
              bg-white rounded-xl shadow-sm p-6 border transition-all hover:shadow-md
              ${isCritical ? 'border-red-300 bg-red-50/30' : 'border-gray-100'}
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <AddressDisplay address={position.user.id} />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`
                    px-3 py-1 rounded-full text-sm font-medium
                    ${isCritical ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}
                  `}
                >
                  HF: {hf}
                </span>
              </div>
            </div>

            {/* Market Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Market</div>
              <div className="font-medium">
                {position.market.collateralToken.symbol} / {position.market.borrowToken.symbol}
              </div>
            </div>

            {/* Position Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <Coins className="h-3 w-3" />
                  <span>Collateral</span>
                </div>
                <div className="font-mono text-sm">
                  {formatTokenAmount(position.collateralAmount, position.market.collateralToken.decimals)}{' '}
                  {position.market.collateralToken.symbol}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <TrendingDown className="h-3 w-3" />
                  <span>Debt</span>
                </div>
                <div className="font-mono text-sm">
                  {formatTokenAmount(position.borrowedAmount, position.market.borrowToken.decimals)}{' '}
                  {position.market.borrowToken.symbol}
                </div>
              </div>
            </div>

            {/* Time Underwater */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <Clock className="h-4 w-4" />
              <span>Underwater for: {timeUnderwater}</span>
            </div>

            {/* Action Button */}
            <button
              className={`
                w-full py-2.5 px-4 rounded-lg font-medium transition-colors
                ${
                  isCritical
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }
              `}
            >
              Start Liquidation Auction
            </button>
          </div>
        );
      })}
    </div>
  );
}
