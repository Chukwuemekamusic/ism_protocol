'use client';

import { AlertCircle, ExternalLink, TrendingUp } from 'lucide-react';
import { Liquidation } from '@/lib/subgraph';
import { formatTokenAmount, formatRelativeTime } from '@/lib/utils/formatters';
import { AddressDisplay } from '@/components/ui/AddressDisplay';

interface Props {
  liquidations: Liquidation[];
  isLoading: boolean;
  error: any;
  isUserView?: boolean;
}

export default function LiquidationHistoryTable({
  liquidations,
  isLoading,
  error,
  isUserView = false,
}: Props) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Error loading liquidation history</span>
        </div>
        <p className="text-red-600 text-sm">{error.message || 'Failed to load data'}</p>
      </div>
    );
  }

  if (liquidations.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          {isUserView ? 'No Liquidations Yet' : 'No Liquidation History'}
        </h3>
        <p className="text-gray-600">
          {isUserView
            ? "You haven't executed any liquidations yet."
            : 'No liquidations have occurred on this protocol yet.'}
        </p>
      </div>
    );
  }

  const getBaseScanUrl = (txHash: string) => {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-semibold">
          {isUserView ? 'Your ' : ''}Liquidation History ({liquidations.length})
        </h2>
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liquidator
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Borrower
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Debt Repaid
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Collateral Seized
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Profit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tx
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {liquidations.map((liquidation) => (
              <tr key={liquidation.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatRelativeTime(parseInt(liquidation.timestamp))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AddressDisplay address={liquidation.liquidator.id} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AddressDisplay address={liquidation.borrower.id} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="font-medium">
                    {liquidation.market.collateralToken.symbol} / {liquidation.market.borrowToken.symbol}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                  {formatTokenAmount(liquidation.debtRepaid, 18)} {liquidation.market.borrowToken.symbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                  {formatTokenAmount(liquidation.collateralReceived, 18)}{' '}
                  {liquidation.market.collateralToken.symbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-green-600">
                    +${parseFloat(liquidation.profitUSD).toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <a
                    href={getBaseScanUrl(liquidation.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {liquidations.map((liquidation) => (
          <div key={liquidation.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">
                {formatRelativeTime(parseInt(liquidation.timestamp))}
              </span>
              <a
                href={getBaseScanUrl(liquidation.transactionHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500">Market</div>
                <div className="font-medium text-sm">
                  {liquidation.market.collateralToken.symbol} / {liquidation.market.borrowToken.symbol}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Liquidator</div>
                  <AddressDisplay address={liquidation.liquidator.id} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Borrower</div>
                  <AddressDisplay address={liquidation.borrower.id} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Debt Repaid</div>
                  <div className="font-mono text-sm">
                    {formatTokenAmount(liquidation.debtRepaid, 18)} {liquidation.market.borrowToken.symbol}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Collateral Seized</div>
                  <div className="font-mono text-sm">
                    {formatTokenAmount(liquidation.collateralReceived, 18)}{' '}
                    {liquidation.market.collateralToken.symbol}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Profit</div>
                <div className="text-sm font-medium text-green-600">
                  +${parseFloat(liquidation.profitUSD).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
