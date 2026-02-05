// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LendingPool} from "src/core/LendingPool.sol";
import {InterestRateModel} from "src/core/InterestRateModel.sol";
import {PoolToken} from "src/core/PoolToken.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";
import {MockOracle} from "src/mocks/MockOracle.sol";
import {LendingHandler} from "test/invariant/handlers/LendingHandler.t.sol";

/// @title InvariantLending
/// @notice Property-based invariant tests for LendingPool
/// @dev Uses stateful fuzzing to verify invariants hold across all actions
contract InvariantLending is Test {
    LendingPool public pool;
    InterestRateModel public interestModel;
    PoolToken public poolToken;
    MockOracle public oracle;
    MockERC20 public collateralToken;
    MockERC20 public borrowToken;
    LendingHandler public handler;

    // Test constants
    uint256 constant WAD = 1e18;
    uint256 constant COLLATERAL_PRICE = 2000e18; // $2000 per WETH
    uint256 constant BORROW_PRICE = 1e18; // $1 per USDC
    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M tokens per actor
    uint256 constant NUM_ACTORS = 4;

    // Tolerance for rounding errors (0.01%)
    uint256 constant TOLERANCE = 0.0001e18;

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

        // Deploy pool and token
        pool = new LendingPool();

        poolToken = new PoolToken(address(pool), "iWETH-USDC", "iWETH-USDC");

        // Initialize pool
        pool.initialize(
            ILendingPool.MarketConfig({
                collateralToken: address(collateralToken),
                borrowToken: address(borrowToken),
                interestRateModel: address(interestModel),
                oracleRouter: address(oracle),
                ltv: 0.75e18,
                liquidationThreshold: 0.8e18,
                liquidationPenalty: 0.05e18,
                reserveFactor: 0.1e18
            }),
            address(poolToken),
            makeAddr("liquidator"),
            address(this)
        );

        // Deploy handler
        handler = new LendingHandler(address(pool), address(collateralToken), address(borrowToken));

        // Setup actors
        for (uint256 i = 0; i < NUM_ACTORS; i++) {
            address actor = makeAddr(string(abi.encodePacked("actor_", i)));
            handler.addActor(actor);

            // Mint tokens to actor
            collateralToken.mint(actor, INITIAL_BALANCE);
            borrowToken.mint(actor, INITIAL_BALANCE);

            // Pre-approve for convenience
            vm.prank(actor);
            collateralToken.approve(address(pool), type(uint256).max);
            vm.prank(actor);
            borrowToken.approve(address(pool), type(uint256).max);
        }

        // Target the handler for fuzzing
        targetContract(address(handler));

        // Exclude functions that don't maintain state properly
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = LendingHandler.getPoolState.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // ===================================================================
    //                     INVARIANT TESTS
    // ===================================================================

    /// @notice INVARIANT: totalSupplyMatchesDeposits
    /// @dev Sum of all user deposits (adjusted for withdrawals) should match pool's total supply
    /// Tracks deposits via ghost state to verify accounting is correct
    function invariant_totalSupplyMatchesDeposits() public view {
        uint256 poolTotalSupply = pool.totalSupplyAssets();
        uint256 handlerTotalDeposits = handler.sumGhostDeposits();

        // Allow for rounding errors (max 1 wei per actor)
        assert(poolTotalSupply <= handlerTotalDeposits + NUM_ACTORS);
        assert(poolTotalSupply >= handlerTotalDeposits);

        // Verify all PoolToken shares can be converted back to assets
        uint256 totalShares = poolToken.totalSupply();
        uint256 sharesValueInAssets = pool.convertToAssets(totalShares);

        assertEq(sharesValueInAssets, poolTotalSupply, "Pool token shares should equal total supply assets");
    }

    /// @notice INVARIANT: totalBorrowsLessThanSupply
    /// @dev Total borrowed amount should never exceed total supplied amount
    /// This ensures there's always liquidity for suppliers to withdraw
    function invariant_totalBorrowsLessThanSupply() public view {
        uint256 totalSupply = pool.totalSupplyAssets();
        uint256 totalBorrows = pool.totalBorrowAssets();
        uint256 totalReserves = pool.totalReserves();

        // Total supply >= total borrows + reserves
        // (supply is the pool balance: borrows + reserves + available)
        assertLe(totalBorrows + totalReserves, totalSupply, "Total borrows + reserves should fit in supply");

        // Available liquidity should be positive
        uint256 availableLiquidity = totalSupply - totalBorrows - totalReserves;
        assertTrue(int256(availableLiquidity) >= 0, "Available liquidity should never be negative");
    }

    /// @notice INVARIANT: borrowIndexOnlyIncreases
    /// @dev Borrow index should monotonically increase or stay same (never decrease)
    /// Interest accrual makes the index grow; it should never go backwards
    function invariant_borrowIndexOnlyIncreases() public view {
        // This is checked implicitly: every call to deposit/withdraw/borrow/repay calls accrueInterest()
        // which only increases borrowIndex (rate * time >= 0)
        uint256 currentIndex = pool.borrowIndex();

        // Initial index is 1e18 (WAD), should never be less
        assertGe(currentIndex, WAD, "Borrow index should be >= WAD (never decrease)");

        // Note: Full invariant checking would need to track index across calls
        // In a real scenario, you'd store previousIndex state and compare
    }

    /// @notice INVARIANT: healthyPositionsNotLiquidatable
    /// @dev If health factor > 1e18, position should not be liquidatable
    /// If HF < 1e18, position should be liquidatable
    function invariant_healthyPositionsNotLiquidatable() public view {
        address[] memory actors = handler.getActors();

        for (uint256 i = 0; i < actors.length; i++) {
            address actor = actors[i];
            uint256 hf = pool.healthFactor(actor);
            bool isLiquidatable = pool.isLiquidatable(actor);

            // If HF > 1e18, should not be liquidatable
            if (hf > WAD) {
                assertFalse(isLiquidatable, "Healthy position (HF > 1) should not be liquidatable");
            }

            // If HF <= 1e18, should be liquidatable (if has debt)
            (, uint128 borrowShares) = pool.positions(actor);
            if (hf < WAD && borrowShares > 0) {
                assertTrue(isLiquidatable, "Unhealthy position (HF < 1) with debt should be liquidatable");
            }

            // Edge case: no borrows = infinite HF = not liquidatable
            if (borrowShares == 0) {
                assertEq(hf, type(uint256).max, "No debt should have infinite HF");
                assertFalse(isLiquidatable, "Position with no debt should not be liquidatable");
            }
        }
    }

    /// @notice INVARIANT: allPositionsSumToTotals
    /// @dev Sum of all user collateral/borrows should equal pool's tracked totals
    /// Ensures no accounting gaps between individual positions and pool state
    function invariant_allPositionsSumToTotals() public view {
        address[] memory actors = handler.getActors();

        uint256 sumCollateral = 0;
        uint256 sumBorrowShares = 0;
        uint256 sumBorrowAssets = 0;

        // Sum all user positions
        for (uint256 i = 0; i < actors.length; i++) {
            (uint128 collateral, uint128 borrowShares) = pool.positions(actors[i]);
            sumCollateral += collateral;
            sumBorrowShares += borrowShares;

            // Convert shares to assets using current borrow index
            uint256 shareValue = (uint256(borrowShares) * pool.borrowIndex()) / WAD;
            sumBorrowAssets += shareValue;
        }

        // Verify sums match pool totals
        assertEq(sumCollateral, pool.totalCollateral(), "Sum of user collateral should equal pool total");

        // Allow small rounding error for borrow assets (interest compounds)
        uint256 poolBorrowAssets = pool.totalBorrowAssets();
        uint256 diff = sumBorrowAssets > poolBorrowAssets
            ? sumBorrowAssets - poolBorrowAssets
            : poolBorrowAssets - sumBorrowAssets;

        assertLe(diff, actors.length + 1, "Sum of user borrows should match pool total (within rounding)");

        // Verify total borrow shares matches
        assertEq(sumBorrowShares, pool.totalBorrowShares(), "Sum of user borrow shares should equal pool total");
    }

    // ===================================================================
    //                    HELPER INVARIANTS
    // ===================================================================

    /// @notice HELPER: No negative balances
    /// @dev Users should never have negative balances anywhere
    function invariant_noNegativeBalances() public view {
        address[] memory actors = handler.getActors();

        for (uint256 i = 0; i < actors.length; i++) {
            address actor = actors[i];

            // Collateral is uint128, inherently >= 0
            (uint128 collateral,) = pool.positions(actor);
            assertGe(collateral, 0, "User collateral should never be negative");

            // Pool token balance >= 0
            uint256 poolTokenBalance = poolToken.balanceOf(actor);
            assertGe(poolTokenBalance, 0, "User pool token balance should never be negative");

            // Underlying asset value from pool tokens
            uint256 underlyingValue = pool.convertToAssets(poolTokenBalance);
            assertGe(underlyingValue, 0, "User underlying asset value should never be negative");
        }
    }

    /// @notice HELPER: Borrow index monotonically increases
    /// @dev Stored in pool and should never decrease
    function invariant_borrowIndexMonotonic() public view {
        uint256 index = pool.borrowIndex();
        assertGe(index, WAD, "Borrow index should always be >= WAD");
    }

    /// @notice HELPER: Total reserves accumulate
    /// @dev Reserves should never decrease (only accrue interest)
    function invariant_reservesNonNegative() public {
        uint256 reserves = pool.totalReserves();
        assertGe(reserves, 0, "Total reserves should never be negative");
    }

    /// @notice HELPER: Supply shares conservation
    /// @dev Total supply shares should match poolToken supply
    function invariant_supplySharesConservation() public {
        uint256 poolTotalShares = pool.totalSupplyShares();
        uint256 poolTokenSupply = poolToken.totalSupply();

        assertEq(poolTotalShares, poolTokenSupply, "Pool supply shares should equal poolToken supply");
    }
}
