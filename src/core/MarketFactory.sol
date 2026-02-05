// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IMarketFactory} from "src/interfaces/IMarketFactory.sol";
import {IMarketRegistry} from "src/interfaces/IMarketRegistry.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {PoolToken} from "src/core/PoolToken.sol";
import {Validator} from "src/libraries/Validator.sol";
import {Errors} from "src/libraries/Errors.sol";

/// @title MarketFactory
/// @notice Creates new isolated lending markets using minimal proxies
/// @dev Markets are clones of a single implementation contract
contract MarketFactory is IMarketFactory, Ownable {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Lending pool implementation for cloning
    address public immutable lendingPoolImplementation;

    /// @notice shared Oracle router
    address public immutable oracleRouter;

    /// @notice shared Interest rate model
    address public immutable interestRateModel;

    /// @notice shared Liquidator
    address public immutable liquidator;

    /// @notice Market registry
    IMarketRegistry public immutable registry;

    /// @notice Mapping from (collateral, borrow) => market address
    mapping(address collateralToken => mapping(address borrowToken => address market)) public markets;

    /// @notice List of all created markets
    address[] public allMarkets;

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _lendingPoolImplementation,
        address _oracleRouter,
        address _interestRateModel,
        address _liquidator,
        address _registry
    ) Ownable(msg.sender) {
        Validator.ensureAddressIsNotZeroAddress(_lendingPoolImplementation);
        Validator.ensureAddressIsNotZeroAddress(_oracleRouter);
        Validator.ensureAddressIsNotZeroAddress(_interestRateModel);
        Validator.ensureAddressIsNotZeroAddress(_liquidator);
        Validator.ensureAddressIsNotZeroAddress(_registry);

        lendingPoolImplementation = _lendingPoolImplementation;
        oracleRouter = _oracleRouter;
        interestRateModel = _interestRateModel;
        liquidator = _liquidator;
        registry = IMarketRegistry(_registry);
    }

    /*//////////////////////////////////////////////////////////////
                            MARKET CREATION
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IMarketFactory
    function createMarket(CreateMarketParams calldata params) external onlyOwner returns (address market) {
        _validateMarketParams(params);

        // Check if market already exists
        if (markets[params.collateralToken][params.borrowToken] != address(0)) {
            revert Errors.MarketAlreadyExists(params.collateralToken, params.borrowToken);
        }

        // Deploy lendingpool clone
        market = Clones.clone(lendingPoolImplementation);

        // Deploy pool token for this market
        PoolToken poolToken = new PoolToken(market, params.poolTokenName, params.poolTokenSymbol);

        // initialize the pool
        ILendingPool(market)
            .initialize(
                ILendingPool.MarketConfig({
                    collateralToken: params.collateralToken,
                    borrowToken: params.borrowToken,
                    interestRateModel: interestRateModel,
                    oracleRouter: oracleRouter,
                    ltv: params.ltv,
                    liquidationThreshold: params.liquidationThreshold,
                    liquidationPenalty: params.liquidationPenalty,
                    reserveFactor: params.reserveFactor
                }),
                address(poolToken),
                liquidator,
                address(this)
            );

        // Store market address
        markets[params.collateralToken][params.borrowToken] = market;
        allMarkets.push(market);

        // Register market in registry
        registry.registerMarket(market, params.collateralToken, params.borrowToken, address(poolToken));

        emit MarketCreated(market, params.collateralToken, params.borrowToken, address(poolToken));
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IMarketFactory
    function getMarket(address collateralToken, address borrowToken) external view returns (address market) {
        return markets[collateralToken][borrowToken];
    }

    /// @inheritdoc IMarketFactory
    function marketExists(address collateralToken, address borrowToken) external view returns (bool) {
        return markets[collateralToken][borrowToken] != address(0);
    }

    /// @inheritdoc IMarketFactory
    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }

    /// @inheritdoc IMarketFactory
    function marketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _validateMarketParams(CreateMarketParams calldata params) internal pure {
        Validator.ensureCollateralTokenIsNotZero(params.collateralToken);
        Validator.ensureBorrowTokenIsNotZero(params.borrowToken);
        Validator.ensureTokenIsNotSame(params.collateralToken, params.borrowToken);
        if (params.ltv == 0 || params.ltv > 0.95e18) {
            revert Errors.InvalidParameters();
        }
        if (params.liquidationThreshold <= params.ltv || params.liquidationThreshold > 0.99e18) {
            revert Errors.InvalidParameters();
        }
    }
}
