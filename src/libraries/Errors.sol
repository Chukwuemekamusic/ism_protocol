// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Errors {
    // commons
    error ZeroAmount();
    error ZeroAddress();
    error EmptyString();

    error SameToken();

    // LendingPool
    error InvalidCollateralToken();
    error InvalidBorrowToken();
    error InsufficientBalance();
    error InsufficientLiquidity();
    error WouldBeUndercollateralized();
    error NoDebt();
}
