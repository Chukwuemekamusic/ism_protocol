// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILendingPool} from "./ILendingPool.sol";

/// @title IMarketFactory
/// @notice Interface for creating new isolated lending markets
interface IMarketFactory {
    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct CreateMarketParams {
        address collateralToken;
        address borrowToken;
        uint64 ltv;
        uint64 liquidationThreshold;
        uint64 liquidationPenalty;
        uint64 reserveFactor;
        string poolTokenName;
        string poolTokenSymbol;
    }

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event MarketCreated(
        address indexed market, address indexed collateralToken, address indexed borrowToken, address poolToken
    );

    event ImplementationUpdated(address indexed newImplementation);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    // error MarketAlreadyExists(address collateralToken, address borrowToken);
    // error InvalidParameters();
    // error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                              FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new isolated lending market
    /// @param params Market creation parameters
    /// @return market Address of the new market
    function createMarket(CreateMarketParams calldata params) external returns (address market);

    /// @notice Get the market for a token pair
    /// @param collateralToken The collateral token
    /// @param borrowToken The borrow token
    /// @return market The market address (address(0) if doesn't exist)
    function getMarket(address collateralToken, address borrowToken) external view returns (address market);

    /// @notice Check if a market exists
    function marketExists(address collateralToken, address borrowToken) external view returns (bool);

    /// @notice Get all created markets
    function getAllMarkets() external view returns (address[] memory);

    /// @notice Get the number of markets
    function marketCount() external view returns (uint256);

    /// @notice Get the lending pool implementation address
    function lendingPoolImplementation() external view returns (address);

    /// @notice Get the oracle router address
    function oracleRouter() external view returns (address);

    /// @notice Get the interest rate model address
    function interestRateModel() external view returns (address);

    /// @notice Get the liquidator address
    function liquidator() external view returns (address);
}
