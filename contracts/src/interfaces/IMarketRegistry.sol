// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMarketRegistry
/// @notice Interface for the market registry
interface IMarketRegistry {
    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/
    struct MarketInfo {
        address market;
        address collateralToken;
        address borrowToken;
        address poolToken;
        uint256 createdAt;
        bool isActive;
    }
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    // error NotAuthorized();
    // error MarketAlreadyRegistered();
    // error MarketNotFound();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event MarketRegistered(address indexed market, address indexed collateralToken, address indexed borrowToken);
    event MarketStatusUpdated(address indexed market, bool isActive);
    event FactoryAuthorized(address indexed factory, bool isAuthorized);
    // event MarketDeactivated(address indexed market);

    /*//////////////////////////////////////////////////////////////
                              FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Register a new market (called by Factory)
    function registerMarket(address market, address collateralToken, address borrowToken, address poolToken) external;

    /// @notice set market active status
    function setMarketStatus(address market, bool isActive) external;

    /// @notice Authorize a factory to register markets
    function setFactory(address factory, bool isAuthorized) external;

    /// @notice Get market info
    function getMarketInfo(address market) external view returns (MarketInfo memory);

    /// @notice Get all markets for a collateral token
    function getMarketsForCollateral(address collateralToken) external view returns (address[] memory);

    /// @notice Get all markets for a borrow token
    function getMarketsForBorrow(address borrowToken) external view returns (address[] memory);

    /// @notice Get all active markets
    function getActiveMarkets() external view returns (address[] memory);

    /// @notice Check if market is registered
    function isRegistered(address market) external view returns (bool);

    /// @notice Check if market is active
    function isActive(address market) external view returns (bool);

    /// @notice Get Total number of registered markets
    function marketCount() external view returns (uint256);

    /// @notice Get all inactive markets
    // function getInactiveMarkets() external view returns (address[] memory);
}
