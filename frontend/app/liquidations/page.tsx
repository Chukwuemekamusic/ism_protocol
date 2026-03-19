'use client';

import { useState } from 'react';
import { AlertCircle, TrendingDown, History, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import {
  getLiquidatablePositions,
  getActiveAuctions,
  getLiquidationHistory,
  getUserLiquidations,
} from '@/lib/subgraph';

import LiquidatablePositionsList from '@/components/liquidations/LiquidatablePositionsList';
import ActiveAuctionsList from '@/components/liquidations/ActiveAuctionsList';
import LiquidationHistoryTable from '@/components/liquidations/LiquidationHistoryTable';

type Tab = 'opportunities' | 'auctions' | 'history' | 'my-liquidations';

export default function LiquidationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('opportunities');
  const { address, isConnected } = useAccount();

  // Fetch liquidatable positions
  const {
    data: liquidatableData,
    isLoading: loadingLiquidatable,
    error: errorLiquidatable,
  } = useQuery({
    queryKey: ['liquidatable-positions'],
    queryFn: () => getLiquidatablePositions(50),
    refetchInterval: 12000, // Refetch every 12 seconds
  });

  // Fetch active auctions
  const {
    data: auctionsData,
    isLoading: loadingAuctions,
    error: errorAuctions,
  } = useQuery({
    queryKey: ['active-auctions'],
    queryFn: () => getActiveAuctions(20),
    refetchInterval: 12000,
  });

  // Fetch liquidation history
  const {
    data: historyData,
    isLoading: loadingHistory,
    error: errorHistory,
  } = useQuery({
    queryKey: ['liquidation-history'],
    queryFn: () => getLiquidationHistory(50, 0),
    refetchInterval: 30000, // History updates less frequently
  });

  // Fetch user's liquidation activity (only if connected)
  const {
    data: userLiquidationsData,
    isLoading: loadingUserLiquidations,
  } = useQuery({
    queryKey: ['user-liquidations', address],
    queryFn: () => getUserLiquidations(address!),
    enabled: isConnected && !!address,
    refetchInterval: 30000,
  });

  const positions = liquidatableData?.positions || [];
  const auctions = auctionsData?.auctions || [];
  const liquidations = historyData?.liquidations || [];
  const userLiquidations = userLiquidationsData?.liquidations || [];

  // Stats for the header cards
  const stats = [
    {
      title: 'Liquidatable Positions',
      value: positions.length.toString(),
      icon: Target,
      color: 'red' as const,
      description: 'Positions with HF < 1.0',
    },
    {
      title: 'Active Auctions',
      value: auctions.length.toString(),
      icon: TrendingDown,
      color: 'orange' as const,
      description: 'Ongoing Dutch auctions',
    },
    {
      title: 'Total Liquidations',
      value: liquidations.length.toString(),
      icon: History,
      color: 'blue' as const,
      description: 'Historical liquidations',
    },
    {
      title: 'Your Liquidations',
      value: isConnected ? userLiquidations.length.toString() : '-',
      icon: AlertCircle,
      color: 'emerald' as const,
      description: 'Your liquidation activity',
    },
  ];

  const colorClasses = {
    red: 'bg-red-50 border-red-100',
    orange: 'bg-orange-50 border-orange-100',
    blue: 'bg-blue-50 border-blue-100',
    emerald: 'bg-emerald-50 border-emerald-100',
  };

  const iconColorClasses = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
  };

  const tabs = [
    { id: 'opportunities' as Tab, label: 'Opportunities', count: positions.length },
    { id: 'auctions' as Tab, label: 'Active Auctions', count: auctions.length },
    { id: 'history' as Tab, label: 'History', count: liquidations.length },
    {
      id: 'my-liquidations' as Tab,
      label: 'My Liquidations',
      count: isConnected ? userLiquidations.length : 0,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Liquidations</h1>
        <p className="text-gray-600">
          Monitor liquidation opportunities and participate in Dutch auction liquidations
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className={`rounded-xl border p-6 transition-all hover:shadow-md ${colorClasses[stat.color]}`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`h-5 w-5 ${iconColorClasses[stat.color]}`} />
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm font-medium text-gray-700 mb-1">{stat.title}</div>
              <div className="text-xs text-gray-500">{stat.description}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'opportunities' && (
          <LiquidatablePositionsList
            positions={positions}
            isLoading={loadingLiquidatable}
            error={errorLiquidatable}
          />
        )}

        {activeTab === 'auctions' && (
          <ActiveAuctionsList
            auctions={auctions}
            isLoading={loadingAuctions}
            error={errorAuctions}
          />
        )}

        {activeTab === 'history' && (
          <LiquidationHistoryTable
            liquidations={liquidations}
            isLoading={loadingHistory}
            error={errorHistory}
          />
        )}

        {activeTab === 'my-liquidations' && (
          <div>
            {!isConnected ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">Connect your wallet to view your liquidation activity</p>
              </div>
            ) : (
              <LiquidationHistoryTable
                liquidations={userLiquidations}
                isLoading={loadingUserLiquidations}
                error={null}
                isUserView
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
