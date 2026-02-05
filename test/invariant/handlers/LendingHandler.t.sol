// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LendingPool} from "src/core/LendingPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title LendingHandler
/// @notice Handler contract for stateful fuzz testing of LendingPool
/// @dev Acts as intermediary between fuzzer and pool to provide realistic actions
contract LendingHandler is Test {
    LendingPool public pool;
    IERC20 public collateralToken;
    IERC20 public borrowToken;

    // Track actors for fuzzing
    address[] public actors;
    mapping(address => bool) public isActor;

    // Operational bounds
    uint256 constant MAX_DEPOSIT = 1_000_000e6; // 1M USDC
    uint256 constant MAX_COLLATERAL = 100e18; // 100 WETH
    uint256 constant WAD = 1e18;

    // Ghost variables for invariant checks
    uint256 public ghostTotalDeposits; // Sum of all user deposits
    uint256 public ghostTotalBorrows; // Sum of all user borrows
    uint256 public ghostTotalCollateral; // Sum of all user collateral
    uint256 public ghostCallCount;

    // Track per-user state for debugging
    mapping(address => uint256) public userDeposits;
    mapping(address => uint256) public userBorrows;
    mapping(address => uint256) public userCollateral;

    event ActorAdded(address indexed actor);
    event DepositAction(address indexed user, uint256 amount, uint256 shares);
    event WithdrawAction(address indexed user, uint256 amount, uint256 shares);
    event DepositCollateralAction(address indexed user, uint256 amount);
    event WithdrawCollateralAction(address indexed user, uint256 amount);
    event BorrowAction(address indexed user, uint256 amount, uint256 shares);
    event RepayAction(address indexed user, uint256 amount, uint256 shares);
    event AccrueInterestAction(uint256 newBorrowIndex);

    constructor(address _pool, address _collateral, address _borrow) {
        pool = LendingPool(_pool);
        collateralToken = IERC20(_collateral);
        borrowToken = IERC20(_borrow);
    }

    /// @notice Add an actor for fuzzing
    function addActor(address actor) public {
        if (!isActor[actor]) {
            isActor[actor] = true;
            actors.push(actor);
            emit ActorAdded(actor);
        }
    }

    /// @notice Get list of all actors
    function getActors() public view returns (address[] memory) {
        return actors;
    }

    /// @notice Handler: Deposit borrow token to earn interest
    /// @param actorIndex Index into actors array
    /// @param amount Amount to deposit (bounded)
    function deposit(uint256 actorIndex, uint256 amount) public {
        if (actors.length == 0) return;

        address actor = actors[actorIndex % actors.length];
        amount = bound(amount, 1, MAX_DEPOSIT);

        // Ensure actor has tokens and approval
        uint256 balance = borrowToken.balanceOf(actor);
        if (balance < amount) {
            amount = balance;
        }
        if (amount == 0) return;

        vm.startPrank(actor);
        borrowToken.approve(address(pool), amount);
        uint256 shares = pool.deposit(amount);
        vm.stopPrank();

        // Update ghost state
        ghostTotalDeposits += amount;
        userDeposits[actor] += amount;
        ghostCallCount++;

        emit DepositAction(actor, amount, shares);
    }

    /// @notice Handler: Withdraw borrow token
    /// @param actorIndex Index into actors array
    /// @param amount Amount to withdraw (bounded)
    function withdraw(uint256 actorIndex, uint256 amount) public {
        if (actors.length == 0) return;

        address actor = actors[actorIndex % actors.length];

        // Get user's supply (in assets)
        uint256 maxWithdraw = pool.convertToAssets(pool.poolToken().balanceOf(actor));
        if (maxWithdraw == 0) return;

        amount = bound(amount, 1, maxWithdraw);

        vm.startPrank(actor);
        uint256 shares = pool.withdraw(amount);
        vm.stopPrank();

        // Update ghost state
        if (userDeposits[actor] >= amount) {
            ghostTotalDeposits -= amount;
            userDeposits[actor] -= amount;
        }
        ghostCallCount++;

        emit WithdrawAction(actor, amount, shares);
    }

    /// @notice Handler: Deposit collateral
    /// @param actorIndex Index into actors array
    /// @param amount Amount to deposit (bounded)
    function depositCollateral(uint256 actorIndex, uint256 amount) public {
        if (actors.length == 0) return;

        address actor = actors[actorIndex % actors.length];
        amount = bound(amount, 1, MAX_COLLATERAL);

        // Ensure actor has tokens
        uint256 balance = collateralToken.balanceOf(actor);
        if (balance < amount) {
            amount = balance;
        }
        if (amount == 0) return;

        vm.startPrank(actor);
        collateralToken.approve(address(pool), amount);
        pool.depositCollateral(amount);
        vm.stopPrank();

        // Update ghost state
        ghostTotalCollateral += amount;
        userCollateral[actor] += amount;
        ghostCallCount++;

        emit DepositCollateralAction(actor, amount);
    }

    /// @notice Handler: Withdraw collateral
    /// @param actorIndex Index into actors array
    /// @param amount Amount to withdraw (bounded)
    function withdrawCollateral(uint256 actorIndex, uint256 amount) public {
        if (actors.length == 0) return;

        address actor = actors[actorIndex % actors.length];

        // Get user's collateral
        (uint128 collateralAmount,) = pool.positions(actor);
        if (collateralAmount == 0) return;

        amount = bound(amount, 1, collateralAmount);

        vm.startPrank(actor);
        pool.withdrawCollateral(amount);
        vm.stopPrank();

        // Update ghost state (may fail if HF too low, but we catch that)
        if (userCollateral[actor] >= amount) {
            ghostTotalCollateral -= amount;
            userCollateral[actor] -= amount;
        }
        ghostCallCount++;

        emit WithdrawCollateralAction(actor, amount);
    }

    /// @notice Handler: Borrow against collateral
    /// @param actorIndex Index into actors array
    /// @param amount Amount to borrow (bounded)
    function borrow(uint256 actorIndex, uint256 amount) public {
        if (actors.length == 0) return;

        address actor = actors[actorIndex % actors.length];

        // Get max borrow for actor
        uint256 maxBorrow = pool.getMaxBorrow(actor);
        if (maxBorrow == 0) return;

        amount = bound(amount, 1, maxBorrow);

        vm.startPrank(actor);
        uint256 shares = pool.borrow(amount);
        vm.stopPrank();

        // Update ghost state
        ghostTotalBorrows += amount;
        userBorrows[actor] += amount;
        ghostCallCount++;

        emit BorrowAction(actor, amount, shares);
    }

    /// @notice Handler: Repay borrow
    /// @param actorIndex Index into actors array
    /// @param amount Amount to repay (bounded)
    function repay(uint256 actorIndex, uint256 amount) public {
        if (actors.length == 0) return;

        address actor = actors[actorIndex % actors.length];

        // Get user's debt
        uint256 debt = pool.getUserDebt(actor);
        if (debt == 0) return;

        amount = bound(amount, 1, debt + 100); // +100 for rounding

        // Ensure actor has tokens
        uint256 balance = borrowToken.balanceOf(actor);
        if (balance < amount) {
            amount = balance;
        }
        if (amount == 0) return;

        vm.startPrank(actor);
        borrowToken.approve(address(pool), amount);
        uint256 shares = pool.repay(amount);
        vm.stopPrank();

        // Update ghost state
        uint256 actualDebt = pool.getUserDebt(actor);
        if (actualDebt == 0 && userBorrows[actor] > 0) {
            ghostTotalBorrows -= userBorrows[actor];
            userBorrows[actor] = 0;
        }
        ghostCallCount++;

        emit RepayAction(actor, amount, shares);
    }

    /// @notice Handler: Accrue interest
    function accrueInterest() public {
        // uint256 borrowIndexBefore = pool.borrowIndex();
        pool.accrueInterest();
        uint256 borrowIndexAfter = pool.borrowIndex();

        ghostCallCount++;
        emit AccrueInterestAction(borrowIndexAfter);
    }

    /// @notice Handler: Time warp for interest accrual
    /// @param blocks Number of blocks to warp (bounded)
    function timeWarp(uint256 blocks) public {
        blocks = bound(blocks, 1, 365 * 24 * 3600 / 12); // Max 1 year
        vm.warp(block.timestamp + blocks);
        pool.accrueInterest();
        ghostCallCount++;
    }

    // === View Functions ===

    /// @notice Get current pool state
    function getPoolState()
        public
        view
        returns (
            uint256 totalSupply,
            uint256 totalBorrow,
            uint256 totalCollateral,
            uint256 borrowIndex,
            uint256 reserves
        )
    {
        return (
            pool.totalSupplyAssets(),
            pool.totalBorrowAssets(),
            pool.totalCollateral(),
            pool.borrowIndex(),
            pool.totalReserves()
        );
    }

    /// @notice Get user state
    function getUserState(address user)
        public
        view
        returns (uint256 collateral, uint256 borrowShares, uint256 debt, uint256 healthFactor)
    {
        (uint128 col, uint128 shares) = pool.positions(user);
        return (col, shares, pool.getUserDebt(user), pool.healthFactor(user));
    }

    /// @notice Sum of all tracked deposits from ghost state
    function sumGhostDeposits() public view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            sum += userDeposits[actors[i]];
        }
        return sum;
    }

    /// @notice Sum of all tracked borrows from ghost state
    function sumGhostBorrows() public view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            sum += userBorrows[actors[i]];
        }
        return sum;
    }

    /// @notice Sum of all tracked collateral from ghost state
    function sumGhostCollateral() public view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            sum += userCollateral[actors[i]];
        }
        return sum;
    }
}
