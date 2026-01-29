// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleRouter {
    /// @notice Get the price of a token in USD (18 decimals)
    /// @param token The token address
    /// @return price The price in USD with 18 decimals
    function getPrice(address token) external view returns (uint256 price);
}
