// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LendingPool} from "src/core/LendingPool.sol";
import {DutchAuctionLiquidator} from "src/core/DutchAuctionLiquidator.sol";
import {IDutchAuctionLiquidator} from "src/interfaces/IDutchAuctionLiquidator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title LiquidationHandler
/// @notice Handler contract for stateful fuzz testing of Dutch auction liquidations
/// @dev Manages auction lifecycle and liquidator actions
contract LiquidationHandler is Test {
    LendingPool public pool;
    DutchAuctionLiquidator public liquidator;
    IERC20 public collateralToken;
    IERC20 public borrowToken;

    // Track actors
    address[] public borrowers; // Users with positions to liquidate
    address[] public liquidators; // Liquidator accounts
    mapping(address => bool) public isBorrower;
    mapping(address => bool) public isLiquidator;

    // Operational bounds
    uint256 constant MAX_REPAY = 1_000_000e6; // Max debt to repay in one liquidation
    uint256 constant WAD = 1e18;

    // Ghost variables for tracking
    mapping(uint256 => uint256) public ghostAuctionStartPrice; // Track start price per auction
    mapping(uint256 => uint256) public ghostAuctionEndPrice; // Track end price per auction
    mapping(uint256 => uint256) public ghostAuctionStartTime; // Track start time per auction
    mapping(uint256 => uint256) public ghostAuctionEndTime; // Track end time per auction
    mapping(uint256 => uint256) public ghostTotalDebtRepaid; // Track total debt repaid per auction
    mapping(uint256 => uint256) public ghostTotalCollateralSeized; // Track collateral seized

    uint256 public ghostTotalLiquidations; // Total liquidation events
    uint256 public ghostTotalDebtCleaned; // Total debt cleared via liquidations
    uint256 public ghostTotalCollateralSold; // Total collateral auctioned

    // Price history for invariant checks
    mapping(uint256 => uint256[]) public priceHistory; // Prices recorded during auction
    mapping(uint256 => uint256) public lastRecordedPrice; // Last price for each auction

    event BorrowerAdded(address indexed borrower);
    event LiquidatorAdded(address indexed liquidator);
    event AuctionStartedHandler(uint256 indexed auctionId, uint256 startPrice, uint256 endPrice);
    event LiquidationExecutedHandler(uint256 indexed auctionId, uint256 debtRepaid, uint256 collateralReceived);
    event PriceRecorded(uint256 indexed auctionId, uint256 price, uint256 timestamp);

    constructor(address _pool, address _liquidator, address _collateral, address _borrow) {
        pool = LendingPool(_pool);
        liquidator = DutchAuctionLiquidator(_liquidator);
        collateralToken = IERC20(_collateral);
        borrowToken = IERC20(_borrow);
    }

    /// @notice Add a borrower account
    function addBorrower(address borrower) public {
        if (!isBorrower[borrower]) {
            isBorrower[borrower] = true;
            borrowers.push(borrower);
            emit BorrowerAdded(borrower);
        }
    }

    /// @notice Add a liquidator account
    function addLiquidator(address _liquidator) public {
        if (!isLiquidator[_liquidator]) {
            isLiquidator[_liquidator] = true;
            liquidators.push(_liquidator);
            emit LiquidatorAdded(_liquidator);
        }
    }

    /// @notice Get borrowers array
    function getBorrowers() public view returns (address[] memory) {
        return borrowers;
    }

    /// @notice Get liquidators array
    function getLiquidators() public view returns (address[] memory) {
        return liquidators;
    }

    /// @notice Handler: Start an auction for an underwater position
    /// @param borrowerIndex Index into borrowers array
    function startAuction(uint256 borrowerIndex) public {
        if (borrowers.length == 0) return;

        address borrower = borrowers[borrowerIndex % borrowers.length];

        // Check if position is liquidatable
        if (!pool.isLiquidatable(borrower)) {
            return; // Skip if position is healthy
        }

        // Check if already has active auction
        (bool hasAuction,) = liquidator.hasActiveAuction(address(pool), borrower);
        if (hasAuction) {
            return; // Skip if auction already active
        }

        // Start auction
        uint256 auctionId = liquidator.startAuction(address(pool), borrower);

        // Get auction details
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);

        // Track ghost state
        ghostAuctionStartPrice[auctionId] = auction.startPrice;
        ghostAuctionEndPrice[auctionId] = auction.endPrice;
        ghostAuctionStartTime[auctionId] = auction.startTime;
        ghostAuctionEndTime[auctionId] = auction.endTime;
        ghostTotalCollateralSold += auction.collateralForSale;

        emit AuctionStartedHandler(auctionId, auction.startPrice, auction.endPrice);
    }

    /// @notice Handler: Execute a liquidation
    /// @param liquidatorIndex Index into liquidators array
    /// @param auctionId Auction to liquidate
    /// @param debtAmount Amount of debt to repay
    function liquidate(uint256 liquidatorIndex, uint256 auctionId, uint256 debtAmount) public {
        if (liquidators.length == 0) return;

        address _liquidator = liquidators[liquidatorIndex % liquidators.length];

        // Check auction is active
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        if (!auction.isActive) return;
        if (block.timestamp > auction.endTime) return;

        // Bound debt amount
        debtAmount = bound(debtAmount, 1, MAX_REPAY);
        debtAmount = debtAmount > auction.debtToRepay ? auction.debtToRepay : debtAmount;

        // Ensure liquidator has tokens
        uint256 balance = borrowToken.balanceOf(_liquidator);
        if (balance < debtAmount) return;

        // Get current price for tracking
        uint256 currentPrice = liquidator.getCurrentPrice(auctionId);
        priceHistory[auctionId].push(currentPrice);
        lastRecordedPrice[auctionId] = currentPrice;

        // Execute liquidation
        vm.startPrank(_liquidator);
        borrowToken.approve(address(liquidator), debtAmount);
        (uint256 debtRepaid, uint256 collateralReceived) = liquidator.liquidate(auctionId, debtAmount);
        vm.stopPrank();

        // Track ghost state
        ghostTotalDebtRepaid[auctionId] += debtRepaid;
        ghostTotalCollateralSeized[auctionId] += collateralReceived;
        ghostTotalDebtCleaned += debtRepaid;
        ghostTotalLiquidations++;

        emit LiquidationExecutedHandler(auctionId, debtRepaid, collateralReceived);
    }

    /// @notice Handler: Time warp to progress auction
    /// @param secondsToWarp Number of seconds to advance
    function timeWarp(uint256 secondsToWarp) public {
        secondsToWarp = bound(secondsToWarp, 1, 1 days); // Max 1 day per call
        vm.warp(block.timestamp + secondsToWarp);
    }

    /// @notice Handler: Record current price for active auction
    /// @param auctionId Auction to record price for
    function recordPrice(uint256 auctionId) public {
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        if (!auction.isActive || block.timestamp > auction.endTime) return;

        uint256 currentPrice = liquidator.getCurrentPrice(auctionId);
        priceHistory[auctionId].push(currentPrice);
        lastRecordedPrice[auctionId] = currentPrice;

        emit PriceRecorded(auctionId, currentPrice, block.timestamp);
    }

    /// @notice Handler: Cancel expired auction
    /// @param auctionId Auction to cancel
    function cancelExpired(uint256 auctionId) public {
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        if (!auction.isActive) return;
        if (block.timestamp <= auction.endTime) return;

        liquidator.cancelExpiredAuction(auctionId);
    }

    // === View Functions ===

    /// @notice Get current auction state
    function getAuctionState(uint256 auctionId)
        public
        view
        returns (
            address user,
            address auctionPool,
            uint256 debtRemaining,
            uint256 collateralRemaining,
            bool isActive,
            uint256 remainingTime
        )
    {
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        return (
            auction.user,
            auction.pool,
            auction.debtToRepay,
            auction.collateralForSale,
            auction.isActive,
            block.timestamp >= auction.endTime ? 0 : auction.endTime - block.timestamp
        );
    }

    /// @notice Get price range for auction
    function getPriceRange(uint256 auctionId)
        public
        view
        returns (uint256 startPrice, uint256 endPrice, uint256 currentPrice)
    {
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        if (!auction.isActive) return (0, 0, 0);

        startPrice = auction.startPrice;
        endPrice = auction.endPrice;
        currentPrice = liquidator.getCurrentPrice(auctionId);
    }

    /// @notice Get price history for auction
    function getPriceHistory(uint256 auctionId) public view returns (uint256[] memory) {
        return priceHistory[auctionId];
    }

    /// @notice Get total liquidations count
    function getTotalLiquidations() public view returns (uint256) {
        return ghostTotalLiquidations;
    }

    /// @notice Get total debt cleaned
    function getTotalDebtCleaned() public view returns (uint256) {
        return ghostTotalDebtCleaned;
    }

    /// @notice Get total collateral sold
    function getTotalCollateralSold() public view returns (uint256) {
        return ghostTotalCollateralSold;
    }

    /// @notice Check if price decreased monotonically
    function isPriceMonotonic(uint256 auctionId) public view returns (bool) {
        uint256[] memory prices = priceHistory[auctionId];
        if (prices.length <= 1) return true;

        for (uint256 i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) {
                return false; // Price increased!
            }
        }
        return true;
    }

    /// @notice Get debt reduction from liquidation
    function getDebtReduction(uint256 auctionId) public view returns (uint256) {
        return ghostTotalDebtRepaid[auctionId];
    }

    /// @notice Get collateral seized
    function getCollateralSeized(uint256 auctionId) public view returns (uint256) {
        return ghostTotalCollateralSeized[auctionId];
    }

    /// @notice Get user's current debt
    function getUserDebt(address user) public view returns (uint256) {
        return pool.getUserDebt(user);
    }

    /// @notice Get user's health factor
    function getUserHealthFactor(address user) public view returns (uint256) {
        return pool.healthFactor(user);
    }
}
