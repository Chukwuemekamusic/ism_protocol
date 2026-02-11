// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MarketFactory} from "src/core/MarketFactory.sol";
import {MarketRegistry} from "src/core/MarketRegistry.sol";
import {LendingPool} from "src/core/LendingPool.sol";
import {InterestRateModel} from "src/core/InterestRateModel.sol";
import {IMarketFactory} from "src/interfaces/IMarketFactory.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";
import {MockOracle} from "src/mocks/MockOracle.sol";

contract MarketFactoryTest is Test {
    MarketFactory public factory;
    MarketRegistry public registry;
    LendingPool public poolImplementation;
    InterestRateModel public interestModel;
    MockOracle public oracle;
    MockERC20 public weth;
    MockERC20 public usdc;

    address public owner = makeAddr("owner");
    address public liquidator = makeAddr("liquidator");

    function setUp() public {
        vm.startPrank(owner);

        // Deploy tokens
        weth = new MockERC20();
        weth.initialize("Wrapped Ether", "WETH", 18);

        usdc = new MockERC20();
        usdc.initialize("USD Coin", "USDC", 6);

        // Deploy core contracts
        poolImplementation = new LendingPool();
        interestModel = new InterestRateModel(0, 0.04e18, 0.75e18, 0.8e18);
        oracle = new MockOracle();
        registry = new MarketRegistry();

        // Deploy factory
        factory = new MarketFactory(
            address(poolImplementation), address(oracle), address(interestModel), liquidator, address(registry)
        );

        // Authorize factory in registry
        registry.setFactory(address(factory), true);

        vm.stopPrank();
    }

    function test_initialization() public view {
        assertEq(factory.lendingPoolImplementation(), address(poolImplementation));
        assertEq(factory.oracleRouter(), address(oracle));
        assertEq(factory.interestRateModel(), address(interestModel));
        assertEq(factory.liquidator(), liquidator);
        assertEq(address(factory.registry()), address(registry));
    }

    function test_createMarket() public {
        vm.prank(owner);
        address market = factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token WETH/USDC",
                poolTokenSymbol: "PT-WETH-USDC"
            })
        );

        // Verify market was created
        assertTrue(market != address(0));
        assertEq(factory.getMarket(address(weth), address(usdc)), market);
        assertTrue(factory.marketExists(address(weth), address(usdc)));
        assertEq(factory.marketCount(), 1);
    }

    function test_createMarket_emitsEvent() public {
        vm.expectEmit(false, true, true, false);
        emit IMarketFactory.MarketCreated(address(0), address(weth), address(usdc), address(0));

        vm.prank(owner);
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token",
                poolTokenSymbol: "PT"
            })
        );
    }

    function test_createMarket_revertsIfNotOwner() public {
        vm.expectRevert();
        vm.prank(makeAddr("notOwner"));
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token",
                poolTokenSymbol: "PT"
            })
        );
    }

    function test_createMarket_revertsIfMarketExists() public {
        vm.startPrank(owner);

        // Create first market
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token",
                poolTokenSymbol: "PT"
            })
        );

        // Try to create duplicate
        vm.expectRevert();
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token 2",
                poolTokenSymbol: "PT2"
            })
        );

        vm.stopPrank();
    }

    function test_getAllMarkets() public {
        vm.startPrank(owner);

        // Create multiple markets
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token 1",
                poolTokenSymbol: "PT1"
            })
        );

        MockERC20 dai = new MockERC20();
        dai.initialize("Dai", "DAI", 18);

        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(dai),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token 2",
                poolTokenSymbol: "PT2"
            })
        );

        vm.stopPrank();

        address[] memory markets = factory.getAllMarkets();
        assertEq(markets.length, 2);
        assertEq(factory.marketCount(), 2);
    }

    function test_marketExists() public {
        assertFalse(factory.marketExists(address(weth), address(usdc)));

        vm.prank(owner);
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18,
                poolTokenName: "Pool Token",
                poolTokenSymbol: "PT"
            })
        );

        assertTrue(factory.marketExists(address(weth), address(usdc)));
    }
}
