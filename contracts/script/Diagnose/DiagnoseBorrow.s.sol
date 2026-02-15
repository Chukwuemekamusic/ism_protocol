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

        uint256 healthFactor = pool.healthFactor(USER);
        console2.log("   Health Factor: ", healthFactor);
        console2.log("   Health Factor (readable): ", healthFactor / 1e18);

        console2.log("");

        // 5. Check Max Borrow
        console2.log("5. BORROW LIMITS:");
        console2.log("   ---------------");
        uint256 maxBorrow = pool.getMaxBorrow(USER);
        console2.log("   Max Borrow: ", maxBorrow);
        console2.log("   Max Borrow (USDC): ", maxBorrow / 1e6);

        console2.log("");

        // 6. Analysis based on contract's own calculation
        console2.log("6. ANALYSIS:");
        console2.log("   ----------");
        console2.log("   (Using contract's getMaxBorrow for accurate calculation)");
        console2.log("");

        // 7. Test Specific Borrow Amount
        console2.log("7. TEST BORROW 3 USDC:");
        console2.log("   --------------------");
        uint256 borrowAmount = 3e6; // 3 USDC
        console2.log("   Attempting to borrow: ", borrowAmount / 1e6, " USDC");

        if (borrowAmount > availableLiquidity) {
            console2.log("   FAIL: Insufficient liquidity in pool");
        } else {
            console2.log("   PASS: Sufficient liquidity available");
        }

        if (borrowAmount > maxBorrow) {
            console2.log("   FAIL: Exceeds max borrow limit");
            console2.log("   Shortfall: ", (borrowAmount - maxBorrow) / 1e6, " USDC");
        } else {
            console2.log("   PASS: Within max borrow limit");
        }

        console2.log("\n=== END DIAGNOSTIC REPORT ===");
    }
}
