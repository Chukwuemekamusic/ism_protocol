// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOracleRouter
/// @notice Interface for the oracle routing system with fallback support
interface IOracleRouter {
    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Configuration for a token's price feeds
    struct OracleConfig {
        address chainlinkFeed; // Primary: Chainlink aggregator
        address uniswapPool; // Fallback: Uniswap V3 pool for TWAP
        uint32 twapWindow; // TWAP observation window in seconds
        uint96 maxStaleness; // Max age for Chainlink data (seconds)
        bool isToken0; // Is this token token0 in the Uniswap pool?
    }

    /// @notice Price data returned by the oracle
    struct PriceData {
        uint256 price; // Price in USD with 18 decimals
        uint256 timestamp; // When the price was last updated
        bool isFromFallback; // True if TWAP was used
    }

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event OracleConfigured(address indexed token, address chainlinkFeed, address uniswapPool, uint32 twapWindow);
    event PriceUpdated(address indexed token, uint256 price, bool isFromFallback);
    event FallbackActivated(address indexed token, string reason);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error OracleNotConfigured(address token);
    error StalePrice(address token, uint256 updatedAt, uint256 maxStaleness);
    error InvalidPrice(address token, int256 price);
    error SequencerDown();
    error PriceDeviationTooHigh(address token, uint256 chainlinkPrice, uint256 twapPrice);
    error BothOraclesFailed(address token);

    /*//////////////////////////////////////////////////////////////
                              FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the current price of a token in USD (18 decimals)
    /// @param token The token address
    /// @return price The price in USD with 18 decimals
    function getPrice(address token) external view returns (uint256 price);

    /// @notice Get detailed price data including source information
    /// @param token The token address
    /// @return data Full price data struct
    function getPriceData(address token) external view returns (PriceData memory data);

    /// @notice Configure oracle sources for a token
    /// @param token The token to configure
    /// @param config The oracle configuration
    function setOracleConfig(address token, OracleConfig calldata config) external;

    /// @notice Get the oracle configuration for a token
    /// @param token The token address
    /// @return config The oracle configuration
    function getOracleConfig(address token) external view returns (OracleConfig memory config);

    /// @notice Check if an oracle is configured for a token
    /// @param token The token address
    /// @return True if configured
    function isConfigured(address token) external view returns (bool);
}
