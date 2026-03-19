'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, TrendingDown, Clock, DollarSign, User } from 'lucide-react';
import { ActiveAuction, calculateCurrentAuctionPrice } from '@/lib/subgraph';
import { formatTokenAmount } from '@/lib/utils/formatters';
import { AddressDisplay } from '@/components/ui/AddressDisplay';

interface Props {
  auctions: ActiveAuction[];
  isLoading: boolean;
  error: any;
}

export default function ActiveAuctionsList({ auctions, isLoading, error }: Props) {
  // Force re-render every second to update auction prices
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Error loading auctions</span>
        </div>
        <p className="text-red-600 text-sm">{error.message || 'Failed to load data'}</p>
      </div>
    );
  }

  if (auctions.length === 0) {
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {auctions.length} Active Auction{auctions.length !== 1 ? 's' : ''}
        </h2>
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
