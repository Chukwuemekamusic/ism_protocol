// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Diagnostic script to debug borrow failures
/// @dev Run with: forge script script/DiagnoseBorrow.s.sol --rpc-url base_sepolia
contract DiagnoseBorrow is Script {
    // Deployed contracts (Base Sepolia)
    address constant POOL = 0x6deE9CA597a5061EE5D071C84Af8c70d4036c96A;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // User address (replace with your address)
    address constant USER = 0x6E0056fe681E087160BB40dB0Ae3419Ee6C2ECE4;

    function run() external view {
        console2.log("=== BORROW DIAGNOSTIC REPORT ===\n");

        ILendingPool pool = ILendingPool(POOL);

        // 1. Oracle prices - need to get oracle router address directly
        console2.log("1. ORACLE PRICES:");
        console2.log("   -----------------");
        console2.log("   (Oracle router not exposed in interface - will calculate via position values)");
        console2.log("");

        // 2. Check Pool Configuration
        console2.log("2. POOL CONFIGURATION:");
        console2.log("   ---------------------");
        console2.log("   Collateral Token: ", address(pool.collateralToken()));
        console2.log("   Borrow Token: ", address(pool.borrowToken()));
        console2.log("   Collateral Decimals: ", pool.collateralDecimals());
        console2.log("   Borrow Decimals: ", pool.borrowDecimals());
        console2.log("   Borrow Scalar: ", pool.borrowScalar());
        console2.log("   LTV: ", pool.ltv());
        console2.log("   Liquidation Threshold: ", pool.liquidationThreshold());

        console2.log("");

        // 3. Check Pool State
        console2.log("3. POOL STATE:");
        console2.log("   -------------");
        uint256 totalSupplyAssets = pool.totalSupplyAssets();
        uint256 totalBorrowAssets = pool.totalBorrowAssets();
        uint256 availableLiquidity = totalSupplyAssets - totalBorrowAssets;

        console2.log("   Total Supply Assets: ", totalSupplyAssets);
        console2.log("   Total Supply Assets (USDC): ", totalSupplyAssets / 1e6);
        console2.log("   Total Borrow Assets: ", totalBorrowAssets);
        console2.log("   Total Borrow Assets (USDC): ", totalBorrowAssets / 1e6);
        console2.log("   Available Liquidity: ", availableLiquidity);
        console2.log("   Available Liquidity (USDC): ", availableLiquidity / 1e6);
        console2.log("   Total Collateral: ", pool.totalCollateral());
        console2.log("   Total Collateral (WETH): ", pool.totalCollateral() / 1e18);
        console2.log("   Borrow Index: ", pool.borrowIndex());

        console2.log("");

        // 4. Check User Position
        console2.log("4. USER POSITION:");
        console2.log("   ---------------");
        ILendingPool.Position memory pos = pool.getPosition(USER);
        console2.log("   User Address: ", USER);
        console2.log("   Collateral Amount: ", pos.collateralAmount);
        console2.log("   Collateral Amount (WETH): ", pos.collateralAmount / 1e18);
        console2.log("   Borrow Shares: ", pos.borrowShares);

        uint256 userDebt = pool.getUserDebt(USER);
        console2.log("   User Debt: ", userDebt);
        console2.log("   User Debt (USDC): ", userDebt / 1e6);

        // Try to get health factor with error handling
        console2.log("   Attempting to get health factor...");
        try pool.healthFactor(USER) returns (uint256 healthFactor) {
            console2.log("   Health Factor: ", healthFactor);
            console2.log("   Health Factor (readable): ", healthFactor / 1e18);
            console2.log("   Health Factor Status: SUCCESS");
        } catch Error(string memory reason) {
            console2.log("   Health Factor Status: FAILED");
            console2.log("   Error: ", reason);
        } catch (bytes memory) {
            console2.log("   Health Factor Status: FAILED");
            console2.log("   Error: Low-level revert (likely oracle price deviation)");
            console2.log("   Run DiagnoseHealthFactor.s.sol for detailed analysis");
        }

        console2.log("");

        // 5. Check Max Borrow
        console2.log("5. BORROW LIMITS:");
        console2.log("   ---------------");
        console2.log("   Attempting to get max borrow...");
        try pool.getMaxBorrow(USER) returns (uint256 maxBorrow) {
            console2.log("   Max Borrow: ", maxBorrow);
            console2.log("   Max Borrow (USDC): ", maxBorrow / 1e6);
            console2.log("   Max Borrow Status: SUCCESS");
        } catch Error(string memory reason) {
            console2.log("   Max Borrow Status: FAILED");
            console2.log("   Error: ", reason);
        } catch (bytes memory) {
            console2.log("   Max Borrow Status: FAILED");
            console2.log("   Error: Low-level revert (likely oracle price deviation)");
        }

        console2.log("");

        // 6. Recommendations
        console2.log("6. RECOMMENDATIONS:");
        console2.log("   ----------------");
        console2.log("   If health factor failed:");
        console2.log("   1. Run: forge script script/Diagnose/DiagnoseHealthFactor.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL");
        console2.log("   2. Run: forge script script/Diagnose/DiagnoseOracleDetailed.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL");
        console2.log("   3. Run: forge script script/Diagnose/HealthFactorManual.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL");
        console2.log("");
        console2.log("   The manual script will calculate health factor using only Chainlink,");
        console2.log("   bypassing the OracleRouter to confirm the position's actual health.");

        console2.log("\n=== END DIAGNOSTIC REPORT ===");
    }
}
