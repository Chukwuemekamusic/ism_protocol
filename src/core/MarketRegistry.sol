// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IMarketRegistry} from "src/interfaces/IMarketRegistry.sol";
import {Validator} from "src/libraries/Validator.sol";
import {Errors} from "src/libraries/Errors.sol";

/// @title MarketRegistry
/// @notice Registers and stores information about lending markets
contract MarketRegistry is IMarketRegistry, Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Authorized factories
    mapping(address factory => bool) public authorizedFactories;

    /// @notice Market info by address
    mapping(address market => MarketInfo) public marketInfo;

    /// @notice Set of all registered markets
    EnumerableSet.AddressSet private _allMarkets;

    /// @notice Active markets
    EnumerableSet.AddressSet private _activeMarkets;

    /// @notice Markets by collateral token
    mapping(address collateralToken => EnumerableSet.AddressSet) private _marketsByCollateral;

    /// @notice Markets by borrow token
    mapping(address borrowToken => EnumerableSet.AddressSet) private _marketsByBorrow;

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyAuthorized() {
        _onlyAuthorized();
        _;
    }

    function _onlyAuthorized() internal view {
        if (!authorizedFactories[msg.sender] && msg.sender != owner()) {
            revert Errors.NotAuthorized();
        }
    }

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IMarketRegistry
    function setFactory(address factory, bool isAuthorized) external onlyOwner {
        Validator.ensureAddressIsNotZeroAddress(factory);
        authorizedFactories[factory] = isAuthorized;
        emit FactoryAuthorized(factory, isAuthorized);
    }

    /// @inheritdoc IMarketRegistry
    function setMarketStatus(address market, bool _isActive) external onlyOwner {
        _setMarketStatus(market, _isActive);
    }

    function deactivateMarket(address market) external onlyOwner {
        _setMarketStatus(market, false);
    }

    function _setMarketStatus(address market, bool _isActive) internal {
        marketInfo[market].isActive = _isActive;

        if (_isActive) {
            _activeMarkets.add(market);
        } else {
            _activeMarkets.remove(market);
        }

        emit MarketStatusUpdated(market, _isActive);
    }

    /*//////////////////////////////////////////////////////////////
                            REGISTRY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IMarketRegistry
    function registerMarket(address market, address collateralToken, address borrowToken, address poolToken)
        external
        onlyAuthorized
        nonReentrant
    {
        {
            Validator.ensureAddressIsNotZeroAddress(market);
            Validator.ensureTokenIsNotZeroAddress(collateralToken);
            Validator.ensureTokenIsNotZeroAddress(borrowToken);
            Validator.ensureTokenIsNotZeroAddress(poolToken);
            Validator.ensureTokenIsNotSame(collateralToken, borrowToken);
        }

        if (_allMarkets.contains(market)) {
            revert Errors.MarketAlreadyRegistered();
        }

        // store market info
        marketInfo[market] = MarketInfo({
            market: market,
            collateralToken: collateralToken,
            borrowToken: borrowToken,
            poolToken: poolToken,
            createdAt: block.timestamp,
            isActive: true
        });

        // add to sets
        _allMarkets.add(market);
        _activeMarkets.add(market);
        _marketsByCollateral[collateralToken].add(market);
        _marketsByBorrow[borrowToken].add(market);

        emit MarketRegistered(market, collateralToken, borrowToken);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IMarketRegistry
    function getMarketInfo(address market) external view returns (MarketInfo memory) {
        return marketInfo[market];
    }

    /// @inheritdoc IMarketRegistry
    function getMarketsForCollateral(address collateralToken) external view returns (address[] memory) {
        return _marketsByCollateral[collateralToken].values();
    }

    /// @inheritdoc IMarketRegistry
    function getMarketsForBorrow(address borrowToken) external view returns (address[] memory) {
        return _marketsByBorrow[borrowToken].values();
    }

    /// @inheritdoc IMarketRegistry
    function getActiveMarkets() external view returns (address[] memory) {
        return _activeMarkets.values();
    }

    /// @inheritdoc IMarketRegistry
    function isRegistered(address market) external view returns (bool) {
        return _allMarkets.contains(market);
    }

    /// @inheritdoc IMarketRegistry
    function isActive(address market) external view returns (bool) {
        return _activeMarkets.contains(market);
    }

    /// @inheritdoc IMarketRegistry
    function marketCount() external view returns (uint256) {
        return _allMarkets.length();
    }

    /// @inheritdoc IMarketRegistry
    // function getInactiveMarkets() external view returns (address[] memory) {
    //     EnumerableSet.AddressSet memory inactiveMarkets =
    //         EnumerableSet.AddressSet.difference(_allMarkets, _activeMarkets);
    //     return inactiveMarkets.values();
    // }
}

