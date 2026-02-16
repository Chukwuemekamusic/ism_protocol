'use client';

import { getHealthStatus } from '@/lib/utils/calculations';

interface HealthFactorDisplayProps {
  healthFactor: number;
  afterHealthFactor?: number; // For action previews
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
}

export default function HealthFactorDisplay({
  healthFactor,
  afterHealthFactor,
  size = 'md',
  showBar = true,
}: HealthFactorDisplayProps) {
  const currentStatus = getHealthStatus(healthFactor);
  const afterStatus = afterHealthFactor ? getHealthStatus(afterHealthFactor) : null;

  // Calculate percentage for progress bar (cap at 3.0 for display purposes)
  const percentage = Math.min((healthFactor / 3.0) * 100, 100);
  const afterPercentage = afterHealthFactor
    ? Math.min((afterHealthFactor / 3.0) * 100, 100)
    : null;

  // Size-based styling
  const sizeClasses = {
    sm: {
      text: 'text-xs',
      badge: 'px-2 py-0.5 text-xs',
      bar: 'h-1.5',
      value: 'text-sm',
    },
    md: {
      text: 'text-sm',
      badge: 'px-2 py-1 text-xs',
      bar: 'h-2',
      value: 'text-base',
    },
    lg: {
      text: 'text-base',
      badge: 'px-3 py-1.5 text-sm',
      bar: 'h-3',
      value: 'text-lg',
    },
  };

  const classes = sizeClasses[size];

  // Color mapping for Tailwind classes
  const getColorClasses = (status: ReturnType<typeof getHealthStatus>) => {
    switch (status.color) {
      case 'green':
        return {
          badge: 'bg-green-100 text-green-800',
          bar: 'bg-green-500',
          text: 'text-green-700',
        };
      case 'yellow':
        return {
          badge: 'bg-yellow-100 text-yellow-800',
          bar: 'bg-yellow-500',
          text: 'text-yellow-700',
        };
      case 'orange':
        return {
          badge: 'bg-orange-100 text-orange-800',
          bar: 'bg-orange-500',
          text: 'text-orange-700',
        };
      case 'red':
        return {
          badge: 'bg-red-100 text-red-800',
          bar: 'bg-red-500',
          text: 'text-red-700',
        };
      default:
        return {
          badge: 'bg-gray-100 text-gray-800',
          bar: 'bg-gray-500',
          text: 'text-gray-700',
        };
    }
  };

  const currentColors = getColorClasses(currentStatus);

  // Get emoji based on status
  const getStatusEmoji = (status: ReturnType<typeof getHealthStatus>) => {
    switch (status.status) {
      case 'safe':
        return '🟢';
      case 'moderate':
        return '🟡';
      case 'at-risk':
        return '🟠';
      case 'liquidatable':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const displayValue = healthFactor === Infinity ? '∞' : healthFactor.toFixed(2);

  return (
    <div className="space-y-2">
      {/* Header with value and status */}
      <div className="flex justify-between items-center">
        <span className={`font-medium ${classes.text}`}>
          Health Factor:{' '}
          <span className={`${classes.value} ${currentColors.text}`}>{displayValue}</span>
        </span>
        <span className={`rounded ${classes.badge} ${currentColors.badge}`}>
          {getStatusEmoji(currentStatus)} {currentStatus.label}
        </span>
      </div>

      {/* Progress bar */}
      {showBar && healthFactor !== Infinity && (
        <div className="w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`${classes.bar} ${currentColors.bar} rounded-full transition-all duration-300 ease-in-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {/* After action preview */}
      {afterHealthFactor !== undefined && afterHealthFactor !== healthFactor && afterStatus && (
        <div className={`${classes.text} text-gray-600 flex items-center gap-2`}>
          <span>After action:</span>
          <span className={getColorClasses(afterStatus).text + ' font-medium'}>
            {afterHealthFactor === Infinity ? '∞' : afterHealthFactor.toFixed(2)}
          </span>
          <span className="text-xs">{getStatusEmoji(afterStatus)}</span>
          {/* Show arrow indicating direction */}
          {afterHealthFactor > healthFactor ? (
            <span className="text-green-600">↑</span>
          ) : (
            <span className="text-red-600">↓</span>
          )}
        </div>
      )}

      {/* Warning for low health factor */}
      {healthFactor < 1.2 && healthFactor >= 1.0 && (
        <div className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
          ⚠️ Your position is at risk. Consider adding more collateral or repaying debt.
        </div>
      )}

      {healthFactor < 1.0 && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          🚨 Your position is liquidatable! Add collateral or repay debt immediately.
        </div>
      )}
    </div>
  );
}

/**
 * Compact health factor badge (for use in tables/cards)
 */
export function HealthFactorBadge({ healthFactor }: { healthFactor: number }) {
  const status = getHealthStatus(healthFactor);

  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  };

  const emoji = {
    safe: '🟢',
    moderate: '🟡',
    'at-risk': '🟠',
    liquidatable: '🔴',
  };

  const displayValue = healthFactor === Infinity ? '∞' : healthFactor.toFixed(2);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
        colorClasses[status.color as keyof typeof colorClasses]
      }`}
    >
      <span>{emoji[status.status]}</span>
      <span>HF: {displayValue}</span>
    </span>
  );
}
