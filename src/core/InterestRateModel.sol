// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IInterestRateModel} from "../interfaces/IInterestRateModel.sol";
import {MathLib} from "../libraries/MathLib.sol";

contract InterestRateModel is IInterestRateModel {
    error InterestRateModel__KinkAboveWAD();

    using MathLib for uint256;

    uint256 public constant WAD = 1e18;

    /// @notice Base rate per second at 0% utilization
    uint256 public immutable baseRatePerSecond;

    /// @notice Kink utilization threshold (WAD)
    uint256 public immutable kink;

    /// @notice Slope before kink (per second)
    uint256 public immutable slopeBeforeKink;

    /// @notice Slope after kink (per second)
    uint256 public immutable slopeAfterKink;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy a new interest rate model
    /// @param _baseRatePerYear Base rate per year (WAD) - e.g., 0 for 0%
    /// @param _slopeBeforeKink Slope before kink per year (WAD) - e.g., 0.04e18 for 4%
    /// @param _slopeAfterKink Slope after kink per year (WAD) - e.g., 0.75e18 for 75%
    /// @param _kink Kink utilization point (WAD) - e.g., 0.80e18 for 80%
    constructor(uint256 _baseRatePerYear, uint256 _slopeBeforeKink, uint256 _slopeAfterKink, uint256 _kink) {
        if (_kink > WAD) {
            revert InterestRateModel__KinkAboveWAD();
        }
        baseRatePerSecond = _baseRatePerYear / MathLib.SECONDS_PER_YEAR;
        slopeBeforeKink = _slopeBeforeKink / MathLib.SECONDS_PER_YEAR;
        slopeAfterKink = _slopeAfterKink / MathLib.SECONDS_PER_YEAR;
        kink = _kink;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IInterestRateModel
    function getUtilization(uint256 totalSupply, uint256 totalBorrows) public pure returns (uint256) {
        if (totalSupply == 0) return 0;
        return totalBorrows.divWadDown(totalSupply);
    }

    /// @inheritdoc IInterestRateModel
    function getBorrowRate(uint256 totalSupply, uint256 totalBorrows) public view returns (uint256) {
        uint256 utilization = getUtilization(totalSupply, totalBorrows);
        return _getBorrowRate(utilization);
    }

    /// @inheritdoc IInterestRateModel
    function getSupplyRate(uint256 totalSupply, uint256 totalBorrows, uint256 reserveFactor)
        external
        view
        returns (uint256)
    {
        return _getSupplyRate(totalSupply, totalBorrows, reserveFactor);
    }

    /*//////////////////////////////////////////////////////////////
                           HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the annual borrow rate for display purposes
    function getBorrowRateAPR(uint256 totalSupply, uint256 totalBorrows) external view returns (uint256) {
        uint256 borrowRate = getBorrowRate(totalSupply, totalBorrows);
        return borrowRate * MathLib.SECONDS_PER_YEAR;
    }

    /// @notice Get the annual supply rate for display purposes
    function getSupplyRateAPR(uint256 totalSupply, uint256 totalBorrows, uint256 reserveFactor)
        external
        view
        returns (uint256)
    {
        return _getSupplyRate(totalSupply, totalBorrows, reserveFactor) * MathLib.SECONDS_PER_YEAR;
    }

    /*//////////////////////////////////////////////////////////////
                             INTERNAL FUNCS
    //////////////////////////////////////////////////////////////*/

    /// @notice Calculates the interest rate per second for a given utilization
    function _getBorrowRate(uint256 utilization) internal view returns (uint256) {
        if (utilization <= kink) {
            // Below kink: baseRate + utilization * slopeBeforeKink
            return baseRatePerSecond + utilization.mulWadDown(slopeBeforeKink);
        } else {
            // Above kink: baseRate + kink * slopeBeforeKink + (utilization - kink) * slopeAfterKink
            uint256 rateAtKink = baseRatePerSecond + kink.mulWadDown(slopeBeforeKink);
            uint256 excessUtilization = utilization - kink;
            return rateAtKink + excessUtilization.mulWadDown(slopeAfterKink);
        }
    }

    function _getSupplyRate(uint256 totalSupply, uint256 totalBorrows, uint256 reserveFactor)
        internal
        view
        returns (uint256)
    {
        uint256 utilization = getUtilization(totalSupply, totalBorrows);
        uint256 borrowRate = _getBorrowRate(utilization);
        // Supply rate = borrow rate * utilization * (1 - reserve factor)
        uint256 rateBeforeReserve = borrowRate.mulWadDown(utilization);
        return rateBeforeReserve.mulWadDown(WAD - reserveFactor);
    }
}
