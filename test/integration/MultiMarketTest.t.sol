// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {LendingPool} from "src/core/LendingPool.sol";
import {MarketFactory} from "src/core/MarketFactory.sol";
import {MarketRegistry} from "src/core/MarketRegistry.sol";
import {InterestRateModel} from "src/core/InterestRateModel.sol";
import {OracleRouter} from "src/core/OracleRouter.sol";
import {DutchAuctionLiquidator} from "src/core/DutchAuctionLiquidator.sol";
import {IDutchAuctionLiquidator} from "src/interfaces/IDutchAuctionLiquidator.sol";
import {IMarketFactory} from "src/interfaces/IMarketFactory.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";
import {MockChainlinkAggregator} from "src/mocks/MockChainlinkAggregator.sol";
import {Errors} from "src/libraries/Errors.sol";

contract MultiMarketTest is Test {
    // Core infrastructure
    MarketFactory public factory;
    MarketRegistry public registry;
    InterestRateModel public interestModel;
    OracleRouter public oracle;
    DutchAuctionLiquidator public liquidator;
    LendingPool public lendingPoolImpl;

    // Tokens
    MockERC20 public weth;
    MockERC20 public wbtc;
    MockERC20 public usdc;
    MockERC20 public dai;

    // Price feeds
    MockChainlinkAggregator public wethFeed;
    MockChainlinkAggregator public wbtcFeed;
    MockChainlinkAggregator public usdcFeed;
    MockChainlinkAggregator public daiFeed;

    // Markets
    address public wethUsdcMarket;
    address public wbtcUsdcMarket;
    address public wethDaiMarket;

    // Users
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    uint256 constant WAD = 1e18;
    uint64 constant LTV = 0.75e18;
    uint64 constant LIQUIDATION_THRESHOLD = 0.8e18;
    uint64 constant LIQUIDATION_PENALTY = 0.05e18;
    uint64 constant RESERVE_FACTOR = 0.1e18;

    function setUp() public {
        vm.warp(1704067200); // Jan 1, 2024

        // Deploy tokens
        weth = new MockERC20();
        weth.initialize("Wrapped Ether", "WETH", 18);
        wbtc = new MockERC20();
        wbtc.initialize("Wrapped Bitcoin", "WBTC", 8);
        usdc = new MockERC20();
        usdc.initialize("USD Coin", "USDC", 6);
        dai = new MockERC20();
        dai.initialize("Dai", "DAI", 18);

        // Deploy price feeds
        wethFeed = new MockChainlinkAggregator(8);
        wethFeed.setPrice(2000e8); // $2000

        wbtcFeed = new MockChainlinkAggregator(8);
        wbtcFeed.setPrice(40000e8); // $40000

        usdcFeed = new MockChainlinkAggregator(8);
        usdcFeed.setPrice(1e8); // $1

        daiFeed = new MockChainlinkAggregator(8);
        daiFeed.setPrice(1e8); // $1

        // Deploy oracle router
        oracle = new OracleRouter(address(0));
        _configureOracle(address(weth), address(wethFeed));
        _configureOracle(address(wbtc), address(wbtcFeed));
        _configureOracle(address(usdc), address(usdcFeed));
        _configureOracle(address(dai), address(daiFeed));

        // Deploy interest model
        interestModel = new InterestRateModel(0, 0.04e18, 0.75e18, 0.8e18);

        // Deploy registry
        registry = new MarketRegistry();

        // Deploy LendingPool implementation
        lendingPoolImpl = new LendingPool();

        // Deploy liquidator
        liquidator = new DutchAuctionLiquidator(
            address(oracle),
            IDutchAuctionLiquidator.AuctionConfig({
                duration: 1200, startPremium: 1.05e18, endDiscount: 0.95e18, closeFactor: 0.5e18
            })
        );

        // Deploy factory
        factory = new MarketFactory(
            address(lendingPoolImpl), address(oracle), address(interestModel), address(liquidator), address(registry)
        );

        // Authorize factory in registry
        registry.setFactory(address(factory), true);

        // Create markets
        wethUsdcMarket = _createMarket(address(weth), address(usdc), "IP WETH/USDC", "ipWETH-USDC");
        wbtcUsdcMarket = _createMarket(address(wbtc), address(usdc), "IP WBTC/USDC", "ipWBTC-USDC");
        wethDaiMarket = _createMarket(address(weth), address(dai), "IP WETH/DAI", "ipWETH-DAI");

        // Authorize markets in liquidator
        liquidator.authorizePool(wethUsdcMarket, true);
        liquidator.authorizePool(wbtcUsdcMarket, true);
        liquidator.authorizePool(wethDaiMarket, true);

        // Fund users
        _fundUser(alice);
        _fundUser(bob);
        _fundUser(charlie);
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _configureOracle(address token, address feed) internal {
        oracle.setOracleConfig(
            token,
            IOracleRouter.OracleConfig({
                chainlinkFeed: feed, uniswapPool: address(0), twapWindow: 0, maxStaleness: 3600, isToken0: true
            })
        );
    }

    function _createMarket(address collateral, address borrow, string memory name, string memory symbol)
        internal
        returns (address)
    {
        return factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: collateral,
                borrowToken: borrow,
                ltv: LTV,
                liquidationThreshold: LIQUIDATION_THRESHOLD,
                liquidationPenalty: LIQUIDATION_PENALTY,
                reserveFactor: RESERVE_FACTOR,
                poolTokenName: name,
                poolTokenSymbol: symbol
            })
        );
    }

    function _fundUser(address user) internal {
        weth.mint(user, 100e18);
        wbtc.mint(user, 10e8);
        usdc.mint(user, 1_000_000e6);
        dai.mint(user, 1_000_000e18);

        vm.startPrank(user);
        weth.approve(wethUsdcMarket, type(uint256).max);
        weth.approve(wethDaiMarket, type(uint256).max);
        wbtc.approve(wbtcUsdcMarket, type(uint256).max);
        usdc.approve(wethUsdcMarket, type(uint256).max);
        usdc.approve(wbtcUsdcMarket, type(uint256).max);
        dai.approve(wethDaiMarket, type(uint256).max);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        FACTORY & REGISTRY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_factoryCreatesMarkets() public view {
        assertEq(factory.marketCount(), 3);
        assertEq(factory.getMarket(address(weth), address(usdc)), wethUsdcMarket);
        assertEq(factory.getMarket(address(wbtc), address(usdc)), wbtcUsdcMarket);
        assertEq(factory.getMarket(address(weth), address(dai)), wethDaiMarket);
    }

    function test_registryTracksMarkets() public view {
        assertEq(registry.marketCount(), 3);
        assertTrue(registry.isRegistered(wethUsdcMarket));
        assertTrue(registry.isActive(wethUsdcMarket));

        address[] memory usdcMarkets = registry.getMarketsForBorrow(address(usdc));
        assertEq(usdcMarkets.length, 2);

        address[] memory wethMarkets = registry.getMarketsForCollateral(address(weth));
        assertEq(wethMarkets.length, 2);
    }

    function test_cannotCreateDuplicateMarket() public {
        vm.expectRevert();
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                ltv: LTV,
                liquidationThreshold: LIQUIDATION_THRESHOLD,
                liquidationPenalty: LIQUIDATION_PENALTY,
                reserveFactor: RESERVE_FACTOR,
                poolTokenName: "Duplicate",
                poolTokenSymbol: "DUP"
            })
        );
    }

    /*//////////////////////////////////////////////////////////////
                        MARKET ISOLATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_marketsAreIsolated() public {
        // Alice supplies to WETH/USDC market
        vm.startPrank(alice);
        ILendingPool(wethUsdcMarket).deposit(50_000e6);
        ILendingPool(wethUsdcMarket).depositCollateral(10e18);
        vm.stopPrank();

        // Bob supplies to WBTC/USDC market
        vm.startPrank(bob);
        ILendingPool(wbtcUsdcMarket).deposit(50_000e6);
        ILendingPool(wbtcUsdcMarket).depositCollateral(1e8);
        vm.stopPrank();

        // Verify isolated state
        assertEq(ILendingPool(wethUsdcMarket).totalSupplyAssets(), 50_000e6);
        assertEq(ILendingPool(wbtcUsdcMarket).totalSupplyAssets(), 50_000e6);

        assertEq(ILendingPool(wethUsdcMarket).totalCollateral(), 10e18);
        assertEq(ILendingPool(wbtcUsdcMarket).totalCollateral(), 1e8);
    }

    function test_priceDropInOneMarketDoesNotAffectOther() public {
        // Setup positions in both markets
        vm.startPrank(bob);
        ILendingPool(wethUsdcMarket).deposit(100_000e6);
        ILendingPool(wbtcUsdcMarket).deposit(100_000e6);
        vm.stopPrank();

        vm.startPrank(alice);
        ILendingPool(wethUsdcMarket).depositCollateral(10e18);
        ILendingPool(wethUsdcMarket).borrow(15_000e6);

        ILendingPool(wbtcUsdcMarket).depositCollateral(1e8);
        ILendingPool(wbtcUsdcMarket).borrow(30_000e6);
        vm.stopPrank();

        // Drop WETH price
        wethFeed.setPrice(1800e8);

        // WETH market affected
        assertTrue(ILendingPool(wethUsdcMarket).isLiquidatable(alice));

        // WBTC market NOT affected
        assertFalse(ILendingPool(wbtcUsdcMarket).isLiquidatable(alice));
    }

    /*//////////////////////////////////////////////////////////////
                      MULTI-MARKET USER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_userCanHavePositionsInMultipleMarkets() public {
        vm.startPrank(bob);
        ILendingPool(wethUsdcMarket).deposit(100_000e6);
        ILendingPool(wbtcUsdcMarket).deposit(100_000e6);
        ILendingPool(wethDaiMarket).deposit(100_000e18);
        vm.stopPrank();

        vm.startPrank(alice);
        // Position in WETH/USDC
        ILendingPool(wethUsdcMarket).depositCollateral(5e18);
        ILendingPool(wethUsdcMarket).borrow(5_000e6);

        // Position in WBTC/USDC
        ILendingPool(wbtcUsdcMarket).depositCollateral(0.5e8);
        ILendingPool(wbtcUsdcMarket).borrow(10_000e6);

        // Position in WETH/DAI
        ILendingPool(wethDaiMarket).depositCollateral(5e18);
        ILendingPool(wethDaiMarket).borrow(5_000e18);
        vm.stopPrank();

        // Verify all positions
        ILendingPool.Position memory pos1 = ILendingPool(wethUsdcMarket).getPosition(alice);
        ILendingPool.Position memory pos2 = ILendingPool(wbtcUsdcMarket).getPosition(alice);
        ILendingPool.Position memory pos3 = ILendingPool(wethDaiMarket).getPosition(alice);

        assertEq(pos1.collateralAmount, 5e18);
        assertEq(pos2.collateralAmount, 0.5e8);
        assertEq(pos3.collateralAmount, 5e18);
    }

    /*//////////////////////////////////////////////////////////////
                        CROSS-MARKET LIQUIDITY
    //////////////////////////////////////////////////////////////*/

    function test_liquidityIsIsolatedPerMarket() public {
        // Bob provides different amounts to each market
        vm.startPrank(bob);
        ILendingPool(wethUsdcMarket).deposit(100_000e6);
        ILendingPool(wbtcUsdcMarket).deposit(50_000e6);
        vm.stopPrank();

        // Alice can borrow more from WETH market
        vm.startPrank(alice);
        ILendingPool(wethUsdcMarket).depositCollateral(50e18); // $100k collateral
        ILendingPool(wbtcUsdcMarket).depositCollateral(2e8); // $80k collateral

        // Can borrow up to 75k from WETH market (limited by LTV)
        ILendingPool(wethUsdcMarket).borrow(70_000e6);

        // Can only borrow up to 50k from WBTC market (limited by liquidity)
        vm.expectRevert(Errors.InsufficientLiquidity.selector);
        ILendingPool(wbtcUsdcMarket).borrow(55_000e6);

        // But can borrow within liquidity
        ILendingPool(wbtcUsdcMarket).borrow(45_000e6);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                       INTEREST RATE ISOLATION
    //////////////////////////////////////////////////////////////*/

    function test_interestRatesAreIndependent() public {
        // Bob provides same amount to each market
        vm.startPrank(bob);
        ILendingPool(wethUsdcMarket).deposit(100_000e6);
        ILendingPool(wbtcUsdcMarket).deposit(100_000e6);
        vm.stopPrank();

        // Different utilization in each market
        vm.startPrank(alice);
        ILendingPool(wethUsdcMarket).depositCollateral(50e18);
        ILendingPool(wethUsdcMarket).borrow(70_000e6); // 70% utilization

        ILendingPool(wbtcUsdcMarket).depositCollateral(2e8);
        ILendingPool(wbtcUsdcMarket).borrow(20_000e6); // 20% utilization
        vm.stopPrank();

        // Warp time
        vm.warp(block.timestamp + 365 days);

        ILendingPool(wethUsdcMarket).accrueInterest();
        ILendingPool(wbtcUsdcMarket).accrueInterest();

        // Higher utilization = higher interest accrued
        uint256 wethDebt = ILendingPool(wethUsdcMarket).getUserDebt(alice);
        uint256 wbtcDebt = ILendingPool(wbtcUsdcMarket).getUserDebt(alice);

        // WETH market at 70% util should have higher rate than WBTC at 20%
        // (70k * higher_rate) > (20k * lower_rate) even though principal ratio is 4:1
        uint256 wethInterest = wethDebt - 70_000e6;
        uint256 wbtcInterest = wbtcDebt - 20_000e6;

        // Interest rate at 70% util should be much higher
        uint256 wethInterestRate = wethInterest * 100 / 70_000e6;
        uint256 wbtcInterestRate = wbtcInterest * 100 / 20_000e6;

        assertGt(wethInterestRate, wbtcInterestRate, "Higher util should have higher rate");
    }

    /*//////////////////////////////////////////////////////////////
                        REGISTRY ADMIN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_canDeactivateMarket() public {
        assertTrue(registry.isActive(wethUsdcMarket));

        registry.setMarketStatus(wethUsdcMarket, false);

        assertFalse(registry.isActive(wethUsdcMarket));
        assertTrue(registry.isRegistered(wethUsdcMarket)); // Still registered

        address[] memory activeMarkets = registry.getActiveMarkets();
        assertEq(activeMarkets.length, 2);
    }

    function test_onlyOwnerCanCreateMarket() public {
        address notOwner = makeAddr("notOwner");

        vm.prank(notOwner);
        vm.expectRevert();
        factory.createMarket(
            IMarketFactory.CreateMarketParams({
                collateralToken: address(weth),
                borrowToken: address(dai),
                ltv: LTV,
                liquidationThreshold: LIQUIDATION_THRESHOLD,
                liquidationPenalty: LIQUIDATION_PENALTY,
                reserveFactor: RESERVE_FACTOR,
                poolTokenName: "Test",
                poolTokenSymbol: "TEST"
            })
        );
    }
}
