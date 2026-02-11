// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInterestRateModel {
    /**
     * @notice Calculate the current borrow rate per second
     * @param totalSupply Total assets supplied to the pool
     * @param totalBorrows Total assets borrowed from the pool
     * @return borrowRate The borrow rate per second (WAD)
     */
    function getBorrowRate(uint256 totalSupply, uint256 totalBorrows) external view returns (uint256 borrowRate);

    /**
     * @notice Calculate the current supply rate per second
     * @param totalSupply Total assets supplied
     * @param totalBorrows Total assets borrowed
     * @param reserveFactor Protocol reserve factor (WAD)
     * @return supplyRate The supply rate per second (WAD)
     */
    function getSupplyRate(uint256 totalSupply, uint256 totalBorrows, uint256 reserveFactor)
        external
        view
        returns (uint256 supplyRate);

    /**
     * @notice Calculate the current utilization rate
     * @param totalSupply Total assets supplied
     * @param totalBorrows Total assets borrowed
     * @return utilization The utilization rate (WAD)
     */
    function getUtilization(uint256 totalSupply, uint256 totalBorrows) external view returns (uint256 utilization);
}
