// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MarketRegistry} from "src/core/MarketRegistry.sol";
import {IMarketRegistry} from "src/interfaces/IMarketRegistry.sol";

contract MarketRegistryTest is Test {
    MarketRegistry public registry;

    address public owner = makeAddr("owner");
    address public factory = makeAddr("factory");
    address public market1 = makeAddr("market1");
    address public market2 = makeAddr("market2");
    address public collateralToken = makeAddr("collateralToken");
    address public borrowToken = makeAddr("borrowToken");
    address public poolToken = makeAddr("poolToken");

    function setUp() public {
        vm.prank(owner);
        registry = new MarketRegistry();
    }

    function test_initialization() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.marketCount(), 0);
    }

    function test_setFactory() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        assertTrue(registry.authorizedFactories(factory));
    }

    function test_setFactory_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit IMarketRegistry.FactoryAuthorized(factory, true);

        vm.prank(owner);
        registry.setFactory(factory, true);
    }

    function test_setFactory_revertsIfNotOwner() public {
        vm.expectRevert();
        vm.prank(makeAddr("notOwner"));
        registry.setFactory(factory, true);
    }

    function test_registerMarket() public {
        // Authorize factory first
        vm.prank(owner);
        registry.setFactory(factory, true);

        // Register market
        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        // Verify registration
        assertTrue(registry.isRegistered(market1));
        assertTrue(registry.isActive(market1));
        assertEq(registry.marketCount(), 1);
    }

    function test_registerMarket_emitsEvent() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.expectEmit(true, true, true, false);
        emit IMarketRegistry.MarketRegistered(market1, collateralToken, borrowToken);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);
    }

    function test_registerMarket_revertsIfNotAuthorized() public {
        vm.expectRevert();
        vm.prank(makeAddr("unauthorized"));
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);
    }

    function test_registerMarket_revertsIfAlreadyRegistered() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.startPrank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        // Try to register again
        vm.expectRevert();
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);
        vm.stopPrank();
    }

    function test_getMarketInfo() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        IMarketRegistry.MarketInfo memory info = registry.getMarketInfo(market1);
        assertEq(info.market, market1);
        assertEq(info.collateralToken, collateralToken);
        assertEq(info.borrowToken, borrowToken);
        assertEq(info.poolToken, poolToken);
        assertTrue(info.isActive);
        assertGt(info.createdAt, 0);
    }

    function test_setMarketStatus() public {
        // Setup: register a market
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        // Deactivate market
        vm.prank(owner);
        registry.setMarketStatus(market1, false);

        assertFalse(registry.isActive(market1));
        assertTrue(registry.isRegistered(market1));
    }

    function test_setMarketStatus_emitsEvent() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        vm.expectEmit(true, false, false, true);
        emit IMarketRegistry.MarketStatusUpdated(market1, false);

        vm.prank(owner);
        registry.setMarketStatus(market1, false);
    }

    function test_getActiveMarkets() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.startPrank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);
        registry.registerMarket(market2, collateralToken, borrowToken, poolToken);
        vm.stopPrank();

        address[] memory activeMarkets = registry.getActiveMarkets();
        assertEq(activeMarkets.length, 2);
    }

    function test_getMarketsForCollateral() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        address[] memory markets = registry.getMarketsForCollateral(collateralToken);
        assertEq(markets.length, 1);
        assertEq(markets[0], market1);
    }

    function test_getMarketsForBorrow() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        address[] memory markets = registry.getMarketsForBorrow(borrowToken);
        assertEq(markets.length, 1);
        assertEq(markets[0], market1);
    }

    function test_isRegistered() public {
        assertFalse(registry.isRegistered(market1));

        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        assertTrue(registry.isRegistered(market1));
    }

    function test_isActive() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        assertTrue(registry.isActive(market1));

        vm.prank(owner);
        registry.setMarketStatus(market1, false);

        assertFalse(registry.isActive(market1));
    }

    function test_deactivateMarket() public {
        vm.prank(owner);
        registry.setFactory(factory, true);

        vm.prank(factory);
        registry.registerMarket(market1, collateralToken, borrowToken, poolToken);

        vm.prank(owner);
        registry.deactivateMarket(market1);

        assertFalse(registry.isActive(market1));
    }
}
