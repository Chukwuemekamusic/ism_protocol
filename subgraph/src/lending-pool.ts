import {
  Deposit,
  Withdraw,
  Borrow,
  Repay,
  DepositCollateral,
  WithdrawCollateral,
  InterestAccrued,
} from '../generated/templates/LendingPool/LendingPool';
import {
  Market,
  Position,
  User,
  Transaction,
  MarketSnapshot,
  Protocol,
  Token,
} from '../generated/schema';
import { LendingPool as LendingPoolContract } from '../generated/templates/LendingPool/LendingPool';
import { OracleRouter as OracleRouterContract } from '../generated/templates/LendingPool/OracleRouter';
import { BigInt, BigDecimal, Address, Bytes, store } from '@graphprotocol/graph-ts';

const WAD = BigInt.fromI32(10).pow(18);
const SECONDS_PER_DAY = BigInt.fromI32(86400);
const ORACLE_ROUTER_ADDRESS = Address.fromString('0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97');

/**
 * Calculate USD value for a token amount using OracleRouter
 * @param tokenAddress - Address of the token
 * @param amount - Raw token amount (in token's native decimals)
 * @param decimals - Token decimals
 * @returns USD value as BigDecimal
 */
function calculateUSDValue(tokenAddress: Address, amount: BigInt, decimals: i32): BigDecimal {
  if (amount.equals(BigInt.fromI32(0))) {
    return BigDecimal.fromString('0');
  }

  // Bind to OracleRouter contract
  const oracleRouter = OracleRouterContract.bind(ORACLE_ROUTER_ADDRESS);

  // Get token price in USD (returns price in 1e18 format)
  const priceResult = oracleRouter.try_getPrice(tokenAddress);

  if (priceResult.reverted) {
    // Oracle call failed, return 0
    return BigDecimal.fromString('0');
  }

  const priceIn1e18 = priceResult.value;

  // Convert amount from token decimals to standard decimal
  const tokenDecimalsDivisor = BigInt.fromI32(10).pow(u8(decimals));
  const amountInStandardDecimals = amount.toBigDecimal().div(tokenDecimalsDivisor.toBigDecimal());

  // Convert price from 1e18 to standard decimal
  const priceInUSD = priceIn1e18.toBigDecimal().div(WAD.toBigDecimal());

  // Calculate USD value: amount * price
  return amountInStandardDecimals.times(priceInUSD);
}

export function handleDeposit(event: Deposit): void {
  const poolAddress = event.address;
  const user = event.params.user;
  const assets = event.params.assets;
  const shares = event.params.shares;

  // Update market
  updateMarket(poolAddress, event.block.timestamp);

  // Update position
  updatePosition(poolAddress, user, event.block.timestamp);

  // Create transaction
  createTransaction(
    event.transaction.hash,
    event.logIndex,
    'DEPOSIT',
    poolAddress,
    user,
    assets,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );

  // Update daily snapshot
  updateDailySnapshot(poolAddress, event.block.timestamp, 'deposit', assets);
}

export function handleWithdraw(event: Withdraw): void {
  const poolAddress = event.address;
  const user = event.params.user;
  const assets = event.params.assets;
  const shares = event.params.shares;

  // Update market
  updateMarket(poolAddress, event.block.timestamp);

  // Update position
  updatePosition(poolAddress, user, event.block.timestamp);

  // Create transaction
  createTransaction(
    event.transaction.hash,
    event.logIndex,
    'WITHDRAW',
    poolAddress,
    user,
    assets,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );

  // Update daily snapshot
  updateDailySnapshot(poolAddress, event.block.timestamp, 'withdraw', assets);
}

export function handleBorrow(event: Borrow): void {
  const poolAddress = event.address;
  const user = event.params.user;
  const assets = event.params.assets;

  // Update market
  updateMarket(poolAddress, event.block.timestamp);

  // Update position
  updatePosition(poolAddress, user, event.block.timestamp);

  // Create transaction
  createTransaction(
    event.transaction.hash,
    event.logIndex,
    'BORROW',
    poolAddress,
    user,
    assets,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );

  // Update daily snapshot
  updateDailySnapshot(poolAddress, event.block.timestamp, 'borrow', assets);
}

export function handleRepay(event: Repay): void {
  const poolAddress = event.address;
  const user = event.params.user;
  const assets = event.params.assets;

  // Update market
  updateMarket(poolAddress, event.block.timestamp);

  // Update position
  updatePosition(poolAddress, user, event.block.timestamp);

  // Create transaction
  createTransaction(
    event.transaction.hash,
    event.logIndex,
    'REPAY',
    poolAddress,
    user,
    assets,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );

  // Update daily snapshot
  updateDailySnapshot(poolAddress, event.block.timestamp, 'repay', assets);
}

