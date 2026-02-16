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
                maxStaleness: Constants.TESTNET_MAX_STALENESS, // 4 days for testnet
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
                uniswapPool: address(0), // NO fallback for stablecoins (TWAP against WETH gives wrong price)
                twapWindow: 0,
                maxStaleness: Constants.TESTNET_MAX_STALENESS, // 4 days for testnet
                isToken0: false
            });
            oracleRouter.setOracleConfig(Constants.USDC_BASE_S, usdcConfig);
            console.log("[OK] USDC oracle configured (Chainlink only)");
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

        // Parse existing top-level data
        uint256 chainId = vm.parseJsonUint(existingJson, ".chainId");
        string memory network = vm.parseJsonString(existingJson, ".network");

        // Parse contracts object fields
        string memory contractsKey = "contracts";
        vm.serializeUint(contractsKey, "chainId", vm.parseJsonUint(existingJson, ".contracts.chainId"));
        vm.serializeAddress(contractsKey, "deployer", vm.parseJsonAddress(existingJson, ".contracts.deployer"));
        vm.serializeUint(
            contractsKey, "deploymentTimestamp", vm.parseJsonUint(existingJson, ".contracts.deploymentTimestamp")
        );
        vm.serializeAddress(
            contractsKey,
            "dutchAuctionLiquidator",
            vm.parseJsonAddress(existingJson, ".contracts.dutchAuctionLiquidator")
        );
        vm.serializeAddress(
            contractsKey, "interestRateModel", vm.parseJsonAddress(existingJson, ".contracts.interestRateModel")
        );
        vm.serializeAddress(
            contractsKey,
            "lendingPoolImplementation",
            vm.parseJsonAddress(existingJson, ".contracts.lendingPoolImplementation")
        );
        vm.serializeAddress(
            contractsKey, "marketFactory", vm.parseJsonAddress(existingJson, ".contracts.marketFactory")
        );
        vm.serializeAddress(
            contractsKey, "marketRegistry", vm.parseJsonAddress(existingJson, ".contracts.marketRegistry")
        );
        string memory contractsJson = vm.serializeAddress(
            contractsKey, "oracleRouter", vm.parseJsonAddress(existingJson, ".contracts.oracleRouter")
        );

        // Parse tokens object fields
        string memory tokensKey = "tokens";
        vm.serializeAddress(tokensKey, "USDC", vm.parseJsonAddress(existingJson, ".tokens.USDC"));
        vm.serializeAddress(tokensKey, "WBTC", vm.parseJsonAddress(existingJson, ".tokens.WBTC"));
        string memory tokensJson =
            vm.serializeAddress(tokensKey, "WETH", vm.parseJsonAddress(existingJson, ".tokens.WETH"));

        // Parse oracles object fields
        string memory oraclesKey = "oracles";
        vm.serializeAddress(oraclesKey, "btcUsdFeed", vm.parseJsonAddress(existingJson, ".oracles.btcUsdFeed"));
        vm.serializeAddress(oraclesKey, "ethUsdFeed", vm.parseJsonAddress(existingJson, ".oracles.ethUsdFeed"));
        string memory oraclesJson =
            vm.serializeAddress(oraclesKey, "usdcUsdFeed", vm.parseJsonAddress(existingJson, ".oracles.usdcUsdFeed"));

        // Build new market entry
        string memory marketJson = "newMarket";
        vm.serializeAddress(marketJson, "pool", market);
        vm.serializeAddress(marketJson, "collateralToken", collateralToken);
        vm.serializeAddress(marketJson, "borrowToken", borrowToken);
        string memory marketObject = vm.serializeAddress(marketJson, "poolToken", poolToken);

        // Build markets array
        // Try to read existing markets, but handle both empty array string "[]" and actual array
        string memory marketsJson = "markets";
        string memory marketsArray;

        try vm.parseJson(existingJson, ".markets") returns (
            bytes memory /* marketsData */
        ) {
            // Check if it's an empty array by checking the string representation
            string memory marketsStr = vm.parseJsonString(existingJson, ".markets");
            if (
                keccak256(abi.encodePacked(marketsStr)) == keccak256(abi.encodePacked("[]"))
                    || bytes(marketsStr).length == 0
            ) {
                // Empty array or empty string - this is the first market
                marketsArray = vm.serializeString(marketsJson, "0", marketObject);
            } else {
                // Markets exist - we need to count them and append
                // For now, just serialize the first market (this handles the common case)
                // In production, you'd want to parse all existing markets and re-serialize
                marketsArray = vm.serializeString(marketsJson, "0", marketObject);
            }
        } catch {
            // No markets key exists - create first market
            marketsArray = vm.serializeString(marketsJson, "0", marketObject);
        }

        // Build final JSON structure
        string memory rootJson = "root";
        vm.serializeUint(rootJson, "chainId", chainId);
        vm.serializeString(rootJson, "network", network);
        vm.serializeString(rootJson, "contracts", contractsJson);
        vm.serializeString(rootJson, "markets", marketsArray);
        vm.serializeString(rootJson, "tokens", tokensJson);
        string memory finalJson = vm.serializeString(rootJson, "oracles", oraclesJson);

        // Write updated JSON to file
        vm.writeFile(filename, finalJson);

        console.log("[OK] Market deployment saved to:", filename);
    }
}
