'use client';

import { UserPosition } from '@/hooks/useUserPosition';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { formatUSD, formatAPY } from '@/lib/utils/formatters';
import { TrendingUp, DollarSign, Wallet, AlertCircle } from 'lucide-react';

interface PortfolioOverviewProps {
  positions: UserPosition[];
}

export default function PortfolioOverview({ positions }: PortfolioOverviewProps) {
  const { summary, isLoading } = usePortfolioData(positions);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'Net Portfolio Value',
      value: formatUSD(summary.netValueUSD),
      icon: DollarSign,
      color: summary.netValueUSD >= 0 ? 'emerald' : 'red',
      subtext: 'Total assets - Total debt',
    },
    {
      title: 'Total Supplied',
      value: formatUSD(summary.totalSuppliedUSD + summary.totalCollateralUSD),
      icon: Wallet,
      color: 'blue',
      subtext: `Earning ${formatAPY(summary.totalSupplyAPY)} APY`,
    },
    {
      title: 'Total Borrowed',
      value: formatUSD(summary.totalBorrowedUSD),
      icon: TrendingUp,
      color: 'orange',
      subtext: summary.totalBorrowedUSD > 0 ? `Paying ${formatAPY(summary.totalBorrowAPY)} APY` : 'No active borrows',
    },
    {
      title: 'Lowest Health Factor',
      value: summary.lowestHealthFactor === 0
        ? 'N/A'
        : summary.lowestHealthFactor === Infinity
        ? '∞'
        : summary.lowestHealthFactor.toFixed(2),
      icon: AlertCircle,
      color: summary.lowestHealthFactor < 1.2 && summary.lowestHealthFactor !== 0
        ? 'red'
        : summary.lowestHealthFactor < 1.5 && summary.lowestHealthFactor !== 0
        ? 'yellow'
        : 'green',
      subtext: summary.lowestHealthFactor < 1.0 && summary.lowestHealthFactor !== 0
        ? '⚠️ At risk of liquidation'
        : summary.lowestHealthFactor < 1.5 && summary.lowestHealthFactor !== 0
        ? '⚡ Monitor closely'
        : summary.totalBorrowedUSD > 0
        ? '✅ Healthy position'
        : 'No borrow positions',
    },
  ];

  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-100',
    red: 'bg-red-50 border-red-100',
    blue: 'bg-blue-50 border-blue-100',
    orange: 'bg-orange-50 border-orange-100',
    yellow: 'bg-yellow-50 border-yellow-100',
    green: 'bg-green-50 border-green-100',
  };

  const iconColorClasses = {
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
  };

  const valueColorClasses = {
    emerald: 'text-emerald-900',
    red: 'text-red-900',
    blue: 'text-blue-900',
    orange: 'text-orange-900',
    yellow: 'text-yellow-900',
    green: 'text-green-900',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={`${colorClasses[stat.color as keyof typeof colorClasses]} rounded-xl shadow-sm p-6 border`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">{stat.title}</p>
              <Icon className={`w-5 h-5 ${iconColorClasses[stat.color as keyof typeof iconColorClasses]}`} />
            </div>
            <p className={`text-3xl font-bold mb-1 ${valueColorClasses[stat.color as keyof typeof valueColorClasses]}`}>
              {stat.value}
            </p>
            <p className="text-xs text-gray-600">{stat.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}
