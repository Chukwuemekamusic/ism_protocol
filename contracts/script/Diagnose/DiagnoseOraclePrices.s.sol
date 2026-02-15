// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {Constants} from "script/Constants.s.sol";

/// @notice Diagnostic script to check oracle prices directly
contract DiagnoseOraclePrices is Script {
    address constant ORACLE_ROUTER = 0x2d3083b20FcA2341E28283aC47F9e585a5f0C741;
    address constant WETH = Constants.WETH_BASE_S;
    address constant USDC = Constants.USDC_BASE_S;

    function run() external view {
        console2.log("=== ORACLE PRICE DIAGNOSTIC ===\n");

        IOracleRouter oracle = IOracleRouter(ORACLE_ROUTER);

        // Check WETH price
        console2.log("1. WETH PRICE:");
        console2.log("   -----------");
        try oracle.getPrice(WETH) returns (uint256 wethPrice) {
            console2.log("   Raw Price (18 decimals):", wethPrice);
            console2.log("   USD Price:", wethPrice / 1e18);
            console2.log("   Status: SUCCESS");
        } catch Error(string memory reason) {
            console2.log("   Status: FAILED");
            console2.log("   Reason:", reason);
        } catch (bytes memory) {
            console2.log("   Status: FAILED (unknown reason)");
        }

        console2.log("");

        // Check USDC price
        console2.log("2. USDC PRICE:");
        console2.log("   -----------");
        try oracle.getPrice(USDC) returns (uint256 usdcPrice) {
            console2.log("   Raw Price (18 decimals):", usdcPrice);
            console2.log("   USD Price:", usdcPrice / 1e6);
            console2.log("   Status: SUCCESS");
        } catch Error(string memory reason) {
            console2.log("   Status: FAILED");
            console2.log("   Reason:", reason);
        } catch (bytes memory lowLevelData) {
            console2.log("   Status: FAILED");
            // Try to decode custom error
            if (lowLevelData.length >= 4) {
                bytes4 selector = bytes4(lowLevelData);
                console2.log("   Error selector:", uint32(selector));

                // BothOraclesFailed selector: 0x8d0cc992
                if (selector == bytes4(keccak256("BothOraclesFailed(address)"))) {
                    console2.log("   Error: BothOraclesFailed");
                }
            }
        }

        console2.log("\n=== END DIAGNOSTIC ===");
    }
}
