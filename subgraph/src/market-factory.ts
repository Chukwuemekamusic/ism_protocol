import { MarketCreated } from '../generated/MarketFactory/MarketFactory';
import { LendingPool as LendingPoolTemplate } from '../generated/templates';
import { Market, Token } from '../generated/schema';
import { LendingPool as LendingPoolContract } from '../generated/MarketFactory/LendingPool';
import { ERC20 } from '../generated/MarketFactory/ERC20';
import { BigInt, Address } from '@graphprotocol/graph-ts';

export function handleMarketCreated(event: MarketCreated): void {
  const poolAddress = event.params.market;
  const collateralToken = event.params.collateralToken;
  const borrowToken = event.params.borrowToken;
  const poolToken = event.params.poolToken;

  // Check if market already exists (could be created via registry)
  let market = Market.load(poolAddress.toHexString());
  if (market == null) {
    market = new Market(poolAddress.toHexString());

    // Load token information
    market.collateralToken = getOrCreateToken(collateralToken).id;
    market.borrowToken = getOrCreateToken(borrowToken).id;
    market.poolToken = poolToken;

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

    // Set risk parameters (using protocol defaults as they're not exposed in ABI)
    market.ltv = BigInt.fromI32(75).times(BigInt.fromI32(10).pow(16)); // 75% = 0.75e18
    market.liquidationThreshold = BigInt.fromI32(80).times(BigInt.fromI32(10).pow(16)); // 80% = 0.80e18
    market.liquidationPenalty = BigInt.fromI32(5).times(BigInt.fromI32(10).pow(16)); // 5% = 0.05e18

    // Timestamps
    market.createdAt = event.block.timestamp;
    market.lastAccrualTime = event.block.timestamp;
    market.lastUpdate = event.block.timestamp;

    market.save();

    // Create dynamic data source for this pool
    LendingPoolTemplate.create(poolAddress);
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
