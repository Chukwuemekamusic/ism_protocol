// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Script to withdraw collateral from a specific market
/// @dev Usage:
/// forge script script/interactions/WithdrawCollateral.s.sol:WithdrawCollateral \
/// --sig "run(uint256)" <AMOUNT> \
/// --rpc-url $BASE_SEPOLIA_RPC_URL \
/// --account testnet \
/// --broadcast
///
// Example (withdraw 0.005 WETH):
// forge script script/interactions/WithdrawCollateral.s.sol:WithdrawCollateral \
// --sig "run(uint256)" 0.05e18 \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet \
// --broadcast
contract WithdrawCollateral is Script {
    address user = vm.envAddress("USER");
    address market = vm.envAddress("MARKET");

    function run(uint256 amount) external {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the collateral token from the market
        IERC20 collateralToken = marketContract.collateralToken();

        console.log("========== Withdraw Collateral ==========");
        console.log("Market:", market);
        console.log("Collateral Token:", address(collateralToken));
        console.log("Withdraw Amount:", amount);
        console.log("=====================================\n");

        // Check user's position before withdrawal
        ILendingPool.Position memory positionBefore = marketContract.getPosition(user);
        uint256 currentDebt = marketContract.getUserDebt(user);
        uint256 collateralBalance = collateralToken.balanceOf(user);

        console.log("--- Position Before Withdrawal ---");
        console.log("Collateral Deposited:", positionBefore.collateralAmount);
        console.log("Current Debt:", currentDebt);
        console.log("Wallet Balance:", collateralBalance);

        // Check health factor if user has debt
        if (currentDebt > 0) {
            uint256 healthFactorBefore = marketContract.healthFactor(user);
            console.log("Health Factor Before:", healthFactorBefore);
            console.log("Health Factor (readable):", healthFactorBefore / 1e18);
        }
        console.log("=====================================\n");

        // Safety checks
        require(positionBefore.collateralAmount > 0, "No collateral deposited");
        require(amount <= positionBefore.collateralAmount, "Insufficient collateral balance");

        vm.startBroadcast();

        // Withdraw collateral
        console.log("Withdrawing", amount, "collateral tokens...");
        marketContract.withdrawCollateral(amount);

        vm.stopBroadcast();

        // Check position after withdrawal
        ILendingPool.Position memory positionAfter = marketContract.getPosition(user);
        uint256 newCollateralBalance = collateralToken.balanceOf(user);

        console.log("\n--- Position After Withdrawal ---");
        console.log("Collateral Remaining:", positionAfter.collateralAmount);
        console.log("New Wallet Balance:", newCollateralBalance);

        // Check health factor if user has debt
        if (currentDebt > 0) {
            uint256 healthFactorAfter = marketContract.healthFactor(user);
            console.log("Health Factor After:", healthFactorAfter);
            console.log("Health Factor (readable):", healthFactorAfter / 1e18);

            if (healthFactorAfter < 1e18) {
                console.log("\nWARNING: Your position is now liquidatable!");
                console.log("Consider depositing more collateral or repaying debt.");
            }
        }
        console.log("=====================================\n");

        console.log("Successfully withdrew", amount, "collateral tokens");
        console.log("Tokens sent to your wallet:", user);
    }
}

/// @notice Script to withdraw ALL collateral from a specific market
/// @dev Usage:
// forge script script/interactions/WithdrawCollateral.s.sol:WithdrawAllCollateral \
// --sig "run()" \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet \
// --broadcast
contract WithdrawAllCollateral is Script {
    address user = vm.envAddress("USER");
    address market = vm.envAddress("MARKET");

    function run() external {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the collateral token from the market
        IERC20 collateralToken = marketContract.collateralToken();

        // Get user's position
        ILendingPool.Position memory position = marketContract.getPosition(user);
        uint256 amount = position.collateralAmount;

        console.log("========== Withdraw ALL Collateral ==========");
        console.log("Market:", market);
        console.log("Collateral Token:", address(collateralToken));
        console.log("Total Collateral to Withdraw:", amount);
        console.log("=====================================\n");

        // Safety checks
        require(amount > 0, "No collateral deposited");

        uint256 currentDebt = marketContract.getUserDebt(user);
        require(currentDebt == 0, "Cannot withdraw all collateral while having debt. Repay debt first!");

        vm.startBroadcast();

        // Withdraw all collateral
        console.log("Withdrawing all collateral...");
        marketContract.withdrawCollateral(amount);

        vm.stopBroadcast();

        uint256 newBalance = collateralToken.balanceOf(user);

        console.log("\n--- Withdrawal Complete ---");
        console.log("Collateral Withdrawn:", amount);
        console.log("New Wallet Balance:", newBalance);
        console.log("=====================================\n");

        console.log("Successfully withdrew all collateral!");
    }
}

