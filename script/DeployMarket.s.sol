// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {DeploymentHelper} from "./DeploymentHelper.sol";
import {Constants} from "./Constants.s.sol";

// Interfaces
import {IMarketFactory} from "src/interfaces/IMarketFactory.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";

/// @title DeployMarket
/// @notice Script to create a new lending market using existing core infrastructure
/// @dev Reads core contract addresses from deployment JSON and creates a market
contract DeployMarket is DeploymentHelper {
    /*//////////////////////////////////////////////////////////////
                        EXAMPLE MARKET CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    // Note: Using constants from Constants.s.sol library for cleaner code

    /*//////////////////////////////////////////////////////////////
                            MAIN FUNCTION
    //////////////////////////////////////////////////////////////*/

    function run() external {
        // Load core deployment
        CoreDeployment memory deployment = loadDeployment();

        console.log("========== ISM Protocol Market Deployment ==========");
        console.log("Chain ID:", deployment.chainId);
        console.log("Using MarketFactory:", deployment.marketFactory);
        console.log("Using OracleRouter:", deployment.oracleRouter);
        console.log("================================================\n");

        // Get deployer key
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        // Step 1: Configure oracle feeds (if not already configured)
        console.log("\nSTEP 1: Configuring oracle feeds...");
        configureOracleFeeds(deployment.oracleRouter);

        // Step 2: Create market
        console.log("\nSTEP 2: Creating WETH/USDC market...");
        address market = createMarket(deployment.marketFactory);

        vm.stopBroadcast();

        console.log("\n========== Market Deployment Complete ==========");
        console.log("Market Address:", market);
        console.log("Collateral (WETH):", Constants.WETH_BASE_S);
        console.log("Borrow Asset (USDC):", Constants.USDC_BASE_S);
        console.log("==============================================\n");
    }

    /*//////////////////////////////////////////////////////////////
                        DEPLOYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Configure oracle feeds for WETH and USDC
    function configureOracleFeeds(address oracleRouterAddr) internal {
        IOracleRouter oracleRouter = IOracleRouter(oracleRouterAddr);

        // Configure WETH oracle
        if (!oracleRouter.isConfigured(Constants.WETH_BASE_S)) {
            console.log("Configuring WETH oracle...");
            IOracleRouter.OracleConfig memory wethConfig = IOracleRouter.OracleConfig({
                chainlinkFeed: Constants.WETH_USD_FEED,
                uniswapPool: Constants.WETH_USDC_POOL,
                twapWindow: 30 minutes,
                maxStaleness: 1 hours,
                isToken0: false // WETH is token1 in WETH/USDC pool (verified on Base Sepolia)
            });
            oracleRouter.setOracleConfig(Constants.WETH_BASE_S, wethConfig);
            console.log("[OK] WETH oracle configured");
        } else {
            console.log("[SKIP] WETH oracle already configured");
        }

        // Configure USDC oracle
        if (!oracleRouter.isConfigured(Constants.USDC_BASE_S)) {
            console.log("Configuring USDC oracle...");
            IOracleRouter.OracleConfig memory usdcConfig = IOracleRouter.OracleConfig({
                chainlinkFeed: Constants.USDC_USD_FEED,
                uniswapPool: address(0), // No fallback for stablecoin
                twapWindow: 0,
                maxStaleness: 1 hours,
                isToken0: false
            });
            oracleRouter.setOracleConfig(Constants.USDC_BASE_S, usdcConfig);
            console.log("[OK] USDC oracle configured");
        } else {
            console.log("[SKIP] USDC oracle already configured");
        }
    }

    /// @notice Create WETH/USDC lending market
    function createMarket(address marketFactoryAddr) internal returns (address market) {
        IMarketFactory factory = IMarketFactory(marketFactoryAddr);

        // Market parameters (from protocol design)
        IMarketFactory.CreateMarketParams memory params = IMarketFactory.CreateMarketParams({
            collateralToken: Constants.WETH_BASE_S,
            borrowToken: Constants.USDC_BASE_S,
            ltv: Constants.LTV,
            liquidationThreshold: Constants.LIQUIDATION_THRESHOLD,
            liquidationPenalty: Constants.LIQUIDATION_PENALTY,
            reserveFactor: Constants.RESERVE_FACTOR,
            poolTokenName: "ISM WETH-USDC",
            poolTokenSymbol: "iWETH-USDC"
        });

        console.log("Creating market with params:");
        console.log("  Collateral: WETH");
        console.log("  Borrow: USDC");
        console.log("  LTV: ", _formatPercentages_e18(Constants.LTV));
        console.log("  Liquidation Threshold: ", _formatPercentages_e18(Constants.LIQUIDATION_THRESHOLD));
        console.log("  Liquidation Penalty: ", _formatPercentages_e18(Constants.LIQUIDATION_PENALTY));
        console.log("  Reserve Factor: ", _formatPercentages_e18(Constants.RESERVE_FACTOR));
        console.log("  Pool Token: iWETH-USDC");

        market = factory.createMarket(params);

        console.log("[OK] Market created at:", market);
    }

    function _formatPercentages_e18(uint256 value) internal pure returns (string memory) {
        return string(abi.encodePacked(value * 100 / 1e18, "%"));
    }
}
