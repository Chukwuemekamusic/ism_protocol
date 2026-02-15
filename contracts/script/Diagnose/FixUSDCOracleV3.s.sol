// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {Constants} from "script/Constants.s.sol";

/// @notice Script to fix USDC oracle configuration - Increase staleness for testnet
/// @dev Run with: forge script script/FixUSDCOracleV3.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --account testnet
contract FixUSDCOracleV3 is Script {
    // Oracle router address from deployment (Base Sepolia)
    address constant ORACLE_ROUTER = 0x2d3083b20FcA2341E28283aC47F9e585a5f0C741;

    // Increased staleness window for testnet (24 hours)
    uint96 constant TESTNET_MAX_STALENESS = 24 hours; // 86400 seconds

    function run() external {
        console2.log("=== FIXING USDC ORACLE CONFIGURATION V3 ===");
        console2.log("(Increasing staleness window for testnet)\n");

        vm.startBroadcast();

        IOracleRouter oracleRouter = IOracleRouter(ORACLE_ROUTER);

        console2.log("Oracle Router:", address(oracleRouter));
        console2.log("USDC Address:", Constants.USDC_BASE_S);
        console2.log("");

        // TESTNET CONFIG: Increased staleness tolerance for USDC
        // Testnet Chainlink feeds don't update as frequently as mainnet
        IOracleRouter.OracleConfig memory usdcConfig = IOracleRouter.OracleConfig({
            chainlinkFeed: Constants.USDC_USD_FEED,
            uniswapPool: address(0), // No fallback for stablecoins
            twapWindow: 0,
            maxStaleness: TESTNET_MAX_STALENESS, // 24 hours for testnet
            isToken0: false
        });

        console2.log("Setting USDC oracle config:");
        console2.log("  Chainlink Feed:", usdcConfig.chainlinkFeed);
        console2.log("  Uniswap Pool:", usdcConfig.uniswapPool, "(NONE)");
        console2.log("  Max Staleness:", usdcConfig.maxStaleness, "seconds (24 hours)");
        console2.log("");
        console2.log("  NOTE: This increased staleness is acceptable for testnet");
        console2.log("        because USDC is a stablecoin and testnet feeds update slowly.");
        console2.log("        For mainnet, use 1 hour (3600 seconds).");

        oracleRouter.setOracleConfig(Constants.USDC_BASE_S, usdcConfig);

        console2.log("\n[OK] USDC oracle configuration updated!");

        vm.stopBroadcast();

        console2.log("\n=== FIX COMPLETE ===");
        console2.log("The USDC oracle now accepts Chainlink data up to 24 hours old.");
        console2.log("This should resolve the staleness issue on Base Sepolia testnet.");
        console2.log("Borrowing should work now!");
    }
}
