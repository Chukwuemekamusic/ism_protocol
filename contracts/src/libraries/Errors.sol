// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Errors {
    // commons
    error ZeroAmount();
    error ZeroAddress();
    error EmptyString();

    error SameToken();
    error InvalidToken();

    // LendingPool
    error AlreadyInitialized();
    error InvalidCollateralToken();
    error InvalidBorrowToken();
    error InsufficientBalance();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error InsufficientLocked();
    error WouldBeUndercollateralized();
    error OnlyLiquidator();
    error OnlyFactory();
    error NoDebt();

    // Oracle Router
    error OracleNotConfigured(address token);
    error StalePrice(address token, uint256 updatedAt, uint256 maxStaleness);
    error InvalidPrice(address token, int256 price);
    error SequencerDown();
    error PriceDeviationTooHigh(address token, uint256 chainlinkPrice, uint256 twapPrice);
    error BothOraclesFailed(address token);

    // DutchAuctionLiquidator
    error PositionNotLiquidatable(address user, uint256 healthFactor);
    error AuctionNotActive(uint256 auctionId);
    error AuctionAlreadyExists(address user, address pool);
    error AuctionExpired(uint256 auctionId);
    error AuctionNotExpired(uint256 auctionId);
    error InsufficientRepayment(uint256 provided, uint256 required);
    error InvalidAuctionConfig();
    error PoolNotAuthorized(address pool);
    error InvalidAuctionConfigDuration();
    error InvalidAuctionConfigStartPremium();
    error InvalidAuctionConfigEndDiscount();
    error InvalidAuctionConfigCloseFactor();

    // MarketFactory
    error MarketAlreadyExists(address collateralToken, address borrowToken);
    error InvalidParameters();

    // MarketRegistry
    error MarketAlreadyRegistered();
    error MarketNotFound();
    error NotAuthorized();
}
