'use client';

import { useMarkets } from '@/hooks/useMarkets';
import MarketCard from '@/components/markets/MarketCard';

export default function HomePage() {
  const { markets, isLoading } = useMarkets();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          ISM Protocol
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl">
          Isolated lending markets on Base. Supply assets to earn interest or borrow against collateral.
        </p>
      </div>

      {/* Protocol Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatCard title="Total Value Locked" value="$0.00" trend="+0%" />
        <StatCard title="Total Markets" value={markets?.length.toString() || '0'} />
        <StatCard title="Active Borrows" value="$0.00" trend="+0%" />
      </div>

      {/* Markets List */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Lending Markets</h2>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium rounded-lg bg-white border hover:bg-gray-50 transition-colors">
              All Markets
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-lg bg-white border hover:bg-gray-50 transition-colors">
              Supply
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-lg bg-white border hover:bg-gray-50 transition-colors">
              Borrow
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : markets && markets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((marketAddress) => (
              <MarketCard key={marketAddress} marketAddress={marketAddress} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">No Markets Available</h3>
            <p className="text-gray-600">
              There are currently no active lending markets. Check back later!
            </p>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <InfoCard
          icon="🔒"
          title="Isolated Markets"
          description="Each market is isolated, preventing one asset collapse from affecting others."
        />
        <InfoCard
          icon="⚡"
          title="MEV-Resistant"
          description="Dutch auction liquidations ensure fair price discovery without MEV extraction."
        />
        <InfoCard
          icon="🌊"
          title="Competitive Rates"
          description="Dynamic interest rates adjust based on supply and demand in each market."
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, trend }: { title: string; value: string; trend?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <p className="text-sm text-gray-600 mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold">{value}</p>
        {trend && (
          <span className="text-sm font-medium text-green-600">{trend}</span>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
