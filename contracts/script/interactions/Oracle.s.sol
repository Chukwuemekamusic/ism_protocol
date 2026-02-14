// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DeploymentHelper} from "../DeploymentHelper.sol";
import {console} from "forge-std/console.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {Constants} from "script/Constants.s.sol";

contract getOracleConfigWETH is DeploymentHelper {
    function run() external view {
        // Load core deployment
        CoreDeployment memory deployment = loadDeployment();

        // Get the market
        IOracleRouter oracleRouter = IOracleRouter(deployment.oracleRouter);

        // Get the oracle config
        IOracleRouter.OracleConfig memory config = oracleRouter.getOracleConfig(Constants.WETH_BASE_S);

        console.log("Oracle Config for:", Constants.WETH_BASE_S);
        console.log("Chainlink Feed:", config.chainlinkFeed);
        console.log("Uniswap Pool:", config.uniswapPool);
        console.log("TWAP Window:", config.twapWindow);
        console.log("Max Staleness:", config.maxStaleness);
        console.log("Is Token0:", config.isToken0);
    }
}
