// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IOracleRouter} from "../../src/interfaces/IOracleRouter.sol";
import {ILendingPool} from "../../src/interfaces/ILendingPool.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Constants} from "../Constants.s.sol";

/// @title DisableTWAP
/// @notice Script to disable TWAP oracle fallback for all tokens in a market (use Chainlink only)
/// @dev Run with: forge script script/Diagnose/DisableTWAP.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --account testnet --broadcast
/// @dev Usage: Default run() disables TWAP for WETH/USDC, or use runForMarket() for specific market
contract DisableTWAP is Script {
    /// @notice Disable TWAP for a specific market's tokens
    /// @param oracleRouterAddr Address of the OracleRouter contract
    /// @param marketAddr Address of the LendingPool market
    function runForMarket(address oracleRouterAddr, address marketAddr) external {
        vm.startBroadcast();

        IOracleRouter oracleRouter = IOracleRouter(oracleRouterAddr);

        console.log("========== Disable TWAP for Market Tokens ==========");
        console.log("OracleRouter:", oracleRouterAddr);
        console.log("Market:", marketAddr);
        console.log("");

        // Get market tokens
        ILendingPool market = ILendingPool(marketAddr);
        address collateralToken = address(market.collateralToken());
        address borrowToken = address(market.borrowToken());

        string memory collateralSymbol = IERC20Metadata(collateralToken).symbol();
        string memory borrowSymbol = IERC20Metadata(borrowToken).symbol();

        console.log("Collateral Token:", collateralToken, collateralSymbol);
        console.log("Borrow Token:", borrowToken, borrowSymbol);
        console.log("");

        // Disable TWAP for collateral token
        _disableTwapForToken(oracleRouter, collateralToken, collateralSymbol);
        console.log("");

        // Disable TWAP for borrow token
        _disableTwapForToken(oracleRouter, borrowToken, borrowSymbol);
        console.log("");

        console.log("========== Summary ==========");
        console.log("[OK] TWAP disabled for both market tokens");
        console.log("[OK] Markets will now use Chainlink-only pricing");

        vm.stopBroadcast();
    }

    /// @notice Disable TWAP for default WETH/USDC market
    /// @param oracleRouterAddr Address of the OracleRouter contract
    function run(address oracleRouterAddr) external {
        vm.startBroadcast();

        IOracleRouter oracleRouter = IOracleRouter(oracleRouterAddr);

        console.log("========== Disable TWAP for Default Market (WETH/USDC) ==========");
        console.log("OracleRouter:", oracleRouterAddr);
        console.log("");

        // Disable TWAP for WETH
        _disableTwapForToken(oracleRouter, Constants.WETH_BASE_S, "WETH");
        console.log("");

        // Disable TWAP for USDC
        _disableTwapForToken(oracleRouter, Constants.USDC_BASE_S, "USDC");
        console.log("");

        console.log("========== Summary ==========");
        console.log("[OK] TWAP disabled for WETH and USDC");
        console.log("[OK] Markets will now use Chainlink-only pricing");

        vm.stopBroadcast();
    }

    /// @notice Internal function to disable TWAP for a specific token
    /// @param oracleRouter The OracleRouter contract
    /// @param token Address of the token
    /// @param symbol Symbol of the token (for logging)
    function _disableTwapForToken(IOracleRouter oracleRouter, address token, string memory symbol) internal {
        console.log("--- Disabling TWAP for", symbol, "---");

        // Get current configuration
        IOracleRouter.OracleConfig memory currentConfig = oracleRouter.getOracleConfig(token);

        if (currentConfig.chainlinkFeed == address(0)) {
            console.log("[SKIP]", symbol, "oracle not configured");
            return;
        }

        // Check if TWAP is already disabled
        if (currentConfig.uniswapPool == address(0)) {
            console.log("[SKIP]", symbol, "TWAP already disabled");
            console.log("Chainlink feed:", currentConfig.chainlinkFeed);

            // Test getting price
            try oracleRouter.getPrice(token) returns (uint256 price) {
                console.log("Current price:", price / 1e18, "USD");
            } catch {
                console.log("[WARN] Failed to get price");
            }
            return;
        }

        console.log("Current Chainlink feed:", currentConfig.chainlinkFeed);
        console.log("Current Uniswap pool:", currentConfig.uniswapPool);

        // Create new config with TWAP disabled
        IOracleRouter.OracleConfig memory newConfig = IOracleRouter.OracleConfig({
            chainlinkFeed: currentConfig.chainlinkFeed,
            uniswapPool: address(0), // Disable TWAP
            twapWindow: 0,
            maxStaleness: currentConfig.maxStaleness > 0 ? currentConfig.maxStaleness : Constants.TESTNET_MAX_STALENESS, // 4 days for testnet
            isToken0: false // Doesn't matter when TWAP is disabled
        });

        oracleRouter.setOracleConfig(token, newConfig);
        console.log("[OK]", symbol, "oracle reconfigured (Chainlink only)");

        // Verify configuration
        IOracleRouter.OracleConfig memory verifyConfig = oracleRouter.getOracleConfig(token);
        console.log("Verified - TWAP disabled:", verifyConfig.uniswapPool == address(0));

        // Test getting price
        try oracleRouter.getPrice(token) returns (uint256 price) {
            console.log("New price:", price / 1e18, "USD");
        } catch Error(string memory reason) {
            console.log("[ERROR] Failed to get price:", reason);
        } catch {
            console.log("[ERROR] Failed to get price (unknown error)");
        }
    }
}
