// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {
    AggregatorV3Interface
} from "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Constants} from "script/Constants.s.sol";
import {DeploymentHelper} from "script/DeploymentHelper.sol";

/// @notice Manual health factor calculation bypassing OracleRouter
/// @dev This script calculates health factor using only Chainlink prices directly
/// @dev Run with: forge script script/Diagnose/HealthFactorManual.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL
contract HealthFactorManual is DeploymentHelper {
    // Market pool address read from .env
    address public MARKET = vm.envAddress("MARKET");

    // User address
    address USER = vm.envAddress("USER");

    uint256 constant WAD = 1e18;

    function run() external view {
        console2.log("=== MANUAL HEALTH FACTOR CALCULATION ===\n");
        console2.log("This script bypasses OracleRouter and calculates");
        console2.log("health factor directly using Chainlink prices.\n");

        ILendingPool pool = ILendingPool(MARKET);

        // 1. Get user position
        console2.log("1. USER POSITION:");
        console2.log("   ---------------");
        ILendingPool.Position memory pos = pool.getPosition(USER);
        uint256 userDebt = pool.getUserDebt(USER);

        console2.log("   User: ", USER);
        console2.log("   Collateral Amount (raw): ", pos.collateralAmount);
        console2.log("   Collateral Amount (WETH): ", pos.collateralAmount / 1e18);
        console2.log("   User Debt (raw): ", userDebt);
        console2.log("   User Debt (USDC): ", userDebt / 1e6);
        console2.log("");

        // 2. Get prices directly from Chainlink
        console2.log("2. CHAINLINK PRICES (Direct):");
        console2.log("   --------------------------");

        // WETH price
        (uint256 wethPrice, bool wethSuccess) = getChainlinkPrice(Constants.WETH_USD_FEED, "WETH/USD");
        if (!wethSuccess) {
            console2.log("   ERROR: Failed to get WETH price");
            return;
        }

        // USDC price
        (uint256 usdcPrice, bool usdcSuccess) = getChainlinkPrice(Constants.USDC_USD_FEED, "USDC/USD");
        if (!usdcSuccess) {
            console2.log("   ERROR: Failed to get USDC price");
            return;
        }

        console2.log("");

        // 3. Get pool parameters
        console2.log("3. POOL PARAMETERS:");
        console2.log("   ----------------");
        uint256 ltv = pool.ltv();
        uint256 liquidationThreshold = pool.liquidationThreshold();
        uint256 borrowScalar = pool.borrowScalar();

        console2.log("   LTV (raw): ", ltv);
        console2.log("   LTV (%): ", ltv / 1e16);
        console2.log("   Liquidation Threshold (raw): ", liquidationThreshold);
        console2.log("   Liquidation Threshold (%): ", liquidationThreshold / 1e16);
        console2.log("   Borrow Scalar: ", borrowScalar);
        console2.log("");

        // 4. Manual calculation
        console2.log("4. MANUAL HEALTH FACTOR CALCULATION:");
        console2.log("   ----------------------------------");

        if (userDebt == 0) {
            console2.log("   Health Factor: INFINITE (no debt)");
            console2.log("   Position is safe - no borrowed amount");
            return;
        }

        // Calculate collateral value in USD (18 decimals)
        // collateralAmount is in WETH (18 decimals)
        // wethPrice is in USD (18 decimals)
        // Result: collateralValue in USD (18 decimals)
        uint256 collateralValue = (pos.collateralAmount * wethPrice) / WAD;

        console2.log("   Step 1: Collateral Value");
        console2.log("   - Collateral Amount (WETH): ", pos.collateralAmount / 1e18);
        console2.log("   - WETH Price (USD): $", wethPrice / WAD);
        console2.log("   - Collateral Value (USD): ", collateralValue / WAD);
        console2.log("");

        // Calculate debt value in USD (18 decimals)
        // userDebt is in USDC (6 decimals)
        // borrowScalar converts to 18 decimals (1e12)
        // usdcPrice is in USD (18 decimals)
        uint256 debtIn18Decimals = userDebt * borrowScalar;
        uint256 debtValue = (debtIn18Decimals * usdcPrice) / WAD;

        console2.log("   Step 2: Debt Value");
        console2.log("   - User Debt (USDC): ", userDebt / 1e6);
        console2.log("   - Debt (18 decimals): ", debtIn18Decimals / 1e18);
        console2.log("   - USDC Price (USD): $", usdcPrice / WAD);
        console2.log("   - Debt Value (USD): ", debtValue / WAD);
        console2.log("");

        // Calculate health factor
        // HF = (collateralValue * liquidationThreshold) / debtValue
        // All values are in 18 decimals
        uint256 adjustedCollateral = (collateralValue * liquidationThreshold) / WAD;
        uint256 healthFactor = (adjustedCollateral * WAD) / debtValue;

        console2.log("   Step 3: Health Factor");
        console2.log("   - Formula: HF = (collateralValue * liquidationThreshold) / debtValue");
        console2.log("   - Adjusted Collateral (USD): ", adjustedCollateral / WAD);
        console2.log("   - Debt Value (USD): ", debtValue / WAD);
        console2.log("");
        console2.log("   HEALTH FACTOR (raw): ", healthFactor);
        console2.log("   HEALTH FACTOR: ", healthFactor / WAD, ".", (healthFactor % WAD) / 1e16);
        console2.log("");

        // 5. Analysis
        console2.log("5. POSITION ANALYSIS:");
        console2.log("   ------------------");

        if (healthFactor >= WAD) {
            console2.log("   Status: HEALTHY");
            console2.log("   Position is safe from liquidation");
            uint256 buffer = ((healthFactor - WAD) * 100) / WAD;
            console2.log("   Safety buffer: ", buffer, "%");
        } else {
            console2.log("   Status: LIQUIDATABLE");
            console2.log("   WARNING: Position can be liquidated!");
            uint256 deficit = ((WAD - healthFactor) * 100) / WAD;
            console2.log("   Health deficit: ", deficit, "%");
        }
        console2.log("");

        // Calculate max borrow based on collateral
        uint256 maxBorrowValue = (collateralValue * ltv) / WAD;
        uint256 maxBorrowAmount = (maxBorrowValue * WAD) / usdcPrice;
        uint256 maxBorrowUSDC = maxBorrowAmount / borrowScalar;

        console2.log("   Max Borrow Capacity:");
        console2.log("   - Max Borrow Value: $", maxBorrowValue / WAD);
        console2.log("   - Max Borrow Amount: ", maxBorrowUSDC / 1e6, " USDC");
        console2.log("   - Current Debt: ", userDebt / 1e6, " USDC");
        if (maxBorrowUSDC > userDebt) {
            console2.log("   - Additional Borrow Available: ", (maxBorrowUSDC - userDebt) / 1e6, " USDC");
        } else {
            console2.log("   - OVER BORROWED by: ", (userDebt - maxBorrowUSDC) / 1e6, " USDC");
        }

        console2.log("\n=== END MANUAL CALCULATION ===");
    }

    function getChainlinkPrice(address feed, string memory pairName) internal view returns (uint256, bool) {
        AggregatorV3Interface aggregator = AggregatorV3Interface(feed);

        try aggregator.latestRoundData() returns (uint80 roundId, int256 answer, uint256, uint256 updatedAt, uint80) {
            if (answer <= 0) {
                console2.log("   ", pairName, ": INVALID (price <= 0)");
                return (0, false);
            }

            // Get decimals and normalize to 18
            uint8 decimals = aggregator.decimals();
            uint256 price = uint256(answer);

            if (decimals < 18) {
                price = price * (10 ** (18 - decimals));
            } else if (decimals > 18) {
                price = price / (10 ** (decimals - 18));
            }

            console2.log("   ", pairName);
            console2.log("   - Feed: ", feed);
            console2.log("   - Round ID: ", roundId);
            console2.log("   - Raw Answer: ", uint256(answer));
            console2.log("   - Decimals: ", decimals);
            console2.log("   - Normalized Price (18 dec): ", price);
            console2.log("   - USD Price: $", price / 1e18);
            console2.log("   - Updated At: ", updatedAt);
            console2.log("   - Age: ", block.timestamp - updatedAt, " seconds");

            return (price, true);
        } catch {
            console2.log("   ", pairName, ": FAILED to fetch");
            return (0, false);
        }
    }
}
