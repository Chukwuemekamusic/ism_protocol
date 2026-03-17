import {
  Deposit,
  Withdraw,
  Borrow,
  Repay,
  CollateralDeposited,
  CollateralWithdrawn,
  InterestAccrued,
} from '../generated/templates/LendingPool/LendingPool';
import {
  Market,
  Position,
  User,
  Transaction,
  MarketSnapshot,
} from '../generated/schema';
import { LendingPool as LendingPoolContract } from '../generated/templates/LendingPool/LendingPool';
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';

const WAD = BigInt.fromI32(10).pow(18);
const SECONDS_PER_DAY = BigInt.fromI32(86400);

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
  const amount = event.params.amount;

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
    amount,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );

  // Update daily snapshot
  updateDailySnapshot(poolAddress, event.block.timestamp, 'borrow', amount);
}

export function handleRepay(event: Repay): void {
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
    'REPAY',
    poolAddress,
    user,
    amount,
    event.transaction.gasPrice,
    event.transaction.gasLimit,
    event.block.timestamp,
    event.block.number
  );

  // Update daily snapshot
  updateDailySnapshot(poolAddress, event.block.timestamp, 'repay', amount);
}

export function handleCollateralDeposited(event: CollateralDeposited): void {
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

export function handleCollateralWithdrawn(event: CollateralWithdrawn): void {
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
  const borrowRate = event.params.borrowRate;
  const borrowIndex = event.params.borrowIndex;
  const timestamp = event.params.timestamp;

  // Update market with interest data
  const market = Market.load(poolAddress.toHexString());
  if (market != null) {
    market.borrowRate = borrowRate;
    market.borrowIndex = borrowIndex;
    market.lastAccrualTime = timestamp;
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

  // Update rates
  const borrowRate = poolContract.try_borrowRate();
  const supplyRate = poolContract.try_supplyRate();

  if (!borrowRate.reverted) {
    market.borrowRate = borrowRate.value;
  }
  if (!supplyRate.reverted) {
    market.supplyRate = supplyRate.value;
  }

  market.lastUpdate = timestamp;
  market.save();
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

  const suppliedShares = poolContract.try_balanceOf(userAddress);
  const collateral = poolContract.try_userCollateral(userAddress);
  const borrowedAmount = poolContract.try_userBorrow(userAddress);

  if (!suppliedShares.reverted) {
    position.suppliedShares = suppliedShares.value;

    // Convert shares to assets
    const totalSupply = poolContract.try_totalSupplyShares();
    const totalAssets = poolContract.try_totalSupplyAssets();
    if (!totalSupply.reverted && !totalAssets.reverted && totalSupply.value.gt(BigInt.fromI32(0))) {
      position.suppliedAssets = suppliedShares.value.times(totalAssets.value).div(totalSupply.value);
    }
  }
  if (!collateral.reverted) {
    position.collateralAmount = collateral.value;
  }
  if (!borrowedAmount.reverted) {
    position.borrowedAmount = borrowedAmount.value;
  }

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
  txHash: Address,
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
