// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MathLib
/// @notice Fixed-point math utilities using WAD (1e18) precision
/// @dev Based on Solmate's FixedPointMathLib with modifications
library MathLib {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 internal constant WAD = 1e18;
    uint256 internal constant RAY = 1e27;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /*//////////////////////////////////////////////////////////////
                             WAD OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Multiplies two WAD numbers and returns a WAD result
    /// @dev Rounds down
    function mulWadDown(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y) / WAD;
    }

    /// @notice Multiplies two WAD numbers and returns a WAD result
    /// @dev Rounds up
    function mulWadUp(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y + WAD - 1) / WAD;
    }

    /// @notice Divides two WAD numbers and returns a WAD result
    /// @dev Rounds down
    function divWadDown(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * WAD) / y;
    }

    /// @notice Divides two WAD numbers and returns a WAD result
    /// @dev Rounds up
    function divWadUp(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * WAD + y - 1) / y;
    }

    /*//////////////////////////////////////////////////////////////
                            UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the minimum of two numbers
    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }

    /// @notice Returns the maximum of two numbers
    function max(uint256 x, uint256 y) internal pure returns (uint256) {
        return x > y ? x : y;
    }

    /// @notice Converts an annual rate (WAD) to per-second rate (WAD)
    function annualRateToPerSecond(uint256 annualRate) internal pure returns (uint256) {
        return annualRate / SECONDS_PER_YEAR;
    }

    // extras to cross check later
    /// @notice Multiplies x and y, then divides by denominator, rounding down.
    /// @dev Equivalent to (x * y) / denominator
    function mulDivDown(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        // High-precision math: will revert if (x * y) overflows 256 bits
        // For production, consider using OpenZeppelin's Math.mulDiv for 512-bit support
        return (x * y) / denominator;
    }

    /// @notice Multiplies x and y, then divides by denominator, rounding up.
    /// @dev Equivalent to ceil((x * y) / denominator)
    function mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        uint256 prod = x * y;
        if (prod == 0) return 0;

        // Standard ceiling division formula: (a + b - 1) / b
        return (prod + denominator - 1) / denominator;
    }
}
