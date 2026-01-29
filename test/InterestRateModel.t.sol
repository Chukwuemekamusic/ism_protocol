// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InterestRateModel} from "../src/core/InterestRateModel.sol";
import {MathLib} from "../src/libraries/MathLib.sol";

contract InterestRateModelTest is Test {
    using MathLib for uint256;

    InterestRateModel public model;

    uint256 constant WAD = 1e18;
    uint256 constant BASE_RATE = 0; // 0%
    uint256 constant SLOPE_BEFORE = 0.04e18; // 4% APR
    uint256 constant SLOPE_AFTER = 0.75e18; // 75% APR
    uint256 constant KINK = 0.8e18; // 80%

    function setUp() public {
        model = new InterestRateModel(BASE_RATE, SLOPE_BEFORE, SLOPE_AFTER, KINK);
    }

    /*//////////////////////////////////////////////////////////////
                          UTILIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_utilization_zeroSupply() public view {
        uint256 util = model.getUtilization(0, 0);
        assertEq(util, 0);
    }

    function test_utilization_zeroBorrows() public view {
        uint256 util = model.getUtilization(1000e18, 0);
        assertEq(util, 0);
    }

    function test_utilization_50percent() public view {
        uint256 util = model.getUtilization(1000e18, 500e18);
        assertEq(util, 0.5e18);
    }

    function test_utilization_100percent() public view {
        uint256 util = model.getUtilization(1000e18, 1000e18);
        assertEq(util, WAD);
    }

    /*//////////////////////////////////////////////////////////////
                          BORROW RATE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_borrowRate_zeroUtilization() public view {
        uint256 rate = model.getBorrowRateAPR(1000e18, 0);
        assertEq(rate, BASE_RATE);
    }

    function test_borrowRate_atKink() public view {
        // At 80% utilization: 0 + 0.80 * 4% = 3.2% APR
        uint256 rate = model.getBorrowRateAPR(1000e18, 800e18);
        assertApproxEqRel(rate, 0.032e18, 0.001e18); // 3.2% with 0.1% tolerance
    }

    function test_borrowRate_aboveKink() public view {
        // At 90% utilization:
        // Base: 0
        // Before kink: 0.80 * 4% = 3.2%
        // After kink: (0.90 - 0.80) * 75% = 7.5%
        // Total: 10.7% APR
        uint256 rate = model.getBorrowRateAPR(1000e18, 900e18);
        assertApproxEqRel(rate, 0.107e18, 0.001e18);
    }

    function test_borrowRate_maxUtilization() public view {
        // At 100% utilization:
        // Base: 0
        // Before kink: 0.80 * 4% = 3.2%
        // After kink: (1.0 - 0.80) * 75% = 15%
        // Total: 18.2% APR
        uint256 rate = model.getBorrowRateAPR(1000e18, 1000e18);
        assertApproxEqRel(rate, 0.182e18, 0.001e18);
    }

    /*//////////////////////////////////////////////////////////////
                          SUPPLY RATE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_supplyRate_zeroUtilization() public view {
        uint256 rate = model.getSupplyRateAPR(1000e18, 0, 0.1e18);
        assertEq(rate, 0);
    }

    function test_supplyRate_withReserveFactor() public view {
        // At 80% utilization, 3.2% borrow rate, 10% reserve
        // Supply rate = 3.2% * 80% * 90% = 2.304%
        uint256 rate = model.getSupplyRateAPR(1000e18, 800e18, 0.1e18);
        assertApproxEqRel(rate, 0.02304e18, 0.001e18);
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_utilization_bounded(uint256 supply, uint256 borrows) public view {
        supply = bound(supply, 1, type(uint128).max);
        borrows = bound(borrows, 0, supply);

        uint256 util = model.getUtilization(supply, borrows);
        assertLe(util, WAD);
    }

    function testFuzz_borrowRate_monotonic(uint256 supply, uint256 borrows1, uint256 borrows2) public view {
        supply = bound(supply, 1e18, type(uint128).max);
        borrows1 = bound(borrows1, 0, supply);
        borrows2 = bound(borrows2, borrows1, supply);

        uint256 rate1 = model.getBorrowRate(supply, borrows1);
        uint256 rate2 = model.getBorrowRate(supply, borrows2);

        // Higher utilization = higher rate
        assertGe(rate2, rate1);
    }

    function testFuzz_supplyRate_lessThanBorrowRate(uint256 supply, uint256 borrows, uint256 reserveFactor)
        public
        view
    {
        supply = bound(supply, 1e18, type(uint128).max);
        borrows = bound(borrows, 1, supply);
        reserveFactor = bound(reserveFactor, 0, WAD);

        uint256 borrowRate = model.getBorrowRate(supply, borrows);
        uint256 supplyRate = model.getSupplyRate(supply, borrows, reserveFactor);

        // Supply rate should always be less than or equal to borrow rate
        assertLe(supplyRate, borrowRate);
    }
}
