// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkAggregatorV3} from "../interfaces/external/IChainlinkAggregatorV3.sol";

/// @title OracleLib
/// @notice Helper functions for oracle price validation
library OracleLib {
    /// @notice Validate Chainlink round data
    /// @param roundId The round ID
    /// @param answer The price answer
    /// @param updatedAt When the round was updated
    /// @param answeredInRound The round in which answer was computed
    /// @param maxStaleness Maximum allowed staleness in seconds
    /// @return isValid True if the data is valid
    /// @return reason Reason if invalid (empty if valid)
    function validateChainlinkData(
        uint80 roundId,
        int256 answer,
        uint256 updatedAt,
        uint80 answeredInRound,
        uint256 maxStaleness
    ) internal view returns (bool isValid, string memory reason) {
        // Check for positive price
        if (answer <= 0) {
            return (false, "Non-positive price");
        }

        // Check round completeness
        if (answeredInRound < roundId) {
            return (false, "Incomplete round");
        }

        // Check for stale data
        if (block.timestamp - updatedAt > maxStaleness) {
            return (false, "Stale price");
        }

        // Check updatedAt is not in the future (sanity check)
        if (updatedAt > block.timestamp) {
            return (false, "Future timestamp");
        }

        return (true, "");
    }

    /// @notice Normalize price to 18 decimals
    /// @param price The raw price from Chainlink
    /// @param feedDecimals The decimals of the Chainlink feed
    /// @return normalizedPrice Price with 18 decimals
    function normalizePrice(int256 price, uint8 feedDecimals) internal pure returns (uint256 normalizedPrice) {
        if (feedDecimals < 18) {
            normalizedPrice = uint256(price) * 10 ** (18 - feedDecimals);
        } else if (feedDecimals > 18) {
            normalizedPrice = uint256(price) / 10 ** (feedDecimals - 18);
        } else {
            normalizedPrice = uint256(price);
        }
    }

    /// @notice Calculate percentage deviation between two prices
    /// @param price1 First price
    /// @param price2 Second price
    /// @return deviation Deviation as a WAD (1e18 = 100%)
    function calculateDeviation(uint256 price1, uint256 price2) internal pure returns (uint256 deviation) {
        if (price1 == 0 || price2 == 0) return type(uint256).max;

        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        uint256 avg = (price1 + price2) / 2;

        deviation = (diff * 1e18) / avg;
    }
}
