// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {LendingPool} from "../../src/core/LendingPool.sol";
import {DutchAuctionLiquidator} from "../../src/core/DutchAuctionLiquidator.sol";
import {IDutchAuctionLiquidator} from "../../src/interfaces/IDutchAuctionLiquidator.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {OracleRouter} from "../../src/core/OracleRouter.sol";
import {IOracleRouter} from "../../src/interfaces/IOracleRouter.sol";
import {PoolToken} from "../../src/core/PoolToken.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockChainlinkAggregator} from "../../src/mocks/MockChainlinkAggregator.sol";

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
    int256 constant INITIAL_ETH_PRICE = 2000e8; // $2000
    int256 constant INITIAL_USDC_PRICE = 1e8; // $1

    function setUp() public {
        // Deploy tokens
        weth = new MockERC20();
        weth.initialize("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20();
        usdc.initialize("USD Coin", "USDC", 6);

        // Deploy Chainlink mocks
        wethFeed = new MockChainlinkAggregator(8);
        wethFeed.setPrice(INITIAL_ETH_PRICE);

        usdcFeed = new MockChainlinkAggregator(8);
        usdcFeed.setPrice(INITIAL_USDC_PRICE);

        // Deploy oracle router
        oracle = new OracleRouter(address(0));
        oracle.setOracleConfig(
            address(weth),
            IOracleRouter.OracleConfig({
                chainlinkFeed: address(wethFeed),
                uniswapPool: address(0),
                twapWindow: 1800,
                maxStaleness: 3600,
                isToken0: true
            })
        );
        oracle.setOracleConfig(
            address(usdc),
            IOracleRouter.OracleConfig({
                chainlinkFeed: address(usdcFeed),
                uniswapPool: address(0),
                twapWindow: 1800,
                maxStaleness: 86400,
                isToken0: false
            })
        );

        // Deploy interest model
        interestModel = new InterestRateModel(0, 0.04e18, 0.75e18, 0.8e18);

        // Deploy pool
        address predictedPool = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        poolToken = new PoolToken(predictedPool, "IP WETH/USDC", "ipWETH-USDC");

        pool = new LendingPool(
            address(weth),
            address(usdc),
            address(interestModel),
            address(oracle),
            address(poolToken),
            0.75e18, // 75% LTV
            0.8e18, // 80% liquidation threshold
            0.05e18, // 5% liquidation penalty
            0.1e18 // 10% reserve factor
        );

        // Deploy liquidator
        liquidator = new DutchAuctionLiquidator(
            address(oracle),
            IDutchAuctionLiquidator.AuctionConfig({
                duration: 1200, // 20 minutes
                startPremium: 1.05e18, // 105%
                endDiscount: 0.95e18, // 95%
                closeFactor: 0.5e18 // 50%
            })
        );

        // Configure
        liquidator.authorizePool(address(pool), true);
        pool.setLiquidator(address(liquidator));

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
        LendingPool.Position memory alicePos = pool.getPosition(alice);
        console.log("Alice remaining collateral:", alicePos.collateralAmount);
        console.log("Alice remaining debt:", pool.getUserDebt(alice));

        // 10. Verify auction is closed or has remaining
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

        // Wait for good price
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
        liquidator.startAuction(address(pool), alice);

        // Second auction should fail
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

        uint256 auctionId = liquidator.startAuction(address(pool), alice);

        // Warp past auction end
        vm.warp(block.timestamp + 21 minutes);

        // Liquidation should fail (expired)
        vm.expectRevert();
        liquidator.liquidate(auctionId, 1000e6);

        // Can cancel expired auction
        liquidator.cancelExpiredAuction(auctionId);
    }
}
