'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, TrendingDown, History, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import {
  getLiquidatablePositions,
  getActiveAuctions,
  getLiquidationHistory,
  getUserLiquidations,
} from '@/lib/subgraph';
import { is429Error } from '@/lib/utils/errorHandling';

import LiquidatablePositionsList from '@/components/liquidations/LiquidatablePositionsList';
import ActiveAuctionsList from '@/components/liquidations/ActiveAuctionsList';
import LiquidationHistoryTable from '@/components/liquidations/LiquidationHistoryTable';

type Tab = 'opportunities' | 'auctions' | 'history' | 'my-liquidations';

const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes backoff after rate limit
const NORMAL_REFETCH_INTERVAL = 300000; // 5 minutes normal polling

export default function LiquidationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('opportunities');
  const { address, isConnected } = useAccount();

  // Track rate limit backoff state
  const [rateLimitBackoffUntil, setRateLimitBackoffUntil] = useState<number | null>(null);

  // Check if we're currently in backoff mode
  const isInBackoff = rateLimitBackoffUntil !== null && Date.now() < rateLimitBackoffUntil;

  // Calculate refetch interval (disabled during backoff)
  const getRefetchInterval = (tabActive: boolean) => {
    if (!tabActive) return false;
    if (isInBackoff) return false; // Pause polling during backoff
    return NORMAL_REFETCH_INTERVAL;
  };

  // Fetch liquidatable positions (only when Opportunities tab is active)
  const {
    data: liquidatableData,
    isLoading: loadingLiquidatable,
    error: errorLiquidatable,
    refetch: refetchLiquidatable,
  } = useQuery({
    queryKey: ['liquidatable-positions'],
    queryFn: () => getLiquidatablePositions(50),
    enabled: activeTab === 'opportunities', // Only fetch when tab is active (lazy loading)
    refetchInterval: getRefetchInterval(activeTab === 'opportunities'), // Adaptive: pauses during backoff
    staleTime: 240000, // Use cache for 4 min before considering data stale
  });

  // Fetch active auctions (only when Auctions tab is active)
  const {
    data: auctionsData,
    isLoading: loadingAuctions,
    error: errorAuctions,
    refetch: refetchAuctions,
  } = useQuery({
    queryKey: ['active-auctions'],
    queryFn: () => getActiveAuctions(20),
    enabled: activeTab === 'auctions', // Only fetch when tab is active (lazy loading)
    refetchInterval: getRefetchInterval(activeTab === 'auctions'), // Adaptive: pauses during backoff
    staleTime: 240000, // Use cache for 4 min before considering data stale
  });

  // Fetch liquidation history (only when History tab is active)
  const {
    data: historyData,
    isLoading: loadingHistory,
    error: errorHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['liquidation-history'],
    queryFn: () => getLiquidationHistory(50, 0),
    enabled: activeTab === 'history', // Only fetch when tab is active (lazy loading)
    refetchInterval: getRefetchInterval(activeTab === 'history'), // Adaptive: pauses during backoff
    staleTime: 240000, // Use cache for 4 min before considering data stale
  });

  // Fetch user's liquidation activity (only if connected AND My Liquidations tab is active)
  const {
    data: userLiquidationsData,
    isLoading: loadingUserLiquidations,
    error: errorUserLiquidations,
    refetch: refetchUserLiquidations,
  } = useQuery({
    queryKey: ['user-liquidations', address],
    queryFn: () => getUserLiquidations(address!),
    enabled: isConnected && !!address && activeTab === 'my-liquidations', // Only fetch when tab is active
    refetchInterval: getRefetchInterval(isConnected && activeTab === 'my-liquidations'), // Adaptive: pauses during backoff
    staleTime: 240000, // Use cache for 4 min before considering data stale
  });

  // Detect 429 errors and trigger adaptive backoff
  useEffect(() => {
    const errors = [errorLiquidatable, errorAuctions, errorHistory, errorUserLiquidations];
    const has429Error = errors.some(error => error && is429Error(error));

    if (has429Error && !isInBackoff) {
      // Trigger 5-minute backoff
      const backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      setRateLimitBackoffUntil(backoffUntil);
      console.log(`Rate limit detected. Pausing polling for 5 minutes until ${new Date(backoffUntil).toLocaleTimeString()}`);
    }
  }, [errorLiquidatable, errorAuctions, errorHistory, errorUserLiquidations, isInBackoff]);

  // Clear backoff when time expires
  useEffect(() => {
    if (!rateLimitBackoffUntil) return;

    const timeUntilResume = rateLimitBackoffUntil - Date.now();
    if (timeUntilResume <= 0) {
      setRateLimitBackoffUntil(null);
      return;
    }

    const timer = setTimeout(() => {
      console.log('Rate limit backoff expired. Resuming normal polling.');
      setRateLimitBackoffUntil(null);
    }, timeUntilResume);

    return () => clearTimeout(timer);
  }, [rateLimitBackoffUntil]);

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
            refetch={refetchLiquidatable}
          />
        )}

        {activeTab === 'auctions' && (
          <ActiveAuctionsList
            auctions={auctions}
            isLoading={loadingAuctions}
            error={errorAuctions}
            refetch={refetchAuctions}
          />
        )}

        {activeTab === 'history' && (
          <LiquidationHistoryTable
            liquidations={liquidations}
            isLoading={loadingHistory}
            error={errorHistory}
            refetch={refetchHistory}
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
                refetch={refetchUserLiquidations}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
