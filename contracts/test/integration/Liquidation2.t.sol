// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {LendingPool} from "../../src/core/LendingPool.sol";
import {DutchAuctionLiquidator} from "../../src/core/DutchAuctionLiquidator.sol";
import {IDutchAuctionLiquidator} from "../../src/interfaces/IDutchAuctionLiquidator.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {OracleRouter} from "../../src/core/OracleRouter.sol";
import {IOracleRouter} from "../../src/interfaces/IOracleRouter.sol";
import {ILendingPool} from "../../src/interfaces/ILendingPool.sol";
import {PoolToken} from "../../src/core/PoolToken.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockChainlinkAggregator} from "../../src/mocks/MockChainlinkAggregator.sol";
import {Errors} from "../../src/libraries/Errors.sol";

contract LiquidationFlowTest is Test {
    LendingPool public pool;
    DutchAuctionLiquidator public liquidator;
    OracleRouter public oracle;
    InterestRateModel public interestModel;
    PoolToken public poolToken;

    MockERC20 public weth;
    MockERC20 public usdc;
    MockChainlinkAggregator public wethFeed;
    MockChainlinkAggregator public usdcFeed;

    address public alice = makeAddr("alice"); // Borrower
    address public bob = makeAddr("bob"); // Supplier
    address public charlie = makeAddr("charlie"); // Liquidator

    uint256 constant WAD = 1e18;
    int256 constant INITIAL_ETH_PRICE = 2000e8;

    function setUp() public {
        // Warp to realistic timestamp
        vm.warp(1704067200); // Jan 1, 2024

        // Deploy tokens
        weth = new MockERC20();
        weth.initialize("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20();
        usdc.initialize("USD Coin", "USDC", 6);

        // Deploy Chainlink mocks
        wethFeed = new MockChainlinkAggregator(8);
        wethFeed.setPrice(INITIAL_ETH_PRICE);

        usdcFeed = new MockChainlinkAggregator(8);
        usdcFeed.setPrice(1e8); // $1

        // Deploy oracle router
        oracle = new OracleRouter(address(0));
        oracle.setOracleConfig(
            address(weth),
            IOracleRouter.OracleConfig({
                chainlinkFeed: address(wethFeed),
                uniswapPool: address(0),
                twapWindow: 0,
                maxStaleness: 3600,
                isToken0: true
            })
        );
        oracle.setOracleConfig(
            address(usdc),
            IOracleRouter.OracleConfig({
                chainlinkFeed: address(usdcFeed),
                uniswapPool: address(0),
                twapWindow: 0,
                maxStaleness: 86400,
                isToken0: false
            })
        );

        // Deploy interest model
        interestModel = new InterestRateModel(0, 0.04e18, 0.75e18, 0.8e18);

        // Deploy liquidator first (we need its address for pool initialization)
        liquidator = new DutchAuctionLiquidator(
            address(oracle),
            IDutchAuctionLiquidator.AuctionConfig({
                duration: 1200, // 20 minutes
                startPremium: 1.05e18, // 105%
                endDiscount: 0.95e18, // 95%
                closeFactor: 0.5e18 // 50%
            })
        );

        // Deploy LendingPool
        pool = new LendingPool();

        // Deploy pool token
        poolToken = new PoolToken(address(pool), "IP WETH/USDC", "ipWETH-USDC");

        // Initialize pool with liquidator
        pool.initialize(
            ILendingPool.MarketConfig({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                interestRateModel: address(interestModel),
                oracleRouter: address(oracle),
                ltv: 0.75e18, // 75% LTV
                liquidationThreshold: 0.8e18, // 80% liquidation threshold
                liquidationPenalty: 0.05e18, // 5% liquidation penalty
                reserveFactor: 0.1e18 // 10% reserve factor
            }),
            address(poolToken),
            address(liquidator),
            address(this) // Test contract acts as factory
        );

        // Authorize pool in liquidator
        liquidator.authorizePool(address(pool), true);

        // Fund accounts
        weth.mint(alice, 100e18);
        usdc.mint(bob, 1_000_000e6);
        usdc.mint(charlie, 1_000_000e6);

        // Approvals
        vm.prank(alice);
        weth.approve(address(pool), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(pool), type(uint256).max);

        vm.prank(charlie);
        usdc.approve(address(liquidator), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                      FULL LIQUIDATION FLOW
    //////////////////////////////////////////////////////////////*/

    function test_fullLiquidationFlow() public {
        // 1. Bob supplies liquidity
        vm.prank(bob);
        pool.deposit(100_000e6);

        // 2. Alice deposits collateral and borrows
        vm.prank(alice);
        pool.depositCollateral(10e18); // 10 WETH = $20,000

        vm.prank(alice);
        pool.borrow(15_000e6); // Borrow at 75% LTV

        // 3. Verify Alice is NOT liquidatable
        assertFalse(pool.isLiquidatable(alice));
        uint256 hfBefore = pool.healthFactor(alice);
        console.log("HF before price drop:", hfBefore);

        // 4. Price drops - ETH goes from $2000 to $1800 (10% drop)
        wethFeed.setPrice(1800e8);

        // 5. Verify Alice IS now liquidatable
        assertTrue(pool.isLiquidatable(alice));
        uint256 hfAfter = pool.healthFactor(alice);
        console.log("HF after price drop:", hfAfter);
        assertLt(hfAfter, WAD);

        // 6. Charlie starts auction
        vm.prank(charlie);
        uint256 auctionId = liquidator.startAuction(address(pool), alice);

        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        console.log("Auction debt to repay:", auction.debtToRepay);
        console.log("Auction collateral for sale:", auction.collateralForSale);

        // 7. Wait for price to decay (10 minutes into 20 minute auction)
        vm.warp(block.timestamp + 10 minutes);

        uint256 currentPrice = liquidator.getCurrentPrice(auctionId);
        console.log("Current auction price:", currentPrice);

        // 8. Charlie liquidates
        uint256 charlieUsdcBefore = usdc.balanceOf(charlie);
        uint256 charlieWethBefore = weth.balanceOf(charlie);

        vm.prank(charlie);
        (uint256 debtRepaid, uint256 collateralReceived) = liquidator.liquidate(auctionId, auction.debtToRepay);

        uint256 charlieUsdcAfter = usdc.balanceOf(charlie);
        uint256 charlieWethAfter = weth.balanceOf(charlie);

        console.log("Debt repaid:", debtRepaid);
        console.log("Collateral received:", collateralReceived);
        console.log("Charlie USDC spent:", charlieUsdcBefore - charlieUsdcAfter);
        console.log("Charlie WETH gained:", charlieWethAfter - charlieWethBefore);

        // 9. Verify Alice's position is updated
        ILendingPool.Position memory alicePos = pool.getPosition(alice);
        console.log("Alice remaining collateral:", alicePos.collateralAmount);
        console.log("Alice remaining debt:", pool.getUserDebt(alice));

        // 10. Verify auction state
        IDutchAuctionLiquidator.Auction memory auctionAfter = liquidator.getAuction(auctionId);
        console.log("Auction still active:", auctionAfter.isActive);
    }

    /*//////////////////////////////////////////////////////////////
                        LIQUIDATION PROFIT
    //////////////////////////////////////////////////////////////*/

    function test_liquidatorProfit() public {
        // Setup position
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(15_000e6);

        // Price drop
        wethFeed.setPrice(1800e8);

        // Start auction
        vm.prank(charlie);
        uint256 auctionId = liquidator.startAuction(address(pool), alice);

        // Wait for good price (15 minutes - past midpoint)
        vm.warp(block.timestamp + 15 minutes);

        // Check profit
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        int256 profit = liquidator.calculateProfit(auctionId, auction.debtToRepay);

        console.log("Expected profit:", profit);
        assertGt(profit, 0, "Liquidator should profit");
    }

    /*//////////////////////////////////////////////////////////////
                         EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function test_cannotLiquidateHealthyPosition() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(10_000e6); // Conservative borrow

        vm.prank(charlie);
        vm.expectRevert();
        liquidator.startAuction(address(pool), alice);
    }

    function test_cannotStartDuplicateAuction() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(15_000e6);

        wethFeed.setPrice(1800e8);

        // First auction
        vm.prank(charlie);
        liquidator.startAuction(address(pool), alice);

        // Second auction should fail
        vm.prank(charlie);
        vm.expectRevert();
        liquidator.startAuction(address(pool), alice);
    }

    function test_auctionExpiry() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(15_000e6);

        wethFeed.setPrice(1800e8);

        vm.prank(charlie);
        uint256 auctionId = liquidator.startAuction(address(pool), alice);

        // Warp past auction end (20 minutes + 1 second)
        vm.warp(block.timestamp + 21 minutes);

        // Liquidation should fail (expired)
        vm.prank(charlie);
        vm.expectRevert();
        liquidator.liquidate(auctionId, 1000e6);

        // Can cancel expired auction
        liquidator.cancelExpiredAuction(auctionId);

        // Verify auction is no longer active
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        assertFalse(auction.isActive);
    }

    function test_partialLiquidation() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(15_000e6);

        wethFeed.setPrice(1800e8);

        vm.prank(charlie);
        uint256 auctionId = liquidator.startAuction(address(pool), alice);

        IDutchAuctionLiquidator.Auction memory auctionBefore = liquidator.getAuction(auctionId);

        // Wait for some price decay
        vm.warp(block.timestamp + 10 minutes);

        // Liquidate only half of the auction debt
        uint256 halfDebt = auctionBefore.debtToRepay / 2;

        vm.prank(charlie);
        (uint256 debtRepaid,) = liquidator.liquidate(auctionId, halfDebt);

        // Auction should still be active with remaining debt
        IDutchAuctionLiquidator.Auction memory auctionAfter = liquidator.getAuction(auctionId);

        assertApproxEqAbs(debtRepaid, halfDebt, 1);
        assertTrue(auctionAfter.isActive, "Auction should still be active");
        assertLt(auctionAfter.debtToRepay, auctionBefore.debtToRepay, "Debt should decrease");
    }

    /*//////////////////////////////////////////////////////////////
                        PRICE DECAY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_auctionPriceDecays() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(15_000e6);

        wethFeed.setPrice(1800e8);

        vm.prank(charlie);
        uint256 auctionId = liquidator.startAuction(address(pool), alice);

        uint256 startTime = block.timestamp;

        // Record prices at different times
        uint256 priceAtStart = liquidator.getCurrentPrice(auctionId);
        console.log("Price at start:", priceAtStart);

        vm.warp(startTime + 5 minutes);
        uint256 priceAt5Min = liquidator.getCurrentPrice(auctionId);
        console.log("Price at 5 min:", priceAt5Min);

        vm.warp(startTime + 10 minutes);
        uint256 priceAt10Min = liquidator.getCurrentPrice(auctionId);
        console.log("Price at 10 min:", priceAt10Min);

        vm.warp(startTime + 15 minutes);
        uint256 priceAt15Min = liquidator.getCurrentPrice(auctionId);
        console.log("Price at 15 min:", priceAt15Min);

        vm.warp(startTime + 20 minutes);
        uint256 priceAtEnd = liquidator.getCurrentPrice(auctionId);
        console.log("Price at end:", priceAtEnd);

        // Verify prices decrease over time
        assertGt(priceAtStart, priceAt5Min, "Price should decrease");
        assertGt(priceAt5Min, priceAt10Min, "Price should decrease");
        assertGt(priceAt10Min, priceAt15Min, "Price should decrease");

        // At the end, price should be at or equal to endPrice (can't go lower)
        assertGe(priceAt15Min, priceAtEnd, "Price should decrease or stay at endPrice");

        // Verify start > end overall
        assertGt(priceAtStart, priceAtEnd, "Start price should be greater than end price");

        // Verify we actually reached the end price
        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        assertEq(priceAtEnd, auction.endPrice, "Should reach end price at auction end");
    }

    /*//////////////////////////////////////////////////////////////
                     UNAUTHORIZED ACCESS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_onlyLiquidatorCanLockCollateral() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        // Random address tries to lock collateral
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(Errors.OnlyLiquidator.selector);
        pool.lockCollateralForLiquidation(alice, 5e18);
    }

    function test_onlyLiquidatorCanExecuteLiquidation() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(15_000e6);

        // Random address tries to execute liquidation directly
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(Errors.OnlyLiquidator.selector);
        pool.executeLiquidation(alice, attacker, 5_000e6, 3e18);
    }

    function test_onlyAuthorizedPoolCanBeAuctioned() public {
        // Deploy a new unauthorized pool
        LendingPool unauthorizedPool = new LendingPool();
        PoolToken newPoolToken = new PoolToken(address(unauthorizedPool), "Unauthorized", "UNAUTH");

        unauthorizedPool.initialize(
            ILendingPool.MarketConfig({
                collateralToken: address(weth),
                borrowToken: address(usdc),
                interestRateModel: address(interestModel),
                oracleRouter: address(oracle),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18
            }),
            address(newPoolToken),
            address(liquidator),
            address(this)
        );

        // Note: This pool is NOT authorized in the liquidator

        // Fund and create position in unauthorized pool
        weth.mint(alice, 10e18);
        usdc.mint(bob, 100_000e6);

        vm.prank(alice);
        weth.approve(address(unauthorizedPool), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(unauthorizedPool), type(uint256).max);

        vm.prank(bob);
        unauthorizedPool.deposit(100_000e6);

        vm.prank(alice);
        unauthorizedPool.depositCollateral(10e18);

        vm.prank(alice);
        unauthorizedPool.borrow(15_000e6);

        wethFeed.setPrice(1800e8);

        // Try to start auction - should fail
        vm.prank(charlie);
        vm.expectRevert();
        liquidator.startAuction(address(unauthorizedPool), alice);
    }

    /*//////////////////////////////////////////////////////////////
                        MULTIPLE LIQUIDATORS
    //////////////////////////////////////////////////////////////*/

    function test_multipleLiquidatorsCanParticipate() public {
        address david = makeAddr("david");
        usdc.mint(david, 1_000_000e6);
        vm.prank(david);
        usdc.approve(address(liquidator), type(uint256).max);

        // Setup
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(15_000e6);

        wethFeed.setPrice(1800e8);

        // Charlie starts auction
        vm.prank(charlie);
        uint256 auctionId = liquidator.startAuction(address(pool), alice);

        vm.warp(block.timestamp + 10 minutes);

        IDutchAuctionLiquidator.Auction memory auction = liquidator.getAuction(auctionId);
        uint256 partialDebt = auction.debtToRepay / 3;

        // Charlie liquidates first third
        vm.prank(charlie);
        liquidator.liquidate(auctionId, partialDebt);

        // David liquidates second third
        vm.prank(david);
        liquidator.liquidate(auctionId, partialDebt);

        // Charlie liquidates remaining
        vm.prank(charlie);
        liquidator.liquidate(auctionId, type(uint256).max);

        // Auction should be closed
        IDutchAuctionLiquidator.Auction memory auctionAfter = liquidator.getAuction(auctionId);
        assertFalse(auctionAfter.isActive);
    }
}