export function handleDepositCollateral(event: DepositCollateral): void {
  const poolAddress = event.address;
  const user = event.params.user;
  const amount = event.params.amount;

  // Update market
  updateMarket(poolAddress, event.block.timestamp);

  // Update position
  updatePosition(poolAddress, user, event.block.timestamp);

  // Create transaction
  createTransaction(
    event.transaction.hash,
    event.logIndex,
    'DEPOSIT_COLLATERAL',
    poolAddress,
    user,
    amount,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );
}

export function handleWithdrawCollateral(event: WithdrawCollateral): void {
  const poolAddress = event.address;
  const user = event.params.user;
  const amount = event.params.amount;

  // Update market
  updateMarket(poolAddress, event.block.timestamp);

  // Update position
  updatePosition(poolAddress, user, event.block.timestamp);

  // Create transaction
  createTransaction(
    event.transaction.hash,
    event.logIndex,
    'WITHDRAW_COLLATERAL',
    poolAddress,
    user,
    amount,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );
}

export function handleInterestAccrued(event: InterestAccrued): void {
  const poolAddress = event.address;
  const newBorrowIndex = event.params.newBorrowIndex;
  const totalBorrows = event.params.totalBorrows;

  // Update market with interest data
  const market = Market.load(poolAddress.toHexString());
  if (market != null) {
    market.borrowIndex = newBorrowIndex;
    market.totalBorrowAssets = totalBorrows;
    market.lastAccrualTime = event.block.timestamp;
    market.lastUpdate = event.block.timestamp;
    market.save();
  }
}

function updateMarket(poolAddress: Address, timestamp: BigInt): void {
  const market = Market.load(poolAddress.toHexString());
  if (market == null) {
    return;
  }

  const poolContract = LendingPoolContract.bind(poolAddress);

  // Store previous values for delta calculation
  const previousSupply = market.totalSupplyAssets;
  const previousBorrow = market.totalBorrowAssets;
  const previousSupplyUSD = market.totalSupplyUSD;
  const previousBorrowUSD = market.totalBorrowUSD;

  // Update balances
  const totalSupply = poolContract.try_totalSupplyAssets();
  const totalBorrow = poolContract.try_totalBorrowAssets();
  const totalCollateral = poolContract.try_totalCollateral();

  if (!totalSupply.reverted) {
    market.totalSupplyAssets = totalSupply.value;
  }
  if (!totalBorrow.reverted) {
    market.totalBorrowAssets = totalBorrow.value;
  }
  if (!totalCollateral.reverted) {
    market.totalCollateral = totalCollateral.value;
  }

  // Calculate utilization rate
  if (market.totalSupplyAssets.gt(BigInt.fromI32(0))) {
    const utilizationBigInt = market.totalBorrowAssets
      .times(WAD)
      .div(market.totalSupplyAssets.plus(market.totalBorrowAssets));
    market.utilizationRate = utilizationBigInt.toBigDecimal().div(WAD.toBigDecimal());
  } else {
    market.utilizationRate = BigInt.fromI32(0).toBigDecimal();
  }

  // Calculate USD values using OracleRouter
  // Load token entities to get addresses and decimals
  const collateralToken = Token.load(market.collateralToken);
  const borrowToken = Token.load(market.borrowToken);

  if (collateralToken != null && borrowToken != null) {
    const collateralTokenAddress = Address.fromString(collateralToken.id);
    const borrowTokenAddress = Address.fromString(borrowToken.id);

    // Supply is denominated in borrow token
    market.totalSupplyUSD = calculateUSDValue(
      borrowTokenAddress,
      market.totalSupplyAssets,
      borrowToken.decimals
    );

    // Borrow is denominated in borrow token
    market.totalBorrowUSD = calculateUSDValue(
      borrowTokenAddress,
      market.totalBorrowAssets,
      borrowToken.decimals
    );

    // Collateral is denominated in collateral token
    market.totalCollateralUSD = calculateUSDValue(
      collateralTokenAddress,
      market.totalCollateral,
      collateralToken.decimals
    );
  } else {
    // Fallback to 0 if tokens not found
    market.totalSupplyUSD = BigDecimal.fromString('0');
    market.totalBorrowUSD = BigDecimal.fromString('0');
    market.totalCollateralUSD = BigDecimal.fromString('0');
  }

  // Note: borrowRate and supplyRate would need to be calculated from InterestRateModel
  // For now, they're updated via InterestAccrued event

  market.lastUpdate = timestamp;
  market.save();

  // Update protocol-level aggregates with deltas
  updateProtocolAggregates(
    timestamp,
    market.totalSupplyUSD,
    previousSupplyUSD,
    market.totalBorrowUSD,
    previousBorrowUSD
  );
}

