/**
 * Error message parsing utility for better user-facing error messages
 * Maps contract errors to human-readable messages
 */

export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  // ===== Validation Errors =====
  ZeroAmount: 'Amount cannot be zero. Please enter a valid amount.',
  ZeroAddress: 'Invalid address provided.',
  EmptyString: 'Required field cannot be empty.',
  SameToken: 'Tokens must be different.',
  InvalidToken: 'Invalid token address.',

  // ===== Balance & Liquidity Errors =====
  InsufficientBalance: "You don't have enough balance for this transaction.",
  InsufficientCollateral: "You don't have enough collateral deposited.",
  InsufficientLiquidity:
    'Not enough liquidity in the pool. Try a smaller amount or wait for more suppliers.',
  InsufficientLocked: 'Insufficient locked collateral.',

  // ===== Health Factor Errors =====
  WouldBeUndercollateralized:
    'This action would make your position unhealthy. You need more collateral or less debt to maintain a safe health factor above 1.0.',

  // ===== Debt Errors =====
  NoDebt: "You don't have any debt to repay.",

  // ===== Oracle Errors =====
  BothOraclesFailed:
    'Price oracle temporarily unavailable. Please refresh and try again in a moment.',
  OracleNotConfigured: 'Price feed not configured for this asset.',
  StalePrice: 'Price data is outdated. Please refresh and try again.',
  InvalidPrice: 'Invalid price data received. Please try again.',
  SequencerDown:
    'Layer 2 sequencer is down. Transactions are temporarily unavailable.',
  PriceDeviationTooHigh:
    'Price sources disagree significantly. Please try again later for safety.',

  // ===== Permission Errors =====
  OnlyLiquidator: 'This function can only be called by the liquidator contract.',
  OnlyFactory: 'This function can only be called by the factory contract.',
  NotAuthorized: 'You are not authorized to perform this action.',

  // ===== Initialization Errors =====
  AlreadyInitialized: 'This contract has already been initialized.',
  InvalidCollateralToken: 'Invalid collateral token address.',
  InvalidBorrowToken: 'Invalid borrow token address.',
  InvalidParameters: 'Invalid parameters provided.',

  // ===== Liquidation Errors =====
  PositionNotLiquidatable:
    'This position is healthy and cannot be liquidated. Health factor must be below 1.0.',
  AuctionNotActive: 'No active auction found for this position.',
  AuctionAlreadyExists:
    'An auction is already running for this position. Please wait for it to complete.',
  AuctionExpired: 'This auction has expired.',
  AuctionNotExpired: 'Auction has not expired yet.',
  InsufficientRepayment: 'Insufficient debt repayment amount.',
  InvalidAuctionConfig: 'Invalid auction configuration.',
  PoolNotAuthorized: 'Pool is not authorized for liquidations.',
  InvalidAuctionConfigDuration: 'Invalid auction duration.',
  InvalidAuctionConfigStartPremium: 'Invalid auction start premium.',
  InvalidAuctionConfigEndDiscount: 'Invalid auction end discount.',
  InvalidAuctionConfigCloseFactor: 'Invalid auction close factor.',

  // ===== Market Registry Errors =====
  MarketAlreadyExists: 'A market already exists for this token pair.',
  MarketAlreadyRegistered: 'This market is already registered.',
  MarketNotFound: 'Market not found.',

  // ===== Default =====
  default: 'Transaction failed. Please try again or contact support if the issue persists.',
};

/**
 * Parse a contract error and return a user-friendly message
 * @param error - The error object from wagmi/viem
 * @returns User-friendly error message
 */
export function parseContractError(error: Error | null | undefined): string {
  if (!error) return CONTRACT_ERROR_MESSAGES.default;

  const errorMessage = error.message || '';

  // Try to extract custom error name from the error message
  // Viem errors typically include the error name in the message
  for (const [errorName, message] of Object.entries(CONTRACT_ERROR_MESSAGES)) {
    if (errorName === 'default') continue;

    // Check if error message contains the error name
    if (errorMessage.includes(errorName)) {
      return message;
    }

    // Also check for common patterns like "Error: ZeroAmount()"
    if (errorMessage.match(new RegExp(`${errorName}\\(`, 'i'))) {
      return message;
    }
  }

  // Check for common Web3/wallet errors
  if (errorMessage.toLowerCase().includes('user rejected')) {
    return 'Transaction was cancelled by user.';
  }

  if (errorMessage.toLowerCase().includes('insufficient funds for gas')) {
    return 'Insufficient ETH for gas fees. Please add ETH to your wallet.';
  }

  if (errorMessage.toLowerCase().includes('insufficient funds')) {
    return 'Insufficient funds for this transaction.';
  }

  if (errorMessage.toLowerCase().includes('nonce too low')) {
    return 'Transaction nonce error. Please try refreshing the page.';
  }

  if (errorMessage.toLowerCase().includes('transaction underpriced')) {
    return 'Gas price too low. Please try again with higher gas.';
  }

  if (errorMessage.toLowerCase().includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Return shortened error message if available
  if (errorMessage.length > 0) {
    // Try to extract the most relevant part
    const shortMessage = errorMessage.split('\n')[0].slice(0, 200);
    return shortMessage || CONTRACT_ERROR_MESSAGES.default;
  }

  return CONTRACT_ERROR_MESSAGES.default;
}

/**
 * Get a short error title for UI display
 * @param error - The error object
 * @returns Short error title
 */
export function getErrorTitle(error: Error | null | undefined): string {
  if (!error) return 'Transaction Failed';

  const errorMessage = error.message || '';

  // Map common errors to titles
  if (errorMessage.includes('WouldBeUndercollateralized')) {
    return 'Insufficient Collateral';
  }
  if (errorMessage.includes('InsufficientLiquidity')) {
    return 'Insufficient Pool Liquidity';
  }
  if (errorMessage.includes('InsufficientBalance')) {
    return 'Insufficient Balance';
  }
  if (errorMessage.includes('NoDebt')) {
    return 'No Debt to Repay';
  }
  if (errorMessage.includes('Oracle') || errorMessage.includes('Price')) {
    return 'Price Oracle Error';
  }
  if (errorMessage.toLowerCase().includes('user rejected')) {
    return 'Transaction Cancelled';
  }

  return 'Transaction Failed';
}

/**
 * Check if an error is critical (requires user attention)
 * @param error - The error object
 * @returns true if error is critical
 */
export function isCriticalError(error: Error | null | undefined): boolean {
  if (!error) return false;

  const errorMessage = error.message || '';

  // Critical errors that require user action or awareness
  const criticalErrors = [
    'WouldBeUndercollateralized',
    'InsufficientCollateral',
    'InsufficientBalance',
    'InsufficientLiquidity',
    'SequencerDown',
    'BothOraclesFailed',
  ];

  return criticalErrors.some((critical) => errorMessage.includes(critical));
}
