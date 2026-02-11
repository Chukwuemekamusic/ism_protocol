/**
 * Contract ABIs for the Isolated Lending Markets Protocol.
 *
 * Using ethers v6 human-readable ABI format for clarity.
 * These match the contracts deployed in ism_protocol/.
 *
 * To regenerate from Foundry artifacts, run: npm run extract-abis
 */

// ============================================
// LENDING POOL
// ============================================

export const LENDING_POOL_ABI = [
  // --- Read Functions ---
  "function collateralToken() view returns (address)",
  "function borrowToken() view returns (address)",
  "function collateralDecimals() view returns (uint8)",
  "function borrowDecimals() view returns (uint8)",
  "function ltv() view returns (uint64)",
  "function liquidationThreshold() view returns (uint64)",
  "function liquidationPenalty() view returns (uint64)",
  "function reserveFactor() view returns (uint64)",
  "function borrowIndex() view returns (uint256)",
  "function totalSupplyAssets() view returns (uint256)",
  "function totalBorrowAssets() view returns (uint256)",
  "function totalCollateral() view returns (uint256)",
  "function poolToken() view returns (address)",
  "function positions(address user) view returns (uint256 collateralAmount, uint256 borrowShares)",
  "function healthFactor(address user) view returns (uint256)",
  "function isLiquidatable(address user) view returns (bool)",
  "function accrueInterest() external",

  // --- Write Functions ---
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function depositCollateral(uint256 amount) external",
  "function withdrawCollateral(uint256 amount) external",
  "function borrow(uint256 amount) external",
  "function repay(uint256 amount) external",

  // --- Events ---
  "event Deposited(address indexed user, uint256 amount, uint256 shares)",
  "event Withdrawn(address indexed user, uint256 amount, uint256 shares)",
  "event CollateralDeposited(address indexed user, uint256 amount)",
  "event CollateralWithdrawn(address indexed user, uint256 amount)",
  "event Borrowed(address indexed user, uint256 borrowShares, uint256 borrowAmount)",
  "event Repaid(address indexed user, uint256 repaidShares, uint256 repaidAmount)",
  "event InterestAccrued(uint256 newBorrowIndex, uint256 interestAccrued, uint256 reserveAmount)",
] as const;

// ============================================
// DUTCH AUCTION LIQUIDATOR
// ============================================

export const LIQUIDATOR_ABI = [
  // --- Read Functions ---
  "function nextAuctionId() view returns (uint256)",
  "function getAuction(uint256 auctionId) view returns (tuple(address user, address pool, uint128 debtToRepay, uint128 collateralForSale, uint64 startTime, uint64 endTime, uint256 startPrice, uint256 endPrice, bool isActive))",
  "function getCurrentPrice(uint256 auctionId) view returns (uint256 price)",
  "function hasActiveAuction(address pool, address user) view returns (bool hasAuction, uint256 auctionId)",
  "function auctionConfig() view returns (uint64 duration, uint64 startPremium, uint64 endDiscount, uint64 closeFactor)",

  // --- Write Functions ---
  "function startAuction(address pool, address user) external returns (uint256 auctionId)",
  "function liquidate(uint256 auctionId, uint256 maxDebtToRepay) external returns (uint256 debtRepaid, uint256 collateralReceived)",
  "function cancelExpiredAuction(uint256 auctionId) external",

  // --- Events ---
  "event AuctionStarted(uint256 indexed auctionId, address indexed user, address indexed pool, uint256 debtToRepay, uint256 collateralForSale, uint256 startPrice, uint256 endPrice)",
  "event LiquidationExecuted(uint256 indexed auctionId, address indexed liquidator, uint256 debtRepaid, uint256 collateralReceived, uint256 executionPrice)",
  "event AuctionCancelled(uint256 indexed auctionId, string reason)",
] as const;

// ============================================
// ORACLE ROUTER
// ============================================

export const ORACLE_ROUTER_ABI = [
  // --- Read Functions ---
  "function getPrice(address token) view returns (uint256 price)",
  "function isConfigured(address token) view returns (bool)",

  // --- Events ---
  "event UsingTWAPFallback(address indexed token, uint256 twapPrice)",
] as const;

// ============================================
// MARKET REGISTRY
// ============================================

export const MARKET_REGISTRY_ABI = [
  // --- Read Functions ---
  "function getAllMarkets() view returns (address[])",
  "function getMarketCount() view returns (uint256)",
  "function isRegistered(address pool) view returns (bool)",
  "function getMarketsByCollateral(address collateralToken) view returns (address[])",
  "function getMarketsByBorrowToken(address borrowToken) view returns (address[])",

  // --- Events ---
  "event MarketRegistered(address indexed pool, address indexed collateralToken, address indexed borrowToken)",
  "event MarketDeactivated(address indexed pool)",
] as const;

// ============================================
// ERC20 (for token approvals and balance checks)
// ============================================

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
] as const;
