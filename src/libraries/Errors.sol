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
    error InvalidCollateralToken();
    error InvalidBorrowToken();
    error InsufficientBalance();
    error InsufficientLiquidity();
    error WouldBeUndercollateralized();
    error NoDebt();

    // Oracle Router
    error OracleNotConfigured(address token);
    error StalePrice(address token, uint256 updatedAt, uint256 maxStaleness);
    error InvalidPrice(address token, int256 price);
    error SequencerDown();
    error PriceDeviationTooHigh(address token, uint256 chainlinkPrice, uint256 twapPrice);
    error BothOraclesFailed(address token);
}
