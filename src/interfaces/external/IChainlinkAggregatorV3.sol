// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// solhint-disable-next-line interface-starts-with-i
// AggregatorV3Interface
interface IChainlinkAggregatorV3 {
    /// @notice Get the latest round data
    /// @return roundId The round ID
    /// @return answer The price answer
    /// @return startedAt Timestamp when the round started
    /// @return updatedAt Timestamp when the round was updated
    /// @return answeredInRound The round ID in which the answer
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    /// @notice Get the number of decimals for the answer
    function decimals() external view returns (uint8);

    /// @notice Get the description of the feed
    function description() external view returns (string memory);

    /// @notice Get the version of the feed
    function version() external view returns (uint256);

    function getRoundData(uint80 _roundId)
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
