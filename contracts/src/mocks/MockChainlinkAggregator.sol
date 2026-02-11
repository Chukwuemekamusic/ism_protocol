// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkAggregatorV3} from "../interfaces/external/IChainlinkAggregatorV3.sol";

/// @title MockChainlinkAggregator
/// @notice Mock Chainlink price feed for testing
/// @dev Allows manual control of price, timestamp, and round data
contract MockChainlinkAggregator is IChainlinkAggregatorV3 {
    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    uint8 private _decimals;
    string private _description;

    int256 private _price;
    uint80 private _roundId;
    uint256 private _updatedAt;
    uint80 private _answeredInRound;

    bool private _shouldRevert;

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy mock with specified decimals
    /// @param decimals_ Number of decimals (usually 8 for USD feeds)
    constructor(uint8 decimals_) {
        _decimals = decimals_;
        _description = "Mock Price Feed";
        _roundId = 1;
        _updatedAt = block.timestamp;
        _answeredInRound = 1;
    }

    /*//////////////////////////////////////////////////////////////
                          SETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Set the price returned by latestRoundData
    /// @param price_ New price (in feed decimals, e.g., 2000e8 for $2000 with 8 decimals)
    function setPrice(int256 price_) external {
        _price = price_;
        _roundId++;
        _updatedAt = block.timestamp;
        _answeredInRound = _roundId;
    }

    /// @notice Set price with custom timestamp
    /// @param price_ New price
    /// @param updatedAt_ Custom timestamp
    function setPriceWithTimestamp(int256 price_, uint256 updatedAt_) external {
        _price = price_;
        _roundId++;
        _updatedAt = updatedAt_;
        _answeredInRound = _roundId;
    }

    /// @notice Set only the updatedAt timestamp (to simulate stale data)
    /// @param updatedAt_ New timestamp
    function setUpdatedAt(uint256 updatedAt_) external {
        _updatedAt = updatedAt_;
    }

    /// @notice Set the round data directly for edge case testing
    /// @param roundId_ Round ID
    /// @param answer_ Price answer
    /// @param updatedAt_ Update timestamp
    /// @param answeredInRound_ Answered in round
    function setRoundData(uint80 roundId_, int256 answer_, uint256 updatedAt_, uint80 answeredInRound_) external {
        _roundId = roundId_;
        _price = answer_;
        _updatedAt = updatedAt_;
        _answeredInRound = answeredInRound_;
    }

    /// @notice Make latestRoundData revert (simulate feed failure)
    /// @param shouldRevert_ Whether to revert
    function setShouldRevert(bool shouldRevert_) external {
        _shouldRevert = shouldRevert_;
    }

    /// @notice Set the description string
    /// @param description_ New description
    function setDescription(string calldata description_) external {
        _description = description_;
    }

    /*//////////////////////////////////////////////////////////////
                       CHAINLINK INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IChainlinkAggregatorV3
    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        if (_shouldRevert) {
            revert("Feed unavailable");
        }

        return (
            _roundId,
            _price,
            _updatedAt, // startedAt = updatedAt for simplicity
            _updatedAt,
            _answeredInRound
        );
    }

    /// @inheritdoc IChainlinkAggregatorV3
    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    /// @inheritdoc IChainlinkAggregatorV3
    function description() external view override returns (string memory) {
        return _description;
    }

    /*//////////////////////////////////////////////////////////////
                         HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get current stored price
    function getPrice() external view returns (int256) {
        return _price;
    }

    /// @notice Get current round ID
    function getRoundId() external view returns (uint80) {
        return _roundId;
    }

    /// @notice Simulate a price update (increments round, updates timestamp)
    /// @param newPrice_ New price to set
    function updatePrice(int256 newPrice_) external {
        _price = newPrice_;
        _roundId++;
        _updatedAt = block.timestamp;
        _answeredInRound = _roundId;
    }

    /// @notice Simulate incomplete round (answeredInRound < roundId)
    function setIncompleteRound() external {
        _roundId++;
        // Don't update answeredInRound, making it less than roundId
    }

    /// @notice Simulate negative price (invalid)
    function setNegativePrice() external {
        _price = -1;
        _roundId++;
        _updatedAt = block.timestamp;
        _answeredInRound = _roundId;
    }

    /// @notice Simulate zero price (invalid)
    function setZeroPrice() external {
        _price = 0;
        _roundId++;
        _updatedAt = block.timestamp;
        _answeredInRound = _roundId;
    }

    // function getRoundData(uint80 _roundId)
    //     external
    //     view
    //     override
    //     returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    // {
    //     return
    //         (
    //             _roundId,
    //             _price,
    //             _updatedAt, // startedAt = updatedAt for simplicity
    //             _updatedAt,
    //             _answeredInRound
    //         );
    // }
}
