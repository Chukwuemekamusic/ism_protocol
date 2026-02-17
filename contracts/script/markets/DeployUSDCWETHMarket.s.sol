// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {DeployMarket} from "script/markets/DeployMarket.s.sol";
import {Constants} from "script/Constants.s.sol";

// forge script script/markets/DeployUSDCWETHMarket.s.sol:DeployUSDCWETHMarket \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet \
// --broadcast \
// --verify \
// --etherscan-api-key $ETHERSCAN_API_KEY \
// --slow

/// @title DeployUSDCWETHMarket
/// @notice Script to create a USDC/WETH lending market (USDC collateral, WETH borrow)
/// @dev This creates the reverse pair of the default WETH/USDC market
contract DeployUSDCWETHMarket is DeployMarket {
    function run() external override {
        // Set USDC/WETH market configuration (USDC as collateral, WETH as borrow)
        _setMarketConfig(
            Constants.USDC_BASE_S, // collateral
            Constants.WETH_BASE_S, // borrow
            "USDC", // collateral symbol
            "WETH" // borrow symbol
        );

        // Load core deployment
        CoreDeployment memory deployment = loadDeployment();
        oracleRouterAddr = deployment.oracleRouter;
        marketFactoryAddr = deployment.marketFactory;

        _logDeploymentInfo(deployment.chainId);

        vm.startBroadcast();

        // Step 1: Configure oracle feeds
        console.log("STEP 1: Configuring oracle feeds...");
        _configureOracleFeeds();

        // Step 2: Create market
        console.log("\nSTEP 2: Creating market...");
        address market = _createMarket();

        vm.stopBroadcast();

        // // Step 3: Save market deployment
        // console.log("\nSTEP 3: Saving market deployment...");
        // _saveMarketDeployment(market);

        // _logCompletionInfo(market);
    }
}

