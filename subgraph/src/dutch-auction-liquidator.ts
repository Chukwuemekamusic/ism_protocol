import {
  AuctionStarted,
  AuctionExecuted,
  AuctionCancelled,
} from '../generated/DutchAuctionLiquidator/DutchAuctionLiquidator';
import { Auction, Liquidation, Position, User, Market } from '../generated/schema';
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';

const WAD = BigInt.fromI32(10).pow(18);

export function handleAuctionStarted(event: AuctionStarted): void {
  const auctionId = event.params.auctionId;
  const poolAddress = event.params.pool;
  const borrower = event.params.user;
  const collateralAmount = event.params.collateralForSale;
  const debtAmount = event.params.debtToRepay;
  const startPrice = event.params.startPrice;
  const endPrice = event.params.endPrice;

  // Create auction entity
  const auction = new Auction(auctionId.toString());
  auction.market = poolAddress.toHexString();
  auction.borrower = getOrCreateUser(borrower).id;

  // Load position
  const positionId = poolAddress.toHexString() + '-' + borrower.toHexString();
  let position = Position.load(positionId);
  if (position != null) {
    auction.position = position.id;
  }

  // Set auction parameters
  auction.collateralAmount = collateralAmount;
  auction.debtAmount = debtAmount;
  auction.startTime = event.block.timestamp;

  // Estimate end time (assuming 20 minute duration as per protocol default)
  const AUCTION_DURATION = BigInt.fromI32(20 * 60); // 20 minutes
  auction.endTime = event.block.timestamp.plus(AUCTION_DURATION);

  // Set price multipliers from event
  auction.startPriceMultiplier = startPrice;
  auction.endPriceMultiplier = endPrice;
  auction.currentPriceMultiplier = startPrice;
  auction.isActive = true;
  auction.startedBy = event.transaction.from; // Use transaction sender

  // Calculate USD values (simplified - would need oracle integration for accuracy)
  auction.collateralValueUSD = BigInt.fromI32(0).toBigDecimal();
  auction.debtValueUSD = BigInt.fromI32(0).toBigDecimal();

  auction.createdAt = event.block.timestamp;
  auction.updatedAt = event.block.timestamp;

  auction.save();
}

export function handleAuctionExecuted(event: AuctionExecuted): void {
  const auctionId = event.params.auctionId;
  const liquidator = event.params.liquidator;
  const debtRepaid = event.params.debtRepaid;
  const collateralSold = event.params.collateralSold;
  const executionPrice = event.params.executionPrice;

  // Load auction
  const auction = Auction.load(auctionId.toString());
  if (auction == null) {
    return; // Shouldn't happen
  }

  // Mark auction as inactive
  auction.isActive = false;
  auction.updatedAt = event.block.timestamp;
  auction.save();

  // Create liquidation entity
  const liquidationId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const liquidation = new Liquidation(liquidationId);
  liquidation.auction = auction.id;
  liquidation.market = auction.market;
  liquidation.liquidator = getOrCreateUser(liquidator).id;
  liquidation.borrower = auction.borrower; // Get borrower from auction

  // Set amounts
  liquidation.debtRepaid = debtRepaid;
  liquidation.collateralReceived = collateralSold;

  // Calculate penalty (difference between collateral value and debt)
  // penalty = collateralSold * executionPrice - debtRepaid (simplified)
  liquidation.penalty = BigInt.fromI32(0); // Simplified for now

  // USD values (simplified)
  liquidation.debtRepaidUSD = BigInt.fromI32(0).toBigDecimal();
  liquidation.collateralReceivedUSD = BigInt.fromI32(0).toBigDecimal();
  liquidation.profitUSD = BigInt.fromI32(0).toBigDecimal();

  // Execution details
  liquidation.gasPaid = event.transaction.gasPrice.times(event.transaction.gasLimit);
  liquidation.gasPrice = event.transaction.gasPrice;
  liquidation.timestamp = event.block.timestamp;
  liquidation.transactionHash = event.transaction.hash;
  liquidation.blockNumber = event.block.number;

  liquidation.save();

  // Update auction reference
  auction.liquidation = liquidation.id;
  auction.save();

  // Update user stats
  const borrowerAddress = Address.fromString(auction.borrower);
  updateUserLiquidationStats(liquidator, borrowerAddress);
}

export function handleAuctionCancelled(event: AuctionCancelled): void {
  const auctionId = event.params.auctionId;

  // Load and mark auction as inactive
  const auction = Auction.load(auctionId.toString());
  if (auction != null) {
    auction.isActive = false;
    auction.updatedAt = event.block.timestamp;
    auction.save();
  }

  // Note: When auction is cancelled, collateral returns to borrower
  // Position should be updated by LendingPool events
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

function updateUserLiquidationStats(liquidator: Address, borrower: Address): void {
  // Update liquidator stats
  let liquidatorUser = User.load(liquidator.toHexString());
  if (liquidatorUser != null) {
    liquidatorUser.totalLiquidationsExecuted = liquidatorUser.totalLiquidationsExecuted.plus(BigInt.fromI32(1));
    liquidatorUser.save();
  }

  // Update borrower stats
  let borrowerUser = User.load(borrower.toHexString());
  if (borrowerUser != null) {
    borrowerUser.totalLiquidations = borrowerUser.totalLiquidations.plus(BigInt.fromI32(1));
    borrowerUser.save();
  }
}
