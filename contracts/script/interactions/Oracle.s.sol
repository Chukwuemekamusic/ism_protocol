// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DeploymentHelper} from "../DeploymentHelper.sol";
import {console} from "forge-std/console.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {Constants} from "script/Constants.s.sol";

contract getOracleConfig is DeploymentHelper {
    function run() external view {
        // Load core deployment
        CoreDeployment memory deployment = loadDeployment();

        // Get the market
        IOracleRouter oracleRouter = IOracleRouter(deployment.oracleRouter);

        // Get the oracle config
        IOracleRouter.OracleConfig memory configWETH = oracleRouter.getOracleConfig(Constants.WETH_BASE_S);
        IOracleRouter.OracleConfig memory configUSDC = oracleRouter.getOracleConfig(Constants.USDC_BASE_S);

        console.log("Oracle Config for:", Constants.WETH_BASE_S);
        console.log("Chainlink Feed:", configWETH.chainlinkFeed);
        console.log("Uniswap Pool:", configWETH.uniswapPool);
        console.log("TWAP Window:", configWETH.twapWindow);
        console.log("Max Staleness:", configWETH.maxStaleness);
        console.log("Is Token0:", configWETH.isToken0);

        console.log("\nOracle Config for:", Constants.USDC_BASE_S);
        console.log("Chainlink Feed:", configUSDC.chainlinkFeed);
        console.log("Uniswap Pool:", configUSDC.uniswapPool);
        console.log("TWAP Window:", configUSDC.twapWindow);
        console.log("Max Staleness:", configUSDC.maxStaleness);
        console.log("Is Token0:", configUSDC.isToken0);
    }
}
