// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/console2.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {DeploymentHelper} from "script/DeploymentHelper.sol";
import {Constants} from "script/Constants.s.sol";

/// @notice Diagnostic script to debug health factor calculation
/// @dev Run with: forge script script/Diagnose/DiagnoseHealthFactor.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL sig "run(address)" 0x6deE9CA597a5061EE5D071C84Af8c70d4036c96A
contract DiagnoseHealthFactor is DeploymentHelper {
    // User address read from .env
    address public USER = vm.envAddress("USER");

    function run(address market) external view {
        CoreDeployment memory deployment = loadDeployment();
        console2.log("=== HEALTH FACTOR DIAGNOSTIC ===\n");

        ILendingPool pool = ILendingPool(market);
        IOracleRouter oracle = IOracleRouter(deployment.oracleRouter);

        // 1. Get user position data
        console2.log("1. USER POSITION DATA:");
        console2.log("   -------------------");
        ILendingPool.Position memory pos = pool.getPosition(USER);
        uint256 userDebt = pool.getUserDebt(USER);

        console2.log("   User: ", USER);
        console2.log("   Collateral Amount (raw): ", pos.collateralAmount);
        console2.log("   Collateral Amount (WETH): ", pos.collateralAmount / 1e18);
        console2.log("   Borrow Shares: ", pos.borrowShares);
        console2.log("   User Debt (raw): ", userDebt);
        console2.log("   User Debt (USDC): ", userDebt / 1e6);
        console2.log("");

        // 2. Try to get oracle prices with error handling
        console2.log("2. ORACLE PRICES:");
        console2.log("   --------------");

        // Try WETH price
        console2.log("   Attempting to get WETH price...");
        try oracle.getPrice(Constants.WETH_BASE_S) returns (uint256 wethPrice) {
            console2.log("   WETH Price (raw): ", wethPrice);
            console2.log("   WETH Price (USD): $", wethPrice / 1e18);
            console2.log("   Status: SUCCESS");
        } catch Error(string memory reason) {
            console2.log("   Status: FAILED");
            console2.log("   Error: ", reason);
        } catch (bytes memory lowLevelData) {
            console2.log("   Status: FAILED (low-level error)");
            console2.log("   Error data length: ", lowLevelData.length);

            // Try to decode PriceDeviationTooHigh error
            if (lowLevelData.length >= 4) {
                bytes4 errorSelector = bytes4(lowLevelData);
                console2.log("   Error selector: ");
                console2.logBytes4(errorSelector);

                // PriceDeviationTooHigh(address,uint256,uint256) selector = 0x...
                if (lowLevelData.length >= 100) {
                    // Decode the error parameters
                    (address token, uint256 price1, uint256 price2) =
                        abi.decode(_slice(lowLevelData, 4, lowLevelData.length - 4), (address, uint256, uint256));
                    console2.log("   Token: ", token);
                    console2.log("   Price 1 (raw): ", price1);
                    console2.log("   Price 1 (USD): $", price1 / 1e18);
                    console2.log("   Price 2 (raw): ", price2);
                    console2.log("   Price 2 (USD): $", price2 / 1e18);

                    // Calculate deviation
                    uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
                    uint256 avg = (price1 + price2) / 2;
                    uint256 deviation = avg > 0 ? (diff * 1e18) / avg : 0;
                    console2.log("   Deviation (raw): ", deviation);
                    console2.log("   Deviation (%): ", deviation / 1e16);
                }
            }
        }
        console2.log("");

        // Try USDC price
        console2.log("   Attempting to get USDC price...");
        try oracle.getPrice(Constants.USDC_BASE_S) returns (uint256 usdcPrice) {
            console2.log("   USDC Price (raw): ", usdcPrice);
            console2.log("   USDC Price (USD): $", usdcPrice / 1e18);
            console2.log("   Status: SUCCESS");
        } catch Error(string memory reason) {
            console2.log("   Status: FAILED");
            console2.log("   Error: ", reason);
        } catch {
            console2.log("   Status: FAILED (unknown reason)");
        }
        console2.log("");

        // 3. Try to calculate health factor
        console2.log("3. HEALTH FACTOR CALCULATION:");
        console2.log("   --------------------------");
        console2.log("   Attempting to get health factor from contract...");

        try pool.healthFactor(USER) returns (uint256 hf) {
            console2.log("   Health Factor (raw): ", hf);
            console2.log("   Health Factor (readable): ", hf / 1e18);
            console2.log("   Status: SUCCESS");

            if (hf < 1e18) {
                console2.log("   WARNING: Position is liquidatable!");
            } else {
                console2.log("   Position is healthy");
            }
        } catch Error(string memory reason) {
            console2.log("   Status: FAILED");
            console2.log("   Error: ", reason);
        } catch (bytes memory lowLevelData) {
            console2.log("   Status: FAILED (reverted with low-level error)");
            console2.log("   This is likely due to the oracle price deviation issue");
        }
        console2.log("");

        // 4. Manual health factor calculation (if we can get prices)
        console2.log("4. MANUAL CALCULATION (if oracle works):");
        console2.log("   --------------------------------------");
        console2.log("   Note: This will only work if oracle prices are accessible");
        console2.log("");
        console2.log("   Formula: HF = (collateralValue * liquidationThreshold) / debtValue");
        console2.log("   Where:");
        console2.log("   - collateralValue = collateralAmount * collateralPrice");
        console2.log("   - debtValue = debtAmount * borrowPrice");
        console2.log("   - liquidationThreshold = ", pool.liquidationThreshold());
        console2.log("   - liquidationThreshold (%): ", pool.liquidationThreshold() / 1e16);
        console2.log("");

        // Try manual calculation
        try oracle.getPrice(Constants.WETH_BASE_S) returns (uint256 wethPrice) {
            try oracle.getPrice(Constants.USDC_BASE_S) returns (uint256 usdcPrice) {
                // Calculate collateral value
                uint256 collateralValue = (pos.collateralAmount * wethPrice) / 1e18;
                console2.log("   Collateral Value (raw): ", collateralValue);
                console2.log("   Collateral Value (USD): $", collateralValue / 1e18);

                // Calculate debt value
                uint256 debtValue = (userDebt * pool.borrowScalar() * usdcPrice) / 1e18;
                console2.log("   Debt Value (raw): ", debtValue);
                console2.log("   Debt Value (USD): $", debtValue / 1e18);

                // Calculate health factor
                if (userDebt == 0) {
                    console2.log("   Health Factor: INFINITE (no debt)");
                } else {
                    uint256 manualHF = (collateralValue * pool.liquidationThreshold()) / debtValue;
                    console2.log("   Manual Health Factor (raw): ", manualHF);
                    console2.log("   Manual Health Factor (readable): ", manualHF / 1e18);
                }
            } catch {
                console2.log("   Cannot calculate: USDC price failed");
            }
        } catch {
            console2.log("   Cannot calculate: WETH price failed");
        }

        console2.log("\n=== END DIAGNOSTIC ===");
    }

    /// @dev Helper function to slice bytes
    function _slice(bytes memory data, uint256 start, uint256 length) private pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }
}