function updateProtocolAggregates(
  timestamp: BigInt,
  newSupplyUSD: BigDecimal,
  prevSupplyUSD: BigDecimal,
  newBorrowUSD: BigDecimal,
  prevBorrowUSD: BigDecimal
): void {
  let protocol = Protocol.load('protocol');
  if (protocol == null) {
    protocol = new Protocol('protocol');
    protocol.totalMarkets = BigInt.fromI32(0);
    protocol.totalValueLockedUSD = BigInt.fromI32(0).toBigDecimal();
    protocol.totalBorrowedUSD = BigInt.fromI32(0).toBigDecimal();
    protocol.totalLiquidationsUSD = BigInt.fromI32(0).toBigDecimal();
  }

  // Update aggregates using delta approach
  const supplyDelta = newSupplyUSD.minus(prevSupplyUSD);
  const borrowDelta = newBorrowUSD.minus(prevBorrowUSD);

  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(supplyDelta);
  protocol.totalBorrowedUSD = protocol.totalBorrowedUSD.plus(borrowDelta);
  protocol.lastUpdate = timestamp;

  protocol.save();
}

function updatePosition(poolAddress: Address, userAddress: Address, timestamp: BigInt): void {
  const positionId = poolAddress.toHexString() + '-' + userAddress.toHexString();
  let position = Position.load(positionId);

  if (position == null) {
    // Create new position
    position = new Position(positionId);
    position.market = poolAddress.toHexString();
    position.user = getOrCreateUser(userAddress).id;

    position.suppliedShares = BigInt.fromI32(0);
    position.suppliedAssets = BigInt.fromI32(0);
    position.collateralAmount = BigInt.fromI32(0);
    position.borrowedAmount = BigInt.fromI32(0);
    position.borrowShares = BigInt.fromI32(0);

    position.healthFactor = BigInt.fromI32(0).toBigDecimal();
    position.isLiquidatable = false;
    position.timeUnderwater = BigInt.fromI32(0);
    position.underwaterSince = BigInt.fromI32(0);

    position.suppliedUSD = BigInt.fromI32(0).toBigDecimal();
    position.collateralUSD = BigInt.fromI32(0).toBigDecimal();
    position.borrowedUSD = BigInt.fromI32(0).toBigDecimal();

    position.createdAt = timestamp;
  }

  // Load current balances from contract
  const poolContract = LendingPoolContract.bind(poolAddress);

  // Get position data (collateral and borrowShares) using positions mapping
  const positionData = poolContract.try_positions(userAddress);
  if (!positionData.reverted) {
    position.collateralAmount = positionData.value.getCollateralAmount();
    position.borrowShares = positionData.value.getBorrowShares();
  }

  // Get user debt (borrowed amount in assets)
  const userDebt = poolContract.try_getUserDebt(userAddress);
  if (!userDebt.reverted) {
    position.borrowedAmount = userDebt.value;
  }

  // Note: Supply shares are tracked via Deposit/Withdraw events
  // We don't query them here to avoid ABI compatibility issues

  // Calculate health factor
  const healthFactorResult = poolContract.try_healthFactor(userAddress);
  if (!healthFactorResult.reverted) {
    const hf = healthFactorResult.value;
    position.healthFactor = hf.toBigDecimal().div(WAD.toBigDecimal());

    // Check if liquidatable (HF < 1.0)
    const wasLiquidatable = position.isLiquidatable;
    position.isLiquidatable = hf.lt(WAD);

    // Update underwater tracking
    if (position.isLiquidatable && !wasLiquidatable) {
      // Just became liquidatable
      position.underwaterSince = timestamp;
    } else if (!position.isLiquidatable && wasLiquidatable) {
      // Recovered from liquidatable state
      position.underwaterSince = BigInt.fromI32(0);
      position.timeUnderwater = BigInt.fromI32(0);
    } else if (position.isLiquidatable && position.underwaterSince.gt(BigInt.fromI32(0))) {
      // Still liquidatable, update time underwater
      position.timeUnderwater = timestamp.minus(position.underwaterSince);
    }
  }

  position.lastUpdate = timestamp;
  position.save();

  // Update user stats
  updateUserStats(userAddress, timestamp);
}

