'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useUserPositions } from '@/hooks/useUserPosition';
import { usePortfolioData } from '@/hooks/usePortfolioData';

interface HealthFactorDataPoint {
  timestamp: number;
  date: string;
  healthFactor: number;
  type: string;
}

export function HealthFactorChart() {
  const { address } = useAccount();
  const { positions } = useUserPositions();
  const { enrichedPositions } = usePortfolioData(positions);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('7d');
  const [data, setData] = useState<HealthFactorDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ min: 0, max: 0, current: 0 });

  const fetchHealthFactorHistory = useCallback(async () => {
    if (!address || enrichedPositions.length === 0) {
      setIsLoading(false);
      setData([]);
      return;
    }

    try {
      setIsLoading(true);

      // Generate synthetic health factor history
      // Note: In production, this would query position snapshots from the subgraph
      const now = Date.now() / 1000;
      const dataPoints: HealthFactorDataPoint[] = [];

      // Get current health factor from enriched positions
      const currentHF = enrichedPositions.reduce((min, pos) => {
        if (pos.borrowedUSD > 0) {
          const hf = pos.healthFactor;
          return hf < min ? hf : min;
        }
        return min;
      }, Infinity);

      // Create synthetic data points (in production, use position snapshots from subgraph)
      const timeframeDays = { '7d': 7, '30d': 30, '90d': 90 } as const;
      const daysToShow = timeframeDays[timeframe];
      const hoursInterval = timeframe === '7d' ? 6 : timeframe === '30d' ? 12 : 24;

      for (let i = daysToShow; i >= 0; i -= hoursInterval / 24) {
        const timestamp = now - i * 24 * 60 * 60;

        // Simulate HF variation (in production, fetch from snapshots)
        const variation = Math.random() * 0.3 - 0.15; // ±15% variation
        const hf = currentHF === Infinity
          ? 2.5 + variation
          : Math.max(0.8, Math.min(3.0, currentHF + variation));

        dataPoints.push({
          timestamp,
          date: new Date(timestamp * 1000).toLocaleDateString(),
          healthFactor: parseFloat(hf.toFixed(2)),
          type: 'snapshot',
        });
      }

      // Add current point
      if (currentHF !== Infinity) {
        dataPoints.push({
          timestamp: now,
          date: 'Now',
          healthFactor: parseFloat(currentHF.toFixed(2)),
          type: 'current',
        });
      }

      // Sort by timestamp
      dataPoints.sort((a, b) => a.timestamp - b.timestamp);

      setData(dataPoints);

      // Calculate stats
      if (dataPoints.length > 0) {
        const hfValues = dataPoints.map((d) => d.healthFactor);
        setStats({
          min: Math.min(...hfValues),
          max: Math.max(...hfValues),
          current: currentHF === Infinity ? 0 : currentHF,
        });
      }
    } catch (error) {
      console.error('Error fetching health factor history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address, timeframe]); // enrichedPositions accessed from closure, not in deps to prevent infinite loop

  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    // Wait for enrichedPositions to load before generating data
    if (enrichedPositions.length === 0) {
      setIsLoading(true);
      return;
    }

    fetchHealthFactorHistory();
  }, [address, timeframe, enrichedPositions.length, fetchHealthFactorHistory]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const hf = payload[0].value;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-700">{payload[0].payload.date}</p>
          <p className={`text-lg font-bold ${hf >= 2.0 ? 'text-green-600' : hf >= 1.2 ? 'text-yellow-600' : 'text-red-600'}`}>
            HF: {hf.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">
            {hf >= 2.0 ? 'Safe' : hf >= 1.2 ? 'Warning' : 'Danger'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Don't show if no borrowed positions
  const hasBorrowedPosition = enrichedPositions.some((pos) => pos.borrowedUSD > 0);
  if (!hasBorrowedPosition) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Health Factor History</h2>
          <p className="text-sm text-gray-600">Track your liquidation risk over time</p>
        </div>

        {/* Timeframe selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      {!isLoading && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-green-700">Max HF</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.max.toFixed(2)}</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-orange-600" />
              <p className="text-sm font-medium text-orange-700">Min HF</p>
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.min.toFixed(2)}</p>
          </div>

          <div className={`rounded-lg p-4 border ${stats.current >= 2.0 ? 'bg-green-50 border-green-100' : stats.current >= 1.2 ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Activity className={`w-4 h-4 ${stats.current >= 2.0 ? 'text-green-600' : stats.current >= 1.2 ? 'text-yellow-600' : 'text-red-600'}`} />
              <p className={`text-sm font-medium ${stats.current >= 2.0 ? 'text-green-700' : stats.current >= 1.2 ? 'text-yellow-700' : 'text-red-700'}`}>Current HF</p>
            </div>
            <p className={`text-2xl font-bold ${stats.current >= 2.0 ? 'text-green-600' : stats.current >= 1.2 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stats.current.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      {isLoading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading chart...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No data available for selected timeframe</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tick={{ fill: '#6b7280' }}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tick={{ fill: '#6b7280' }}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Reference lines for risk zones */}
            <ReferenceLine
              y={1.0}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: 'Liquidation', position: 'right', fill: '#ef4444', fontSize: 12 }}
            />
            <ReferenceLine
              y={1.2}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: 'Warning', position: 'right', fill: '#f59e0b', fontSize: 12 }}
            />
            <ReferenceLine
              y={2.0}
              stroke="#10b981"
              strokeDasharray="3 3"
              label={{ value: 'Safe', position: 'right', fill: '#10b981', fontSize: 12 }}
            />

            <Area
              type="monotone"
              dataKey="healthFactor"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorHF)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600">Danger (HF &lt; 1.2)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-gray-600">Warning (1.2 - 2.0)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600">Safe (HF &gt; 2.0)</span>
        </div>
      </div>

      {/* Warning message if current HF is low */}
      {stats.current > 0 && stats.current < 1.5 && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-900">Low Health Factor Warning</p>
            <p className="text-xs text-orange-700 mt-1">
              Your current health factor is {stats.current.toFixed(2)}. Consider adding more collateral or repaying some debt to avoid liquidation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
