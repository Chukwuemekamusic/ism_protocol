'use client';

import Link from 'next/link';
import { useMarketData, useMarketTokenSymbols } from '@/hooks/useMarketData';
import { formatTokenAmount, formatAPY } from '@/lib/utils/formatters';
import { ArrowRight } from 'lucide-react';

interface MarketCardProps {
  marketAddress: `0x${string}`;
}

export default function MarketCard({ marketAddress }: MarketCardProps) {
  const { data: market, isLoading } = useMarketData(marketAddress);
  const { collateralSymbol, borrowSymbol } = useMarketTokenSymbols(
    market?.collateralToken || '0x',
    market?.borrowToken || '0x'
  );

  if (isLoading || !market) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <Link href={`/markets/${marketAddress}`}>
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
        {/* Market Title */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>{collateralSymbol}</span>
            <span className="text-gray-400">/</span>
            <span>{borrowSymbol}</span>
          </h3>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </div>

        {/* APY Rates */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Supply APY</p>
            <p className="text-lg font-semibold text-green-600">
              {formatAPY(market.supplyAPY)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Borrow APY</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatAPY(market.borrowAPY)}
            </p>
          </div>
        </div>

        {/* Market Stats */}
        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Supply</span>
            <span className="font-medium">
              {formatTokenAmount(market.totalSupply, market.borrowDecimals, 2)} {borrowSymbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Borrow</span>
            <span className="font-medium">
              {formatTokenAmount(market.totalBorrow, market.borrowDecimals, 2)} {borrowSymbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Utilization</span>
            <span className="font-medium">{market.utilization.toFixed(2)}%</span>
          </div>
        </div>

        {/* LTV Badge */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Max LTV</span>
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
              {market.ltv}%
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
