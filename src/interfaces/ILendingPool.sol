// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolToken} from "src/interfaces/IPoolToken.sol";

interface ILendingPool {
    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/
    struct Position {
        uint128 collateralAmount; // Collateral deposited
        uint128 borrowShares; // Share of borrows
    }

    struct MarketConfig {
        address collateralToken;
        address borrowToken;
        address interestRateModel;
        address oracleRouter;
        uint64 ltv; // e.g., 0.75e18 = 75%
        uint64 liquidationThreshold; // e.g., 0.80e18 = 80%
        uint64 liquidationPenalty; // e.g., 0.05e18 = 5%
        uint64 reserveFactor; // e.g., 0.10e18 = 10%
    }

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/

    event Initialized(
        address indexed collateralToken, address indexed borrowToken, address interestRateModel, address oracleRouter
    );
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event DepositCollateral(address indexed user, uint256 amount);
    event WithdrawCollateral(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 assets, uint256 shares);
    event Repay(address indexed user, address indexed payer, uint256 assets, uint256 shares);
    event InterestAccrued(uint256 newBorrowIndex, uint256 totalBorrows, uint256 reserves);
    event CollateralLocked(address indexed user, uint256 amount);
    event CollateralUnlocked(address indexed user, uint256 amount);
    event Liquidation(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);
    event LiquidatorSet(address indexed liquidator);

    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the pool (called by factory)
    function initialize(MarketConfig calldata config, address poolToken, address liquidator, address factory) external;

    /*//////////////////////////////////////////////////////////////
                          SUPPLY OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 assets) external returns (uint256 shares);
    function withdraw(uint256 assets) external returns (uint256 shares);

    /*//////////////////////////////////////////////////////////////
                        COLLATERAL OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function depositCollateral(uint256 amount) external;
    function withdrawCollateral(uint256 amount) external;

    /*//////////////////////////////////////////////////////////////
                         BORROW OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function borrow(uint256 amount) external returns (uint256 shares);
    function repay(uint256 amount) external returns (uint256 shares);
    function repayOnBehalf(address onBehalfOf, uint256 amount) external returns (uint256 shares);

    /*//////////////////////////////////////////////////////////////
                        LIQUIDATION SUPPORT
    //////////////////////////////////////////////////////////////*/

    function lockCollateralForLiquidation(address user, uint256 amount) external;
    function unlockCollateralAfterLiquidation(address user, uint256 amount) external;
    function executeLiquidation(address user, address liquidatorAddr, uint256 debtRepaid, uint256 collateralSeized)
        external;

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function accrueInterest() external;
    function getPosition(address user) external view returns (Position memory);
    function getUserDebt(address user) external view returns (uint256);
    function healthFactor(address user) external view returns (uint256);
    function isLiquidatable(address user) external view returns (bool);
    function getMaxBorrow(address user) external view returns (uint256);

    // Token references
    function collateralToken() external view returns (IERC20);
    function borrowToken() external view returns (IERC20);
    function poolToken() external view returns (IPoolToken);

    // Market parameters
    function ltv() external view returns (uint64);
    function liquidationThreshold() external view returns (uint64);
    function liquidationPenalty() external view returns (uint64);
    function reserveFactor() external view returns (uint64);

    // Market state
    function totalSupplyAssets() external view returns (uint256);
    function totalBorrowAssets() external view returns (uint256);
    function totalCollateral() external view returns (uint256);
    function borrowIndex() external view returns (uint256);
    function totalReserves() external view returns (uint256);

    // Decimals
    function collateralDecimals() external view returns (uint8);
    function borrowDecimals() external view returns (uint8);

    // View
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);

    // Admin
    function setLiquidator(address _liquidator) external;
}

