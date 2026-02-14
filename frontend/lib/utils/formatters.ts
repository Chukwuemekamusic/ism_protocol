/**
 * Formatting utilities for numbers, currencies, and dates
 */

import { formatUnits, parseUnits } from 'viem';
import { formatDistanceToNow } from 'date-fns';

/**
 * Format a token amount with proper decimals
 */
export function formatTokenAmount(
  amount: bigint | string | number,
  decimals: number = 18,
  displayDecimals: number = 4
): string {
  try {
    const value = typeof amount === 'bigint' ? amount : BigInt(amount);
    const formatted = formatUnits(value, decimals);
    const num = parseFloat(formatted);

    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';

    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: displayDecimals,
    });
  } catch {
    return '0';
  }
}

/**
 * Format a USD value
 */
export function formatUSD(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (num === 0) return '$0.00';
  if (num < 0.01) return '< $0.01';
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }

  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a percentage value
 */
export function formatPercent(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '0%';

  return `${num.toFixed(decimals)}%`;
}

/**
 * Format an APY value
 */
export function formatAPY(apy: number): string {
  if (apy === 0) return '0.00%';
  if (apy < 0.01) return '< 0.01%';

  return `${apy.toFixed(2)}%`;
}

/**
 * Format a timestamp to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  try {
    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

/**
 * Format a date
 */
export function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

/**
 * Format an address (truncated)
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;

  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a hash (transaction or block)
 */
export function formatHash(hash: string): string {
  return formatAddress(hash, 6);
}

/**
 * Parse user input to wei
 */
export function parseTokenInput(input: string, decimals: number = 18): bigint {
  try {
    if (!input || input === '') return 0n;
    return parseUnits(input, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Format a large number with K/M/B suffix
 */
export function formatCompactNumber(num: number): string {
  if (num === 0) return '0';
  if (num < 1_000) return num.toFixed(2);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}
