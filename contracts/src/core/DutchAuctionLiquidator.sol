// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IDutchAuctionLiquidator} from "src/interfaces/IDutchAuctionLiquidator.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {MathLib} from "src/libraries/MathLib.sol";
import {Validator} from "src/libraries/Validator.sol";

/// @title DutchAuctionLiquidator
/// @notice Implements Dutch auction mechanism for liquidating underwater positions
/// @dev Price decreases linearly from startPrice to endPrice over auction duration
contract DutchAuctionLiquidator is IDutchAuctionLiquidator, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using MathLib for uint256;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant WAD = 1e18;

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Auction configuration
    AuctionConfig public auctionConfig;

    /// @notice Next auction ID
    uint256 public nextAuctionId;

    /// @notice Auction storage
    mapping(uint256 auctionId => Auction) public auctions;

    /// @notice Track active auctions per user per pool
    mapping(address pool => mapping(address user => uint256 auctionId)) public activeAuctions;

    /// @notice Authorized lending pools
    mapping(address pool => bool) public authorizedPools;

    /// @notice Oracle router reference
    IOracleRouter public immutable oracleRouter;

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _oracleRouter, AuctionConfig memory _config) Ownable(msg.sender) {
        Validator.ensureAddressIsNotZeroAddress(_oracleRouter);
        oracleRouter = IOracleRouter(_oracleRouter);
        _setAuctionConfig(_config);
        nextAuctionId = 1;
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Authorize a lending pool
    function authorizePool(address _pool, bool authorized) external onlyOwner {
        Validator.ensureAddressIsNotZeroAddress(_pool);
        authorizedPools[_pool] = authorized;
    }

    /// @notice Set auction configuration
    function setAuctionConfig(AuctionConfig memory _config) internal {
        _setAuctionConfig(_config);
    }

    function _setAuctionConfig(AuctionConfig memory _config) internal {
        _ensureAuctionConfigIsValid(_config);
        auctionConfig = _config;
        emit AuctionConfigUpdated(_config.duration, _config.startPremium, _config.endDiscount, _config.closeFactor);
    }

    /*//////////////////////////////////////////////////////////////
                        AUCTION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IDutchAuctionLiquidator
    function startAuction(address pool, address user) external nonReentrant returns (uint256 auctionId) {
        // Validate pool
        if (!authorizedPools[pool]) {
            revert PoolNotAuthorized(pool);
        }

        // Check no active auction exists
        if (activeAuctions[pool][user] != 0) {
            revert AuctionAlreadyExists(user, pool);
        }

        ILendingPool lendingPool = ILendingPool(pool);

        // Accrue interest first
        lendingPool.accrueInterest();

        // Check position is liquidatable
        uint256 healthFactor = lendingPool.healthFactor(user);
        if (healthFactor >= WAD) {
            revert PositionNotLiquidatable(user, healthFactor);
        }

        // Get position data
        ILendingPool.Position memory position = lendingPool.getPosition(user);

        // Get prices and penalty
        uint256 borrowPrice = oracleRouter.getPrice(address(lendingPool.borrowToken()));
        uint256 collateralPrice = oracleRouter.getPrice(address(lendingPool.collateralToken()));
        uint256 liquidationPenalty = lendingPool.liquidationPenalty();

        // calculate debt to liquidate (limited by close factor)
        uint256 totalDebt = lendingPool.getUserDebt(user);
        uint256 debtToRepay = totalDebt.mulWadDown(auctionConfig.closeFactor);

        // collateralToSeize = (debtToRepay * borrowPrice / collateralPrice) * (1 + penalty)
        uint256 debtValueInCollateral = debtToRepay * borrowPrice / collateralPrice;
        uint256 collateralToSeize = debtValueInCollateral.mulWadUp(WAD + liquidationPenalty);

        // Cap at available collateral
        uint8 collateralDecimals = lendingPool.collateralDecimals();
        uint8 borrowDecimals = lendingPool.borrowDecimals();
        // Normalize collateral calculation
        collateralToSeize = collateralToSeize * (10 ** collateralDecimals) / (10 ** borrowDecimals);

        if (collateralToSeize > position.collateralAmount) {
            collateralToSeize = position.collateralAmount;
            // Recalculate debt based on available collateral
            uint256 collateralValue = collateralToSeize * collateralPrice / (10 ** collateralDecimals);
            uint256 maxDebtValue = collateralValue.mulWadDown(WAD - liquidationPenalty);
            debtToRepay = maxDebtValue * (10 ** borrowDecimals) / borrowPrice;
        }

        // calculate aution prices
        uint256 oraclePrice = collateralPrice * (10 ** borrowDecimals) / (10 ** collateralDecimals);
        uint256 startPrice = oraclePrice.mulWadUp(auctionConfig.startPremium);
        uint256 endPrice = oraclePrice.mulWadDown(auctionConfig.endDiscount);

        // Create auction
        auctionId = nextAuctionId++;
        auctions[auctionId] = Auction({
            user: user,
            pool: pool,
            // forge-lint: disable-next-line(unsafe-typecast)
            debtToRepay: uint128(debtToRepay),
            collateralForSale: uint128(collateralToSeize),
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp + auctionConfig.duration),
            startPrice: startPrice,
            endPrice: endPrice,
            isActive: true
        });
        activeAuctions[pool][user] = auctionId;

        // lock collateral
        lendingPool.lockCollateralForLiquidation(user, collateralToSeize);

        emit AuctionStarted(auctionId, user, pool, debtToRepay, collateralToSeize, startPrice, endPrice);
    }

    /// @inheritdoc IDutchAuctionLiquidator
    function liquidate(uint256 auctionId, uint256 maxDebtToRepay)
        external
        nonReentrant
        returns (uint256 debtRepaid, uint256 collateralReceived)
    {
        Auction storage auction = auctions[auctionId];

        // Validate auction
        if (!auction.isActive) {
            revert AuctionNotActive(auctionId);
        }
        if (block.timestamp > auction.endTime) {
            revert AuctionExpired(auctionId);
        }

        // Get current price
        uint256 currentPrice = _getCurrentPrice(auction);

        // Calculate amounts
        debtRepaid = maxDebtToRepay > auction.debtToRepay ? auction.debtToRepay : maxDebtToRepay;

        // collateralReceived = debtRepaid / currentPrice
        ILendingPool pool = ILendingPool(auction.pool);
        // uint8 borrowDecimals = pool.borrowDecimals();
        uint8 collateralDecimals = pool.collateralDecimals();

        collateralReceived = debtRepaid * (10 ** collateralDecimals) / currentPrice;

        // Cap at available collateral
        if (collateralReceived > auction.collateralForSale) {
            collateralReceived = auction.collateralForSale;
            // Recalculate debt based on collateral
            debtRepaid = collateralReceived * currentPrice / (10 ** collateralDecimals);
        }

        // Update auction state
        auction.debtToRepay -= uint128(debtRepaid);
        auction.collateralForSale -= uint128(collateralReceived);

        // Transfer borrow tokens from liquidator to pool
        IERC20 borrowToken = pool.borrowToken();
        borrowToken.safeTransferFrom(msg.sender, auction.pool, debtRepaid);

        // Execute liquidation in the pool
        pool.executeLiquidation(auction.user, msg.sender, debtRepaid, collateralReceived);

        // Close auction if fully liquidated
        if (auction.debtToRepay == 0 || auction.collateralForSale == 0) {
            _closeAuction(auctionId);
        }

        emit AuctionExecuted(auctionId, msg.sender, debtRepaid, collateralReceived, currentPrice);
    }

    /// @inheritdoc IDutchAuctionLiquidator
    function cancelExpiredAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];

        if (!auction.isActive) {
            revert AuctionNotActive(auctionId);
        }

        // Can only cancel if expired
        if (block.timestamp <= auction.endTime) {
            revert AuctionNotExpired(auctionId);
        }

        // Return remaining collateral to user
        if (auction.collateralForSale > 0) {
            ILendingPool(auction.pool).unlockCollateralAfterLiquidation(auction.user, auction.collateralForSale);
        }

        _closeAuction(auctionId);

        emit AuctionCancelled(auctionId, "Expired");
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Calculate current auction price using linear decay
    function _getCurrentPrice(Auction memory auction) internal view returns (uint256) {
        if (block.timestamp >= auction.endTime) {
            return auction.endPrice;
        }

        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 duration = auction.endTime - auction.startTime;

        // Linear interpolation: startPrice - (startPrice - endPrice) * elapsed / duration
        uint256 priceRange = auction.startPrice - auction.endPrice;
        uint256 priceDecay = priceRange * elapsed / duration;

        return auction.startPrice - priceDecay;
    }

    /// @notice Close an auction and clean up state
    function _closeAuction(uint256 auctionId) internal {
        Auction storage auction = auctions[auctionId];

        auction.isActive = false;
        delete activeAuctions[auction.pool][auction.user];
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IDutchAuctionLiquidator
    function getCurrentPrice(uint256 auctionId) external view returns (uint256) {
        Auction memory auction = auctions[auctionId];
        if (!auction.isActive) {
            revert AuctionNotActive(auctionId);
        }
        return _getCurrentPrice(auction);
    }

    /// @inheritdoc IDutchAuctionLiquidator
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    /// @inheritdoc IDutchAuctionLiquidator
    function hasActiveAuction(address pool, address user) external view returns (bool hasAuction, uint256 auctionId) {
        auctionId = activeAuctions[pool][user];
        hasAuction = auctionId != 0 && auctions[auctionId].isActive;
    }

    /// @notice Get remaining time for an auction
    function getRemainingTime(uint256 auctionId) external view returns (uint256) {
        Auction memory auction = auctions[auctionId];
        if (!auction.isActive || block.timestamp >= auction.endTime) {
            return 0;
        }
        return auction.endTime - block.timestamp;
    }

    /// @notice Calculate profit for liquidating at current price
    /// @dev Returns profit in 18-decimal USD value
    function calculateProfit(uint256 auctionId, uint256 debtToRepay) external view returns (int256 profit) {
        Auction memory auction = auctions[auctionId];
        if (!auction.isActive) return 0;

        ILendingPool pool = ILendingPool(auction.pool);
        uint256 currentPrice = _getCurrentPrice(auction);
        uint256 collateralPrice = oracleRouter.getPrice(address(pool.collateralToken()));
        uint256 borrowPrice = oracleRouter.getPrice(address(pool.borrowToken()));

        uint8 collateralDecimals = pool.collateralDecimals();
        uint8 borrowDecimals = pool.borrowDecimals();

        // Collateral received at current auction price
        uint256 collateralReceived = debtToRepay * (10 ** collateralDecimals) / currentPrice;

        // Value of collateral at oracle price (in 18 decimals)
        uint256 collateralValue = collateralReceived * collateralPrice / (10 ** collateralDecimals);

        // Value of debt paid (in 18 decimals)
        uint256 debtValue = debtToRepay * borrowPrice / (10 ** borrowDecimals);

        // Profit = value received - debt paid (both in 18 decimals)
        profit = int256(collateralValue) - int256(debtValue);
    }

    /*//////////////////////////////////////////////////////////////
                        HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _ensureAuctionConfigIsValid(AuctionConfig memory _config) internal pure {
        if (_config.duration == 0) {
            revert InvalidAuctionConfigDuration();
        }
        if (_config.startPremium == 0) {
            revert InvalidAuctionConfigStartPremium();
        }
        if (_config.endDiscount == 0 || _config.endDiscount > WAD) {
            revert InvalidAuctionConfigEndDiscount();
        }
        if (_config.closeFactor == 0 || _config.closeFactor > WAD) {
            revert InvalidAuctionConfigCloseFactor();
        }
    }
}
