/**
 * Protocol constants
 */

// Protocol parameters (match contract values)
export const PROTOCOL_PARAMS = {
  LTV: 7500, // 75% in basis points
  LIQUIDATION_THRESHOLD: 8000, // 80% in basis points
  LIQUIDATION_PENALTY: 500, // 5% in basis points
  RESERVE_FACTOR: 1000, // 10% in basis points
  WAD: BigInt(1e18), // Fixed-point precision
} as const;

// Chain configurations
export const CHAIN_CONFIG = {
  84532: {
    name: 'Base Sepolia',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://sepolia.basescan.org',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
  },
  8453: {
    name: 'Base',
    nativeCurrency: 'ETH',
    blockExplorer: 'https://basescan.org',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_MAINNET_RPC || 'https://mainnet.base.org',
  },
} as const;

// Token metadata
export const TOKEN_METADATA: Record<string, { symbol: string; decimals: number; icon?: string }> = {
  WETH: { symbol: 'WETH', decimals: 18, icon: '/tokens/weth.svg' },
  USDC: { symbol: 'USDC', decimals: 6, icon: '/tokens/usdc.svg' },
  WBTC: { symbol: 'WBTC', decimals: 8, icon: '/tokens/wbtc.svg' },
  DAI: { symbol: 'DAI', decimals: 18, icon: '/tokens/dai.svg' },
};

// UI constants
export const UI_CONFIG = {
  DEFAULT_SLIPPAGE: 0.5, // 0.5%
  MAX_SLIPPAGE: 5, // 5%
  DEBOUNCE_DELAY: 500, // ms
  REFRESH_INTERVAL: 12000, // 12 seconds (Base block time)
  TRANSACTION_DEADLINE: 1200, // 20 minutes in seconds
} as const;

// Health factor thresholds
export const HEALTH_FACTOR_THRESHOLDS = {
  SAFE: 1.5,
  MODERATE: 1.2,
  AT_RISK: 1.0,
} as const;

// Gas limits (estimated with safety margin)
export const GAS_LIMITS = {
  DEPOSIT: 200000n,
  WITHDRAW: 200000n,
  BORROW: 250000n,
  REPAY: 200000n,
  DEPOSIT_COLLATERAL: 150000n,  // Increased from 100000n (actual need: ~120k)
  WITHDRAW_COLLATERAL: 150000n,  // Increased from 100000n for safety
  LIQUIDATE: 350000n,
} as const;
