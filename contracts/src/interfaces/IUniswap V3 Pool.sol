// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IUniswapV3Pool
/// @notice Minimal interface for Uniswap V3 pool TWAP functionality
/// @dev Only includes functions needed for oracle fallback
interface IUniswapV3Pool {
    /// @notice Returns the cumulative tick and liquidity as of each timestamp `secondsAgo`
    /// @dev Used for calculating TWAP (Time-Weighted Average Price)
    /// @param secondsAgos Array of seconds ago from which to return observations
    /// @return tickCumulatives Cumulative tick values as of each `secondsAgos`
    /// @return secondsPerLiquidityCumulativeX128s Cumulative seconds per liquidity
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);

    /// @notice The first of the two tokens of the pool, sorted by address
    /// @return The token0 address
    function token0() external view returns (address);

    /// @notice The second of the two tokens of the pool, sorted by address
    /// @return The token1 address
    function token1() external view returns (address);

    /// @notice The pool's fee in hundredths of a bip (1e-6)
    /// @return The fee (e.g., 3000 = 0.3%)
    function fee() external view returns (uint24);

    /// @notice The current price and tick of the pool
    /// @return sqrtPriceX96 The current sqrt(price) as a Q64.96 value
    /// @return tick The current tick
    /// @return observationIndex The index of the last written observation
    /// @return observationCardinality The current maximum number of observations
    /// @return observationCardinalityNext The next maximum number of observations
    /// @return feeProtocol The protocol fee for both tokens
    /// @return unlocked Whether the pool is currently unlocked
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
}
