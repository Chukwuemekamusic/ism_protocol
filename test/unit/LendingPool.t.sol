// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LendingPool} from "src/core/LendingPool.sol";
import {PoolToken} from "src/core/PoolToken.sol";
import {InterestRateModel} from "src/core/InterestRateModel.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";
import {MockOracle} from "src/mocks/MockOracle.sol";

contract LendingPoolTest is Test {
    LendingPool public pool;
    PoolToken public poolToken;
    InterestRateModel public interestModel;
    MockOracle public oracle;
    MockERC20 public collateralToken;
    MockERC20 public borrowToken;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public liquidator = makeAddr("liquidator");
    address public factory = makeAddr("factory");

    uint256 constant WAD = 1e18;
    uint256 constant COLLATERAL_PRICE = 2000e18; // $2000
    uint256 constant BORROW_PRICE = 1e18; // $1

    function setUp() public {
        // Deploy tokens
        collateralToken = new MockERC20();
        collateralToken.initialize("Wrapped Ether", "WETH", 18);

        borrowToken = new MockERC20();
        borrowToken.initialize("USD Coin", "USDC", 6);

        // Deploy interest rate model
        interestModel = new InterestRateModel(
            0, // 0% base rate
            0.04e18, // 4% slope before kink
            0.75e18, // 75% slope after kink
            0.8e18 // 80% kink
        );

        // Deploy oracle
        oracle = new MockOracle();
        oracle.setPrice(address(collateralToken), COLLATERAL_PRICE);
        oracle.setPrice(address(borrowToken), BORROW_PRICE);

        // Deploy pool and pool token
        pool = new LendingPool();

        poolToken = new PoolToken(address(pool), "Pool Token", "PT");

        // Initialize pool
        pool.initialize(
            ILendingPool.MarketConfig({
                collateralToken: address(collateralToken),
                borrowToken: address(borrowToken),
                interestRateModel: address(interestModel),
                oracleRouter: address(oracle),
                ltv: 0.75e18, // 75%
                liquidationThreshold: 0.8e18, // 80%
                liquidationPenalty: 0.05e18, // 5%
                reserveFactor: 0.1e18 // 10%
            }),
            address(poolToken),
            liquidator,
            factory
        );

        // Mint tokens to users
        collateralToken.mint(alice, 100 ether);
        borrowToken.mint(bob, 100000e6); // 100k USDC
    }

    function test_initialization() public view {
        assertEq(address(pool.collateralToken()), address(collateralToken));
        assertEq(address(pool.borrowToken()), address(borrowToken));
        assertEq(pool.ltv(), 0.75e18);
        assertEq(pool.liquidationThreshold(), 0.8e18);
        assertEq(pool.borrowIndex(), WAD);
    }

    function test_deposit() public {
        uint256 depositAmount = 1000e6; // 1000 USDC

        vm.startPrank(bob);
        borrowToken.approve(address(pool), depositAmount);
        uint256 shares = pool.deposit(depositAmount);
        vm.stopPrank();

        assertEq(shares, depositAmount);
        assertEq(pool.totalSupplyAssets(), depositAmount);
        assertEq(poolToken.balanceOf(bob), shares);
    }

    function test_depositCollateral() public {
        uint256 collateralAmount = 1 ether;

        vm.startPrank(alice);
        collateralToken.approve(address(pool), collateralAmount);
        pool.depositCollateral(collateralAmount);
        vm.stopPrank();

        (uint128 collateral,) = pool.positions(alice);
        assertEq(collateral, collateralAmount);
        assertEq(pool.totalCollateral(), collateralAmount);
    }

    function test_borrow() public {
        // Bob deposits liquidity
        uint256 depositAmount = 10000e6; // 10k USDC
        vm.startPrank(bob);
        borrowToken.approve(address(pool), depositAmount);
        pool.deposit(depositAmount);
        vm.stopPrank();

        // Alice deposits collateral and borrows
        uint256 collateralAmount = 1 ether; // Worth $2000
        uint256 borrowAmount = 1000e6; // Borrow $1000 (50% LTV)

        vm.startPrank(alice);
        collateralToken.approve(address(pool), collateralAmount);
        pool.depositCollateral(collateralAmount);
        pool.borrow(borrowAmount);
        vm.stopPrank();

        assertEq(borrowToken.balanceOf(alice), borrowAmount);
        assertGt(pool.totalBorrowAssets(), 0);
    }

    function test_withdraw() public {
        uint256 depositAmount = 1000e6;

        vm.startPrank(bob);
        borrowToken.approve(address(pool), depositAmount);
        pool.deposit(depositAmount);

        // Withdraw half
        pool.withdraw(depositAmount / 2);
        vm.stopPrank();

        assertEq(borrowToken.balanceOf(bob), 100000e6 - depositAmount / 2);
    }

    function test_repay() public {
        // Setup: Bob deposits, Alice borrows
        uint256 depositAmount = 10000e6;
        vm.startPrank(bob);
        borrowToken.approve(address(pool), depositAmount);
        pool.deposit(depositAmount);
        vm.stopPrank();

        uint256 collateralAmount = 1 ether;
        uint256 borrowAmount = 1000e6;

        vm.startPrank(alice);
        collateralToken.approve(address(pool), collateralAmount);
        pool.depositCollateral(collateralAmount);
        pool.borrow(borrowAmount);

        // Repay
        borrowToken.approve(address(pool), borrowAmount);
        pool.repay(borrowAmount);
        vm.stopPrank();

        (, uint128 borrowShares) = pool.positions(alice);
        assertEq(borrowShares, 0);
    }

    function test_accrueInterest() public {
        // Setup borrow position
        vm.startPrank(bob);
        borrowToken.approve(address(pool), 10000e6);
        pool.deposit(10000e6);
        vm.stopPrank();

        vm.startPrank(alice);
        collateralToken.approve(address(pool), 1 ether);
        pool.depositCollateral(1 ether);
        pool.borrow(1000e6);
        vm.stopPrank();

        uint256 initialBorrowAssets = pool.totalBorrowAssets();

        // Advance time
        vm.warp(block.timestamp + 365 days);

        // Accrue interest
        pool.accrueInterest();

        // Interest should have accrued
        assertGt(pool.totalBorrowAssets(), initialBorrowAssets);
        assertGt(pool.borrowIndex(), WAD);
    }
}
