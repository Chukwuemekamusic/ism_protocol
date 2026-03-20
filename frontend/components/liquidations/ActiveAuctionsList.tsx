'use client';

import { useState } from 'react';
import { AlertCircle, TrendingDown, Clock, DollarSign, User, RefreshCw } from 'lucide-react';
import { ActiveAuction, calculateCurrentAuctionPrice } from '@/lib/subgraph';
import { formatTokenAmount } from '@/lib/utils/formatters';
import { AddressDisplay } from '@/components/ui/AddressDisplay';
import { is429Error, getUserFriendlyError } from '@/lib/utils/errorHandling';

interface Props {
  auctions: ActiveAuction[];
  isLoading: boolean;
  error: any;
  refetch?: () => Promise<any>;
}

export default function ActiveAuctionsList({ auctions, isLoading, error, refetch }: Props) {
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

  // Note: Auction prices and time remaining are calculated on each render based on current timestamp.
  // React Query's refetchInterval (60s) provides periodic updates without constant re-renders.
  // This eliminates the previous 1-second setInterval that caused 60 re-renders per minute.

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
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
          <span className="font-medium">Error loading auctions</span>
        </div>
        <p className="text-red-600 text-sm">{getUserFriendlyError(error)}</p>
      </div>
    );
  }

  // Handle 429 rate limit error WITH no cached data
  if (error && is429Error(error) && auctions.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-yellow-700 mb-3">
          <Clock className="h-5 w-5" />
          <span className="font-semibold">Rate Limited</span>
        </div>
        <p className="text-yellow-800 text-sm mb-3">
          The data provider is temporarily rate limiting requests. Polling is paused for 5 minutes to respect rate limits.
        </p>
        <p className="text-yellow-700 text-xs">
          💡 Tip: Use the manual Refresh button when data is available, or wait for automatic polling to resume.
        </p>
      </div>
    );
  }

  // Show empty state if no auctions and no error
  if (auctions.length === 0 && !error) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <TrendingDown className="h-12 w-12 text-blue-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Active Auctions</h3>
        <p className="text-gray-600">There are currently no ongoing Dutch auction liquidations.</p>
      </div>
    );
  }

  const formatTimeRemaining = (endTime: string) => {
    const now = Math.floor(Date.now() / 1000);
    const end = parseInt(endTime);
    const remaining = end - now;

    if (remaining <= 0) return 'Ended';

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const calculatePriceProgress = (auction: ActiveAuction) => {
    const now = Math.floor(Date.now() / 1000);
    const start = parseInt(auction.startTime);
    const end = parseInt(auction.endTime);
    const elapsed = now - start;
    const duration = end - start;

    return Math.min((elapsed / duration) * 100, 100);
  };

  return (
    <div className="space-y-4">
      {/* Rate limit banner (if 429 error with cached data) */}
      {error && is429Error(error) && auctions.length > 0 && (
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
          {auctions.length} Active Auction{auctions.length !== 1 ? 's' : ''}
        </h2>
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

      {auctions.map((auction) => {
        const currentPrice = calculateCurrentAuctionPrice(auction);
        const priceProgress = calculatePriceProgress(auction);
        const timeRemaining = formatTimeRemaining(auction.endTime);

        // Calculate price as percentage of collateral value
        // currentPrice is in 1e18 format (e.g., 1.05e18 = 105%)
        const pricePercent = (Number(currentPrice) / 1e18) * 100;

        return (
          <div
            key={auction.id}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <AddressDisplay address={auction.borrower.id} />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                  <Clock className="h-4 w-4" />
                  <span>{timeRemaining}</span>
                </div>
              </div>
            </div>

            {/* Market Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Market</div>
              <div className="font-medium">
                {auction.market.collateralToken.symbol} / {auction.market.borrowToken.symbol}
              </div>
            </div>

            {/* Auction Details */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Collateral Available</div>
                <div className="font-mono text-sm">
                  {formatTokenAmount(auction.collateralAmount, 18)} {auction.market.collateralToken.symbol}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Debt to Repay</div>
                <div className="font-mono text-sm">
                  {formatTokenAmount(auction.debtAmount, 18)} {auction.market.borrowToken.symbol}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <DollarSign className="h-3 w-3" />
                  <span>Current Price</span>
                </div>
                <div className="font-mono text-lg font-bold text-blue-600">
                  {pricePercent.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500">of collateral value</div>
              </div>
            </div>

            {/* Price Decay Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Premium ({(Number(auction.startPriceMultiplier) / 1e18 * 100).toFixed(0)}%)</span>
                <span>Discount ({(Number(auction.endPriceMultiplier) / 1e18 * 100).toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-full transition-all duration-1000"
                  style={{ width: `${priceProgress}%` }}
                />
              </div>
            </div>

            {/* Started By Info */}
            <div className="text-xs text-gray-500 mb-4 flex items-center gap-1">
              <span>Started by:</span>
              <AddressDisplay address={auction.startedBy} />
            </div>

            {/* Action Button */}
            <button
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Liquidate Position
            </button>
          </div>
        );
      })}
    </div>
  );
}
