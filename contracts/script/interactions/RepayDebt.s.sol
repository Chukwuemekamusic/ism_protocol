// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Script to repay a specific amount of debt in a market
/// @dev Usage:
/// forge script script/interactions/RepayDebt.s.sol:RepayDebt \
/// --sig "run(uint256)" <AMOUNT> \
/// --rpc-url $BASE_SEPOLIA_RPC_URL \
/// --account testnet \
/// --broadcast
///
// Example (repay 0.005 USDC):
// forge script script/interactions/RepayDebt.s.sol:RepayDebt \
// --sig "run(uint256)" 0.005e18 \
/// --rpc-url $BASE_SEPOLIA_RPC_URL \
/// --account testnet \
/// --broadcast
contract RepayDebt is Script {
    address user = vm.envAddress("USER");
    address market = vm.envAddress("MARKET");

    function run(uint256 amount) external {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the borrow token from the market
        IERC20 borrowToken = marketContract.borrowToken();

        console.log("========== Repay Debt ==========");
        console.log("Market:", market);
        console.log("Borrow Token:", address(borrowToken));
        console.log("Repay Amount:", amount);
        console.log("=====================================\n");

        // Check user's position before repayment
        uint256 currentDebt = marketContract.getUserDebt(user);
        uint256 walletBalance = borrowToken.balanceOf(user);
        ILendingPool.Position memory position = marketContract.getPosition(user);

        console.log("--- Position Before Repayment ---");
        console.log("Current Debt:", currentDebt);
        console.log("Wallet Balance:", walletBalance);
        console.log("Collateral Deposited:", position.collateralAmount);

        if (currentDebt > 0) {
            uint256 healthFactorBefore = marketContract.healthFactor(user);
            console.log("Health Factor Before:", healthFactorBefore);
            console.log("Health Factor (readable):", healthFactorBefore / 1e18);
        }
        console.log("=====================================\n");

        // Safety checks
        require(currentDebt > 0, "No debt to repay");
        require(amount <= currentDebt, "Repay amount exceeds current debt");
        require(walletBalance >= amount, "Insufficient balance to repay");

        vm.startBroadcast();

        // Step 1: Approve the market to spend borrow tokens
        console.log("Step 1: Approving borrow token...");
        borrowToken.approve(market, amount);
        console.log("Approved:", amount);

        // Step 2: Repay debt
        console.log("\nStep 2: Repaying debt...");
        uint256 shares = marketContract.repay(amount);
        console.log("Borrow shares burned:", shares);

        vm.stopBroadcast();

        // Check position after repayment
        uint256 newDebt = marketContract.getUserDebt(user);
        uint256 newWalletBalance = borrowToken.balanceOf(user);

        console.log("\n--- Position After Repayment ---");
        console.log("Remaining Debt:", newDebt);
        console.log("New Wallet Balance:", newWalletBalance);

        if (newDebt > 0) {
            uint256 healthFactorAfter = marketContract.healthFactor(user);
            console.log("Health Factor After:", healthFactorAfter);
            console.log("Health Factor (readable):", healthFactorAfter / 1e18);
        } else {
            console.log("Health Factor: INFINITE (no debt)");
        }
        console.log("=====================================\n");

        console.log("Successfully repaid", amount, "tokens");
        if (newDebt > 0) {
            console.log("Remaining debt:", newDebt);
        } else {
            console.log("All debt repaid! You can now withdraw your collateral.");
        }
    }
}

/// @notice Script to repay ALL debt in a market
/// @dev Usage:
// forge script script/interactions/RepayDebt.s.sol:RepayAllDebt \
// --sig "run()" \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet \
// --broadcast
contract RepayAllDebt is Script {
    address user = vm.envAddress("USER");
    address market = vm.envAddress("MARKET");

    function run() external {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the borrow token from the market
        IERC20 borrowToken = marketContract.borrowToken();

        // Get user's current debt (this includes accrued interest)
        uint256 totalDebt = marketContract.getUserDebt(user);

        console.log("========== Repay ALL Debt ==========");
        console.log("Market:", market);
        console.log("Borrow Token:", address(borrowToken));
        console.log("Total Debt to Repay:", totalDebt);
        console.log("=====================================\n");

        // Check wallet balance
        uint256 walletBalance = borrowToken.balanceOf(user);
        ILendingPool.Position memory position = marketContract.getPosition(user);

        console.log("--- Current Position ---");
        console.log("Total Debt:", totalDebt);
        console.log("Wallet Balance:", walletBalance);
        console.log("Collateral Deposited:", position.collateralAmount);

        if (totalDebt > 0) {
            uint256 healthFactorBefore = marketContract.healthFactor(user);
            console.log("Health Factor Before:", healthFactorBefore);
            console.log("Health Factor (readable):", healthFactorBefore / 1e18);
        }
        console.log("=====================================\n");

        // Safety checks
        require(totalDebt > 0, "No debt to repay");
        require(walletBalance >= totalDebt, "Insufficient balance to repay all debt");

        vm.startBroadcast();

        // Step 1: Approve the market to spend borrow tokens
        // Approve slightly more to account for any interest accrual during transaction
        uint256 approvalAmount = totalDebt + (totalDebt / 1000); // Add 0.1% buffer
        console.log("Step 1: Approving borrow token...");
        borrowToken.approve(market, approvalAmount);
        console.log("Approved:", approvalAmount);

        // Step 2: Repay all debt
        console.log("\nStep 2: Repaying all debt...");
        uint256 shares = marketContract.repay(totalDebt);
        console.log("Borrow shares burned:", shares);

        vm.stopBroadcast();

        // Check position after repayment
        uint256 remainingDebt = marketContract.getUserDebt(user);
        uint256 newWalletBalance = borrowToken.balanceOf(user);

        console.log("\n--- Position After Repayment ---");
        console.log("Remaining Debt:", remainingDebt);
        console.log("New Wallet Balance:", newWalletBalance);
        console.log("Collateral Deposited:", position.collateralAmount);
        console.log("=====================================\n");

        if (remainingDebt == 0) {
            console.log("SUCCESS: All debt repaid!");
            console.log("You can now withdraw your collateral if desired.");
        } else {
            console.log("WARNING: Small amount of debt remaining (likely due to interest accrual):", remainingDebt);
            console.log("Run this script again to clear remaining debt.");
        }
    }
}