function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (user == null) {
    user = new User(address.toHexString());
    user.totalSuppliedUSD = BigInt.fromI32(0).toBigDecimal();
    user.totalBorrowedUSD = BigInt.fromI32(0).toBigDecimal();
    user.totalLiquidations = BigInt.fromI32(0);
    user.totalLiquidationsExecuted = BigInt.fromI32(0);
    user.totalProfitUSD = BigInt.fromI32(0).toBigDecimal();
    user.firstInteraction = BigInt.fromI32(0);
    user.lastInteraction = BigInt.fromI32(0);
    user.save();
  }
  return user;
}

function updateUserStats(address: Address, timestamp: BigInt): void {
  const user = User.load(address.toHexString());
  if (user == null) {
    return;
  }

  if (user.firstInteraction.equals(BigInt.fromI32(0))) {
    user.firstInteraction = timestamp;
  }
  user.lastInteraction = timestamp;

  // Aggregate user positions (simplified - would need to iterate all positions)
  user.save();
}

function createTransaction(
  txHash: Bytes,
  logIndex: BigInt,
  type: string,
  poolAddress: Address,
  userAddress: Address,
  amount: BigInt,
  gasPrice: BigInt,
  gasLimit: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  const txId = txHash.toHexString() + '-' + logIndex.toString();
  const tx = new Transaction(txId);

  tx.type = type;
  tx.market = poolAddress.toHexString();
  tx.user = userAddress.toHexString();
  tx.amount = amount;
  tx.amountUSD = BigInt.fromI32(0).toBigDecimal(); // Would need oracle prices
  tx.gasUsed = gasLimit;
  tx.gasPrice = gasPrice;
  tx.timestamp = timestamp;
  tx.blockNumber = blockNumber;
  tx.transactionHash = txHash;

  tx.save();
}

function updateDailySnapshot(
  poolAddress: Address,
  timestamp: BigInt,
  txType: string,
  amount: BigInt
): void {
  const market = Market.load(poolAddress.toHexString());
  if (market == null) {
    return;
  }

  const dayId = timestamp.div(SECONDS_PER_DAY).toI32();
  const snapshotId = poolAddress.toHexString() + '-' + dayId.toString();

  let snapshot = MarketSnapshot.load(snapshotId);
  if (snapshot == null) {
    snapshot = new MarketSnapshot(snapshotId);
    snapshot.market = market.id;
    snapshot.day = dayId;

    snapshot.totalSupplyAssets = market.totalSupplyAssets;
    snapshot.totalBorrowAssets = market.totalBorrowAssets;
    snapshot.totalCollateral = market.totalCollateral;
    snapshot.borrowRate = market.borrowRate;
    snapshot.supplyRate = market.supplyRate;
    snapshot.utilizationRate = market.utilizationRate;

    snapshot.totalSupplyUSD = market.totalSupplyUSD;
    snapshot.totalBorrowUSD = market.totalBorrowUSD;
    snapshot.totalCollateralUSD = market.totalCollateralUSD;

    snapshot.dailyDeposits = BigInt.fromI32(0);
    snapshot.dailyWithdrawals = BigInt.fromI32(0);
    snapshot.dailyBorrows = BigInt.fromI32(0);
    snapshot.dailyRepayments = BigInt.fromI32(0);
    snapshot.dailyLiquidations = BigInt.fromI32(0);

    snapshot.dailyDepositVolumeUSD = BigInt.fromI32(0).toBigDecimal();
    snapshot.dailyBorrowVolumeUSD = BigInt.fromI32(0).toBigDecimal();
    snapshot.dailyLiquidationVolumeUSD = BigInt.fromI32(0).toBigDecimal();

    snapshot.timestamp = timestamp;
  }

  // Update counters based on transaction type
  if (txType === 'deposit') {
    snapshot.dailyDeposits = snapshot.dailyDeposits.plus(BigInt.fromI32(1));
  } else if (txType === 'withdraw') {
    snapshot.dailyWithdrawals = snapshot.dailyWithdrawals.plus(BigInt.fromI32(1));
  } else if (txType === 'borrow') {
    snapshot.dailyBorrows = snapshot.dailyBorrows.plus(BigInt.fromI32(1));
  } else if (txType === 'repay') {
    snapshot.dailyRepayments = snapshot.dailyRepayments.plus(BigInt.fromI32(1));
  }

  snapshot.save();
}
