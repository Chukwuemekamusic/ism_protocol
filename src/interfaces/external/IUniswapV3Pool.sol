// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IUniswapV3Pool
/// @notice Minimal interface for Uniswap V3 pool TWAP functionality
interface IUniswapV3Pool {
    /// @notice Returns the cumulative tick and liquidity as of each timestamp `secondsAgo`
    /// @param secondsAgos Array of seconds ago from which to return observations
    /// @return tickCumulatives Cumulative tick values
    /// @return secondsPerLiquidityCumulativeX128s Cumulative seconds per liquidity
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);

    /// @notice The first of the two tokens of the pool, sorted by address
    function token0() external view returns (address);

    /// @notice The second of the two tokens of the pool, sorted by address
    function token1() external view returns (address);

    /// @notice The pool's fee in hundredths of a bip (1e-6)
    function fee() external view returns (uint24);

    /// @notice The current price of the pool as a sqrt(token1/token0) Q64.96 value
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
