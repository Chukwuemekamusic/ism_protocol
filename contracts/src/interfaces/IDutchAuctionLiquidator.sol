// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// @title IDutchAuctionLiquidator
// @notice Interface for liquidating positions via Dutch auction
interface IDutchAuctionLiquidator {
    /*//////////////////////////////////////////////////////////////
                                 STRUCT
    //////////////////////////////////////////////////////////////*/

    /// @notice Auction state
    struct Auction {
        address user; // Position owner being liquidated
        address pool; // LendingPool address
        uint128 debtToRepay; // Debt amount to be repaid (in borrow token)
        uint128 collateralForSale; // Collateral being auctioned
        uint64 startTime; // Auction start timestamp
        uint64 endTime; // Auction end timestamp
        uint256 startPrice; // Starting price (premium over oracle)
        uint256 endPrice; // Ending price (discount from oracle)
        bool isActive; // Auction status
    }

    /// @notice Auction configuration
    struct AuctionConfig {
        uint64 duration; // Auction duration in seconds
        uint64 startPremium; // Start price as % of oracle (e.g., 1.05e18 = 105%)
        uint64 endDiscount; // End price as % of oracle (e.g., 0.95e18 = 95%)
        uint64 closeFactor; // Max % of debt liquidatable per auction (e.g., 0.5e18 = 50%)
    }

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event AuctionStarted(
        uint256 indexed auctionId,
        address indexed user,
        address indexed pool,
        uint256 debtToRepay,
        uint256 collateralForSale,
        uint256 startPrice,
        uint256 endPrice
    );

    event AuctionExecuted(
        uint256 indexed auctionId,
        address indexed liquidator,
        uint256 debtRepaid,
        uint256 collateralSold,
        uint256 executionPrice
    );

    event AuctionCancelled(uint256 indexed auctionId, string reason);

    event AuctionConfigUpdated(uint64 duration, uint64 startPremium, uint64 endDiscount, uint64 closeFactor);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error PositionNotLiquidatable(address user, uint256 healthFactor);
    error AuctionNotActive(uint256 auctionId);
    error AuctionAlreadyExists(address user, address pool);
    error AuctionExpired(uint256 auctionId);
    error AuctionNotExpired(uint256 auctionId);
    error InsufficientRepayment(uint256 provided, uint256 required);
    error InvalidAuctionConfig();
    error PoolNotAuthorized(address pool);
    error InvalidAuctionConfigDuration();
    error InvalidAuctionConfigStartPremium();
    error InvalidAuctionConfigEndDiscount();
    error InvalidAuctionConfigCloseFactor();

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Start a liquidation auction for an underwater position
    /// @param pool The lending pool address
    /// @param user The user whose position is being liquidated
    /// @return auctionId The ID of the created auction
    function startAuction(address pool, address user) external returns (uint256 auctionId);

    /// @notice Execute a liquidation at the current auction price
    /// @param auctionId The ID of the auction to liquidate
    /// @param maxDebtToRepay Maximum debt the liquidator is willing to repay
    /// @return debtRepaid Actual debt repaid
    /// @return collateralReceived Collateral received by liquidator
    function liquidate(uint256 auctionId, uint256 maxDebtToRepay)
        external
        returns (uint256 debtRepaid, uint256 collateralReceived);

    /// @notice Get the current price for an auction
    /// @param auctionId The ID of the auction
    /// @return price The current price per unit of collateral (in borrow token decimals)
    function getCurrentPrice(uint256 auctionId) external view returns (uint256 price);

    /// @notice Get auction details
    /// @param auctionId The auction ID
    /// @return auction The auction struct
    function getAuction(uint256 auctionId) external view returns (Auction memory auction);

    /// @notice Check if a user has an active auction in a pool
    /// @param pool The lending pool
    /// @param user The user address
    /// @return hasAuction True if active auction exists
    /// @return auctionId The auction ID (0 if none)
    function hasActiveAuction(address pool, address user) external view returns (bool hasAuction, uint256 auctionId);

    /// @notice Cancel an expired auction
    /// @param auctionId The auction to cancel
    function cancelExpiredAuction(uint256 auctionId) external;
}
