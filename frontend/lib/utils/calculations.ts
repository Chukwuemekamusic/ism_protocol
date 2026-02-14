/**
 * Financial calculations for lending protocol
 */

const WAD = 1e18; // Fixed-point precision (same as contracts)
const SECONDS_PER_YEAR = 31536000; // 365 days

/**
 * Calculate APY from per-second rate
 * Formula: APY = (1 + ratePerSecond)^31536000 - 1
 */
export function calculateAPY(ratePerSecond: bigint): number {
  if (ratePerSecond === 0n) return 0;

  const rate = Number(ratePerSecond) / WAD;
  const apy = (Math.pow(1 + rate, SECONDS_PER_YEAR) - 1) * 100;

  return parseFloat(apy.toFixed(2));
}

/**
 * Calculate utilization rate
 * Formula: utilization = totalBorrow / (totalSupply + totalBorrow)
 */
export function calculateUtilization(
  totalBorrow: bigint,
  totalSupply: bigint
): number {
  if (totalSupply === 0n && totalBorrow === 0n) return 0;

  const totalAssets = totalSupply + totalBorrow;
  if (totalAssets === 0n) return 0;

  const utilization = (Number(totalBorrow) / Number(totalAssets)) * 100;
  return parseFloat(utilization.toFixed(2));
}

/**
 * Calculate health factor
 * Formula: HF = (collateralValue * liquidationThreshold) / debtValue
 * HF > 1.0 = Safe
 * HF < 1.0 = Liquidatable
 */
export function calculateHealthFactor(
  collateralValue: bigint,
  debtValue: bigint,
  liquidationThreshold: number // In basis points (e.g., 8000 = 80%)
): number {
  if (debtValue === 0n) return Infinity; // No debt = perfect health
  if (collateralValue === 0n) return 0; // No collateral = 0 health

  const adjustedCollateral = (Number(collateralValue) * liquidationThreshold) / 10000;
  const healthFactor = adjustedCollateral / Number(debtValue);

  return parseFloat(healthFactor.toFixed(4));
}

/**
 * Calculate max borrow amount based on collateral
 * Formula: maxBorrow = (collateralValue * LTV) / 10000
 */
export function calculateMaxBorrow(
  collateralValue: bigint,
  ltv: number // In basis points (e.g., 7500 = 75%)
): bigint {
  if (collateralValue === 0n) return 0n;

  const maxBorrow = (collateralValue * BigInt(ltv)) / 10000n;
  return maxBorrow;
}

/**
 * Calculate borrow limit usage percentage
 */
export function calculateBorrowLimitUsage(
  currentDebt: bigint,
  maxBorrow: bigint
): number {
  if (maxBorrow === 0n) return 0;

  const usage = (Number(currentDebt) / Number(maxBorrow)) * 100;
  return Math.min(usage, 100); // Cap at 100%
}

/**
 * Calculate liquidation price for a position
 * Price at which position becomes liquidatable
 */
export function calculateLiquidationPrice(
  collateralAmount: bigint,
  debtAmount: bigint,
  liquidationThreshold: number // In basis points
): number {
  if (collateralAmount === 0n) return 0;

  const liquidationValue = (Number(debtAmount) * 10000) / liquidationThreshold;
  const liquidationPrice = liquidationValue / Number(collateralAmount);

  return parseFloat(liquidationPrice.toFixed(2));
}

/**
 * Calculate interest accrued over time
 * Formula: interest = principal * (1 + rate)^time - principal
 */
export function calculateAccruedInterest(
  principal: bigint,
  ratePerSecond: bigint,
  seconds: number
): bigint {
  if (principal === 0n || ratePerSecond === 0n) return 0n;

  const rate = Number(ratePerSecond) / WAD;
  const interestFactor = Math.pow(1 + rate, seconds);
  const finalAmount = Number(principal) * interestFactor;
  const interest = finalAmount - Number(principal);

  return BigInt(Math.floor(interest));
}

/**
 * Convert shares to underlying assets
 * Formula: assets = shares * (totalAssets / totalShares)
 */
export function convertSharesToAssets(
  shares: bigint,
  totalShares: bigint,
  totalAssets: bigint
): bigint {
  if (totalShares === 0n) return 0n;

  return (shares * totalAssets) / totalShares;
}

/**
 * Convert assets to shares
 * Formula: shares = assets * (totalShares / totalAssets)
 */
export function convertAssetsToShares(
  assets: bigint,
  totalShares: bigint,
  totalAssets: bigint
): bigint {
  if (totalAssets === 0n) return assets; // 1:1 if pool is empty

  return (assets * totalShares) / totalAssets;
}

/**
 * Calculate collateral value in borrow token terms
 */
export function calculateCollateralValueInBorrowToken(
  collateralAmount: bigint,
  collateralPrice: bigint,
  borrowPrice: bigint,
  collateralDecimals: number,
  borrowDecimals: number
): bigint {
  if (collateralAmount === 0n || borrowPrice === 0n) return 0n;

  // Value in USD: collateralAmount * collateralPrice (normalized to 18 decimals)
  const collateralValueUSD = (collateralAmount * collateralPrice) / BigInt(10 ** collateralDecimals);

  // Convert to borrow token amount: (valueUSD / borrowPrice) * borrowDecimals
  const borrowTokenAmount = (collateralValueUSD * BigInt(10 ** borrowDecimals)) / borrowPrice;

  return borrowTokenAmount;
}

/**
 * Get health status from health factor
 */
export function getHealthStatus(healthFactor: number): {
  status: 'safe' | 'moderate' | 'at-risk' | 'liquidatable';
  color: string;
  label: string;
} {
  if (healthFactor >= 1.5) {
    return { status: 'safe', color: 'green', label: 'Safe' };
  } else if (healthFactor >= 1.2) {
    return { status: 'moderate', color: 'yellow', label: 'Moderate' };
  } else if (healthFactor >= 1.0) {
    return { status: 'at-risk', color: 'orange', label: 'At Risk' };
  } else {
    return { status: 'liquidatable', color: 'red', label: 'Liquidatable' };
  }
}
