import { MarketAdded } from '../generated/MarketRegistry/MarketRegistry';
import { LendingPool as LendingPoolTemplate } from '../generated/templates';
import { Market, Token, Protocol } from '../generated/schema';
import { LendingPool as LendingPoolContract } from '../generated/MarketRegistry/LendingPool';
import { ERC20 } from '../generated/MarketRegistry/ERC20';
import { BigInt, Address } from '@graphprotocol/graph-ts';

export function handleMarketAdded(event: MarketAdded): void {
  const poolAddress = event.params.pool;
  const collateralToken = event.params.collateralToken;
  const borrowToken = event.params.borrowToken;

  // Load or create market
  let market = Market.load(poolAddress.toHexString());
  if (market == null) {
    market = new Market(poolAddress.toHexString());

    // Load token information
    market.collateralToken = getOrCreateToken(collateralToken).id;
    market.borrowToken = getOrCreateToken(borrowToken).id;

    // Load pool data
    const poolContract = LendingPoolContract.bind(poolAddress);
    market.poolToken = poolContract.poolToken();

    // Initialize stats
    market.totalSupplyAssets = BigInt.fromI32(0);
    market.totalBorrowAssets = BigInt.fromI32(0);
    market.totalCollateral = BigInt.fromI32(0);
    market.totalReserves = BigInt.fromI32(0);

    // Initialize rates
    market.borrowRate = BigInt.fromI32(0);
    market.supplyRate = BigInt.fromI32(0);
    market.utilizationRate = BigInt.fromI32(0).toBigDecimal();
    market.borrowIndex = BigInt.fromI32(1).times(BigInt.fromI32(10).pow(18)); // 1e18

    // Initialize USD values
    market.totalSupplyUSD = BigInt.fromI32(0).toBigDecimal();
    market.totalBorrowUSD = BigInt.fromI32(0).toBigDecimal();
    market.totalCollateralUSD = BigInt.fromI32(0).toBigDecimal();

    // Load risk parameters from pool
    const ltv = poolContract.try_LTV();
    const liquidationThreshold = poolContract.try_LIQUIDATION_THRESHOLD();
    const liquidationPenalty = poolContract.try_LIQUIDATION_PENALTY();

    market.ltv = ltv.reverted ? BigInt.fromI32(75).times(BigInt.fromI32(10).pow(16)) : ltv.value; // Default 75%
    market.liquidationThreshold = liquidationThreshold.reverted
      ? BigInt.fromI32(80).times(BigInt.fromI32(10).pow(16))
      : liquidationThreshold.value; // Default 80%
    market.liquidationPenalty = liquidationPenalty.reverted
      ? BigInt.fromI32(5).times(BigInt.fromI32(10).pow(16))
      : liquidationPenalty.value; // Default 5%

    // Timestamps
    market.createdAt = event.block.timestamp;
    market.lastAccrualTime = event.block.timestamp;
    market.lastUpdate = event.block.timestamp;

    market.save();

    // Create dynamic data source for this pool
    LendingPoolTemplate.create(poolAddress);

    // Update protocol stats
    updateProtocolStats();
  }
}

function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString());
  if (token == null) {
    token = new Token(address.toHexString());

    const contract = ERC20.bind(address);
    const symbolResult = contract.try_symbol();
    const nameResult = contract.try_name();
    const decimalsResult = contract.try_decimals();

    token.symbol = symbolResult.reverted ? 'UNKNOWN' : symbolResult.value;
    token.name = nameResult.reverted ? 'Unknown Token' : nameResult.value;
    token.decimals = decimalsResult.reverted ? 18 : decimalsResult.value;

    token.save();
  }
  return token;
}

function updateProtocolStats(): void {
  let protocol = Protocol.load('protocol');
  if (protocol == null) {
    protocol = new Protocol('protocol');
    protocol.totalMarkets = BigInt.fromI32(0);
    protocol.totalValueLockedUSD = BigInt.fromI32(0).toBigDecimal();
    protocol.totalBorrowedUSD = BigInt.fromI32(0).toBigDecimal();
    protocol.totalLiquidationsUSD = BigInt.fromI32(0).toBigDecimal();
    protocol.lastUpdate = BigInt.fromI32(0);
  }

  protocol.totalMarkets = protocol.totalMarkets.plus(BigInt.fromI32(1));
  protocol.lastUpdate = BigInt.fromI32(0); // Will be updated by market handlers

  protocol.save();
}
