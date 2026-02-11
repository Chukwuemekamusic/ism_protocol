// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";

/// @title MockOracle
/// @notice Simple mock oracle for testing
contract MockOracle is IOracleRouter {
    mapping(address token => uint256 price) public prices;

    /// @notice Set price for a token
    /// @param token Token address
    /// @param price Price in USD with 18 decimals
    function setPrice(address token, uint256 price) external {
        prices[token] = price;
    }

    /// @inheritdoc IOracleRouter
    function getPrice(address token) external view returns (uint256) {
        uint256 price = prices[token];
        require(price > 0, "Price not set");
        return price;
    }

    function getPriceData(address token) external view returns (PriceData memory) {
        uint256 price = prices[token];
        require(price > 0, "Price not set");
        return PriceData({price: price, timestamp: block.timestamp, isFromFallback: false});
    }

    function setOracleConfig(address token, OracleConfig calldata config) external {}

    function isConfigured(address token) external pure returns (bool) {
        return true;
    }

    function getOracleConfig(address token) external pure returns (OracleConfig memory) {
        return OracleConfig(address(0), address(0), 0, 0, false);
    }
}
