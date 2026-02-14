// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {DeploymentHelper} from "./DeploymentHelper.sol";
import {Constants} from "./Constants.s.sol";

// Interfaces
import {IMarketFactory} from "src/interfaces/IMarketFactory.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";

// forge script script/DeployMarket.s.sol:DeployMarket \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet \
// --broadcast \
// --verify \
// --etherscan-api-key $ETHERSCAN_API_KEY \
// --slow

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

        vm.startBroadcast();

        // Step 1: Configure oracle feeds (if not already configured)
        console.log("\nSTEP 1: Configuring oracle feeds...");
        configureOracleFeeds(deployment.oracleRouter);

        // Step 2: Create market
        console.log("\nSTEP 2: Creating WETH/USDC market...");
        address market = createMarket(deployment.marketFactory);

        vm.stopBroadcast();

        // Step 3: Save market deployment to JSON
        console.log("\nSTEP 3: Saving market deployment...");
        saveMarketDeployment(market, Constants.WETH_BASE_S, Constants.USDC_BASE_S);

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

    /*//////////////////////////////////////////////////////////////
                        SAVE MARKET DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Save market deployment to the deployment JSON file
    /// @param market The deployed market address
    /// @param collateralToken The collateral token address
    /// @param borrowToken The borrow token address
    function saveMarketDeployment(address market, address collateralToken, address borrowToken) internal {
        // Get pool token address from the market
        ILendingPool pool = ILendingPool(market);
        address poolToken = address(pool.poolToken());

        console.log("Saving market to deployment file...");
        console.log("  Market:", market);
        console.log("  Pool Token:", poolToken);

        // Read existing deployment file
        string memory filename = string.concat("../deployments/", vm.toString(block.chainid), ".json");
        require(vm.exists(filename), "Deployment file not found");

        string memory existingJson = vm.readFile(filename);

        // Parse existing data
        uint256 chainId = vm.parseJsonUint(existingJson, ".chainId");
        string memory network = vm.parseJsonString(existingJson, ".network");

        // Read existing contracts object as string
        string memory contractsJson = vm.parseJsonString(existingJson, ".contracts");

        // Read existing tokens object as string
        string memory tokensJson = vm.parseJsonString(existingJson, ".tokens");

        // Read existing oracles object as string
        string memory oraclesJson = vm.parseJsonString(existingJson, ".oracles");

        // Build new market entry
        string memory marketJson = "newMarket";
        vm.serializeAddress(marketJson, "pool", market);
        vm.serializeAddress(marketJson, "collateralToken", collateralToken);
        vm.serializeAddress(marketJson, "borrowToken", borrowToken);
        string memory marketObject = vm.serializeAddress(marketJson, "poolToken", poolToken);

        // Read existing markets array (if it exists and has items)
        string memory marketsArrayJson;
        try vm.parseJson(existingJson, ".markets") returns (bytes memory marketsData) {
            // Markets array exists, parse it
            if (marketsData.length > 2) {
                // Array has content (more than just "[]")
                marketsArrayJson = vm.parseJsonString(existingJson, ".markets");
            } else {
                // Empty array, start fresh
                marketsArrayJson = "";
            }
        } catch {
            // Markets array doesn't exist or is malformed
            marketsArrayJson = "";
        }

        // Create new markets array with the new market appended
        string memory finalMarketsArray;

        if (bytes(marketsArrayJson).length > 0) {
            // Append to existing markets
            // Note: This is a workaround since Foundry doesn't have native array append
            // We'll serialize the new market and manually construct the array
            finalMarketsArray = string.concat("[", marketsArrayJson, ",", marketObject, "]");
        } else {
            // First market in the array
            finalMarketsArray = string.concat("[", marketObject, "]");
        }

        // Build final JSON structure
        string memory rootJson = "root";
        vm.serializeUint(rootJson, "chainId", chainId);
        vm.serializeString(rootJson, "network", network);
        vm.serializeString(rootJson, "contracts", contractsJson);
        vm.serializeString(rootJson, "markets", finalMarketsArray);
        vm.serializeString(rootJson, "tokens", tokensJson);
        string memory finalJson = vm.serializeString(rootJson, "oracles", oraclesJson);

        // Write updated JSON to file
        vm.writeFile(filename, finalJson);

        console.log("[OK] Market deployment saved to:", filename);
    }
}
