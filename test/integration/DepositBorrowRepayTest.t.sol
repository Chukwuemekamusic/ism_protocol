// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {LendingPool} from "../../src/core/LendingPool.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {PoolToken} from "../../src/core/PoolToken.sol";
import {MockOracle} from "../../src/mocks/MockOracle.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MathLib} from "../../src/libraries/MathLib.sol";

contract DepositBorrowRepayTest is Test {
    using MathLib for uint256;

    LendingPool public pool;
    InterestRateModel public interestModel;
    PoolToken public poolToken;
    MockOracle public oracle;
    MockERC20 public weth; // Collateral
    MockERC20 public usdc; // Borrow

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant WAD = 1e18;
    uint256 constant WETH_PRICE = 2000e18; // $2000
    uint256 constant USDC_PRICE = 1e18; // $1
    uint256 constant DEPOSIT_AMOUNT = 10_000e6; // 10,000 USDC (6 decimals)
    uint256 constant INITIAL_USDC = 1_000_000e6; // 1,000,000 USDC
    uint256 constant INITIAL_WETH = 100e18; // 100 WETH

    function setUp() public {
        // Deploy tokens
        weth = new MockERC20();
        weth.initialize("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20();
        usdc.initialize("USD Coin", "USDC", 6);

        // Deploy interest model
        interestModel = new InterestRateModel(
            0, // 0% base rate
            0.04e18, // 4% slope before kink
            0.75e18, // 75% slope after kink
            0.8e18 // 80% kink
        );

        // Deploy oracle
        oracle = new MockOracle();
        oracle.setPrice(address(weth), WETH_PRICE);
        oracle.setPrice(address(usdc), USDC_PRICE);

        // Deploy pool token (need pool address first, so we'll do a workaround)
        // In production, factory would handle this
        address predictedPool = computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        poolToken = new PoolToken(predictedPool, "IP WETH/USDC", "ipWETH-USDC");

        // Deploy pool
        pool = new LendingPool(
            address(weth), // collateral
            address(usdc), // borrow
            address(interestModel),
            address(oracle),
            address(poolToken),
            0.75e18, // 75% LTV
            0.8e18, // 80% liquidation threshold
            0.05e18, // 5% liquidation penalty
            0.1e18 // 10% reserve factor
        );

        // Fund users
        weth.mint(alice, INITIAL_WETH);
        weth.mint(bob, INITIAL_WETH);
        usdc.mint(alice, INITIAL_USDC);
        usdc.mint(bob, INITIAL_USDC);

        // Approvals
        vm.prank(alice);
        weth.approve(address(pool), type(uint256).max);
        vm.prank(alice);
        usdc.approve(address(pool), type(uint256).max);

        vm.prank(bob);
        weth.approve(address(pool), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(pool), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                           DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_deposit_basic() public {
        vm.prank(alice);
        uint256 shares = pool.deposit(DEPOSIT_AMOUNT);

        // FIXED: Initial 1:1 ratio means shares = assets (in asset decimals)
        // When totalShares == 0, we get assets back as shares
        assertEq(shares, DEPOSIT_AMOUNT);
        assertEq(pool.totalSupplyAssets(), DEPOSIT_AMOUNT);
        assertEq(poolToken.balanceOf(alice), shares);

        // verify shares are non-zero and reasonable
        assertGt(shares, 0);

        console.log("Deposit amount:", DEPOSIT_AMOUNT);
        console.log("Shares received:", shares);
    }

    function test_deposit_multipleUsers() public {
        // Alice deposits
        vm.prank(alice);
        pool.deposit(10_000e6);

        // Bob deposits
        vm.prank(bob);
        pool.deposit(5_000e6);

        assertEq(pool.totalSupplyAssets(), 15_000e6);
    }

    function test_deposit_secondDepositorGetsProportionalShares() public {
        // Alice deposits
        vm.prank(alice);
        uint256 aliceShares = pool.deposit(DEPOSIT_AMOUNT);

        // Bob deposits
        vm.prank(bob);
        uint256 bobShares = pool.deposit(DEPOSIT_AMOUNT);

        // Both should get same shares for same deposit (no interest accrued yet)
        assertEq(aliceShares, bobShares, "Equal deposits should get equal shares");
    }
    /*//////////////////////////////////////////////////////////////
                          WITHDRAW TESTS
    //////////////////////////////////////////////////////////////*/

    function test_withdraw_basic() public {
        // Deposit first
        vm.prank(alice);
        pool.deposit(DEPOSIT_AMOUNT);

        uint256 balanceBefore = usdc.balanceOf(alice);

        // Withdraw
        vm.prank(alice);
        pool.withdraw(5_000e6);

        assertEq(pool.totalSupplyAssets(), 5_000e6);
        assertEq(usdc.balanceOf(alice), balanceBefore + 5_000e6);
    }

    function test_withdraw_all() public {
        vm.prank(alice);
        pool.deposit(10_000e6);

        vm.prank(alice);
        pool.withdraw(10_000e6);

        assertEq(pool.totalSupplyAssets(), 0);
        assertEq(poolToken.balanceOf(alice), 0);
    }

    /*//////////////////////////////////////////////////////////////
                         COLLATERAL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_depositCollateral() public {
        vm.prank(alice);
        pool.depositCollateral(10e18); // 10 WETH

        (uint128 collateral, uint128 borrowShares) = getPosition(alice);
        assertEq(collateral, 10e18);
        assertEq(borrowShares, 0);
        assertEq(pool.totalCollateral(), 10e18);
    }

    function test_withdrawCollateral_noBorrow() public {
        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.withdrawCollateral(5e18);

        (uint128 collateral,) = getPosition(alice);
        assertEq(collateral, 5e18);
    }

    /*//////////////////////////////////////////////////////////////
                           BORROW TESTS
    //////////////////////////////////////////////////////////////*/

    function test_borrow_basic() public {
        // Setup: Bob provides liquidity
        vm.prank(bob);
        pool.deposit(100_000e6);

        // Alice deposits collateral and borrows
        vm.prank(alice);
        pool.depositCollateral(10e18); // 10 WETH = $20,000

        // Can borrow up to 75% LTV = $15,000
        vm.prank(alice);
        pool.borrow(10_000e6); // Borrow $10,000 USDC

        assertEq(usdc.balanceOf(alice), INITIAL_USDC + 10_000e6);
        assertGt(pool.healthFactor(alice), WAD); // Still healthy
    }

    function test_borrow_maxLTV() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18); // $20,000 collateral

        // Max borrow at 75% LTV = $15,000
        uint256 alice_maxborrow = pool.getMaxBorrow(alice);
        vm.prank(alice);
        pool.borrow(alice_maxborrow); // Borrow $15,000 USDC
        console.log("Max borrow:", alice_maxborrow);

        // Health factor should be exactly at threshold
        // HF = ($20,000 * 0.80) / $15,000 = 1.0667
        uint256 hf = pool.healthFactor(alice);
        assertGt(hf, WAD);
    }

    function test_borrow_revert_exceedsLTV() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        // Try to borrow more than 75% LTV
        uint256 alice_maxborrow = pool.getMaxBorrow(alice);
        vm.prank(alice);
        vm.expectRevert(LendingPool.WouldBeUndercollateralized.selector);
        pool.borrow(alice_maxborrow + 1); // > $15,000 max
    }

    /*//////////////////////////////////////////////////////////////
                            REPAY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_repay_partial() public {
        // Setup borrow
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(10_000e6);

        // Repay half
        vm.prank(alice);
        pool.repay(5_000e6);

        uint256 debt = pool.getUserDebt(alice);
        assertApproxEqAbs(debt, 5_000e6, 1); // ~5000 USDC remaining
    }

    function test_repay_full() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(10_000e6);

        // Full repay
        vm.prank(alice);
        pool.repay(type(uint256).max);

        assertEq(pool.getUserDebt(alice), 0);
        (, uint128 borrowShares) = getPosition(alice);
        assertEq(borrowShares, 0);
    }

    /*//////////////////////////////////////////////////////////////
                       INTEREST ACCRUAL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_interestAccrual_basic() public {
        vm.prank(bob);
        pool.deposit(100_000e6); // 100k USDC

        vm.prank(alice);
        pool.depositCollateral(40e18); // 40k WETH

        vm.prank(alice);
        pool.borrow(50_000e6); // 50% utilization of 100k USDC

        uint256 debtBefore = pool.getUserDebt(alice);
        console.log("Debt before (1 Year):", debtBefore);

        // Warp 1 year
        vm.warp(block.timestamp + 365 days);
        pool.accrueInterest();

        uint256 debtAfter = pool.getUserDebt(alice);
        console.log("Debt after (1 Year):", debtAfter);

        // At 50% utilization with 4% slope before kink (80%)
        // Rate = 0 + 0.50 * 4% = 2% APR
        // After 1 year: 50,000 * 1.02 = 51,000
        assertApproxEqRel(debtAfter, 51_000e6, 0.01e18); // 1% tolerance
    }

    function test_interestAccrual_suppliersEarn() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(40e18);

        vm.prank(alice);
        pool.borrow(50_000e6);

        uint256 supplyBefore = pool.totalSupplyAssets();
        console.log("Supply before (1 Year):", supplyBefore);

        vm.warp(block.timestamp + 365 days);
        pool.accrueInterest();

        uint256 supplyAfter = pool.totalSupplyAssets();
        console.log("Supply after (1 Year):", supplyAfter);

        // Interest earned = ~2% of 50k = ~1000 USDC
        // After 10% reserve factor: suppliers get ~900 USDC
        uint256 interestEarned = supplyAfter - supplyBefore;
        console.log("Interest earned by suppliers:", interestEarned);

        assertGt(supplyAfter, supplyBefore, "Suppliers should earn interest");
        assertApproxEqRel(interestEarned, 900e6, 0.01e18); // 1% tolerance
    }

    function test_interestAccrual_indexIncreases() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(40e18);

        vm.prank(alice);
        pool.borrow(50_000e6);

        uint256 indexBefore = pool.borrowIndex();

        vm.warp(block.timestamp + 30 days);
        pool.accrueInterest();

        uint256 indexAfter = pool.borrowIndex();

        assertGt(indexAfter, indexBefore, "Borrow index should increase");
        console.log("Index before:", indexBefore);
        console.log("Index after:", indexAfter);
    }

    /*//////////////////////////////////////////////////////////////
                        HEALTH FACTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_healthFactor_noBorrow() public {
        vm.prank(alice);
        pool.depositCollateral(10e18);

        assertEq(pool.healthFactor(alice), type(uint256).max);
    }

    function test_healthFactor_calculation() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18); // 10 WETH = $20,000

        vm.prank(alice);
        pool.borrow(10_000e6); // $10,000 debt

        // Expected HF = ($20,000 * 0.80) / $10,000 = 1.6
        uint256 hf = pool.healthFactor(alice);
        assertApproxEqRel(hf, 1.6e18, 0.01e18, "HF should be ~1.6");

        console.log("Health factor:", hf);
    }

    function test_healthFactor_afterPriceDrop() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(10_000e6);

        uint256 hfBefore = pool.healthFactor(alice);

        // Price drops 20%
        oracle.setPrice(address(weth), 1600e18);

        uint256 hfAfter = pool.healthFactor(alice);

        assertLt(hfAfter, hfBefore);
    }

    function test_isLiquidatable_afterPriceDrop() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18); // $20,000

        vm.prank(alice);
        pool.borrow(15_000e6); // At 75% LTV

        assertFalse(pool.isLiquidatable(alice), "Position should not be liquidatable yet");

        // Price drops 10% -> collateral = $18,000
        // HF = ($18,000 * 0.80) / $15,000 = 0.96 < 1
        oracle.setPrice(address(weth), 1800e18);

        assertTrue(pool.isLiquidatable(alice), "Position should be liquidatable now");

        uint256 hf = pool.healthFactor(alice);
        assertLt(hf, WAD, "HF should be below 1");
        console.log("HF after price drop:", hf);
    }

    /*//////////////////////////////////////////////////////////////
                         WITHDRAWAL CHECKS
    //////////////////////////////////////////////////////////////*/

    function test_withdrawCollateral_revert_wouldUndercollateralize() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(10_000e6);

        // Try to withdraw too much collateral
        vm.prank(alice);
        vm.expectRevert(LendingPool.WouldBeUndercollateralized.selector);
        pool.withdrawCollateral(8e18); // Would leave only $4,000 collateral
    }

    function test_withdrawCollateral_withinSafeLimit() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18); // $20,000

        vm.prank(alice);
        pool.borrow(10_000e6); // $10,000 debt

        // Withdraw 3 ETH (leaves 7 ETH = $14,000)
        // HF = ($14,000 * 0.80) / $10,000 = 1.12 > 1 ✓
        vm.prank(alice);
        pool.withdrawCollateral(3e18);

        LendingPool.Position memory pos = pool.getPosition(alice);
        assertEq(pos.collateralAmount, 7e18);

        uint256 hf = pool.healthFactor(alice);
        assertGt(hf, WAD, "Should still be healthy");
    }

    /*//////////////////////////////////////////////////////////////
                          LIQUIDITY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_withdraw_revert_insufficientLiquidity() public {
        // Bob deposits and alice borrows most of it
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(50e18); // Enough collateral

        vm.prank(alice);
        pool.borrow(70_000e6); // Borrow 80% of liquidity

        // Bob tries to withdraw more than available
        vm.prank(bob);
        vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
        pool.withdraw(40_000e6); // Only 30k available
    }

    function test_borrow_revert_insufficientLiquidity() public {
        vm.prank(bob);
        pool.deposit(10_000e6); // Only 10k liquidity

        vm.prank(alice);
        pool.depositCollateral(50e18); // Plenty of collateral

        vm.prank(alice);
        vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
        pool.borrow(20_000e6); // Try to borrow more than available
    }

    /*//////////////////////////////////////////////////////////////
                            EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function test_repay_moreThanDebt() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        pool.borrow(10_000e6);

        // Try to repay more than owed - should cap at actual debt
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        pool.repay(15_000e6); // More than the 10k debt

        // Should only have paid ~10k (the actual debt)
        uint256 balanceAfter = usdc.balanceOf(alice);
        uint256 actualPaid = balanceBefore - balanceAfter;

        assertApproxEqAbs(actualPaid, 10_000e6, 1, "Should only pay actual debt");
        assertEq(pool.getUserDebt(alice), 0, "Debt should be zero");
    }

    function test_deposit_zeroAmount_reverts() public {
        vm.prank(alice);
        vm.expectRevert(LendingPool.ZeroAmount.selector);
        pool.deposit(0);
    }

    function test_borrow_zeroAmount_reverts() public {
        vm.prank(bob);
        pool.deposit(100_000e6);

        vm.prank(alice);
        pool.depositCollateral(10e18);

        vm.prank(alice);
        vm.expectRevert(LendingPool.ZeroAmount.selector);
        pool.borrow(0);
    }

    /*//////////////////////////////////////////////////////////////
                            HELPERS
    //////////////////////////////////////////////////////////////*/

    function getPosition(address user) internal view returns (uint128, uint128) {
        LendingPool.Position memory pos = pool.getPosition(user);
        return (pos.collateralAmount, pos.borrowShares);
    }
}
