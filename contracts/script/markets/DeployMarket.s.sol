// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {DeploymentHelper} from "script/DeploymentHelper.sol";
import {Constants} from "script/Constants.s.sol";

// Interfaces
import {IMarketFactory} from "src/interfaces/IMarketFactory.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";

// forge script script/markets/DeployMarket.s.sol:DeployMarket \
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
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    // Core contract addresses
    address internal oracleRouterAddr;
    address internal marketFactoryAddr;

    // Market configuration
    address internal collateralToken;
    address internal borrowToken;
    string internal collateralSymbol;
    string internal borrowSymbol;

    /*//////////////////////////////////////////////////////////////
                            MAIN FUNCTION
    //////////////////////////////////////////////////////////////*/

    function run() external virtual {
        // Set market configuration (USDC/WETH)
        _setMarketConfig(Constants.USDC_BASE_S, Constants.WETH_BASE_S, "USDC", "WETH");

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

        // Step 3: Save market deployment
        console.log("\nSTEP 3: Saving market deployment...");
        _saveMarketDeployment(market);

        _logCompletionInfo(market);
    }

    /*//////////////////////////////////////////////////////////////
                        CONFIGURATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Set the market configuration
    /// @dev This can be overridden in derived contracts to deploy different markets
    function _setMarketConfig(
        address _collateralToken,
        address _borrowToken,
        string memory _collateralSymbol,
        string memory _borrowSymbol
    ) internal virtual {
        collateralToken = _collateralToken;
        borrowToken = _borrowToken;
        collateralSymbol = _collateralSymbol;
        borrowSymbol = _borrowSymbol;
    }

    /// @notice Log deployment information
    function _logDeploymentInfo(uint256 chainId) internal view {
        console.log("========== ISM Protocol Market Deployment ==========");
        console.log("Chain ID:", chainId);
        console.log("Using MarketFactory:", marketFactoryAddr);
        console.log("Using OracleRouter:", oracleRouterAddr);
        console.log("Collateral Token:", collateralSymbol);
        console.log("Borrow Token:", borrowSymbol);
        console.log("================================================\n");
    }

    /// @notice Log completion information
    function _logCompletionInfo(address market) internal view {
        console.log("\n========== Market Deployment Complete ==========");
        console.log("Market Address:", market);
        console.log("Collateral Token:", collateralSymbol);
        console.log("Collateral Address:", collateralToken);
        console.log("Borrow Token:", borrowSymbol);
        console.log("Borrow Address:", borrowToken);
        console.log("==============================================\n");
    }

    /*//////////////////////////////////////////////////////////////
                        DEPLOYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Configure oracle feeds for the configured tokens
    function _configureOracleFeeds() internal {
        IOracleRouter oracleRouter = IOracleRouter(oracleRouterAddr);

        // Configure collateral token oracle
        _configureTokenOracle(oracleRouter, collateralToken);

        // Configure borrow token oracle
        _configureTokenOracle(oracleRouter, borrowToken);
    }

    /// @notice Configure oracle for a specific token
    /// @param oracleRouter The oracle router instance
    /// @param token The token address to configure
    function _configureTokenOracle(IOracleRouter oracleRouter, address token) internal {
        if (oracleRouter.isConfigured(token)) {
            console.log("[SKIP] Oracle already configured for:", token);
            return;
        }

        console.log("Configuring oracle for token:", token);

        // WETH configuration
        if (token == Constants.WETH_BASE_S) {
            IOracleRouter.OracleConfig memory config = IOracleRouter.OracleConfig({
                chainlinkFeed: Constants.WETH_USD_FEED,
                uniswapPool: address(0),
                twapWindow: 30 minutes,
                maxStaleness: Constants.TESTNET_MAX_STALENESS,
                isToken0: false // WETH is token1 in WETH/USDC pool
            });
            oracleRouter.setOracleConfig(token, config);
            console.log("[OK] WETH oracle configured");
        }
        // USDC configuration
        else if (token == Constants.USDC_BASE_S) {
            IOracleRouter.OracleConfig memory config = IOracleRouter.OracleConfig({
                chainlinkFeed: Constants.USDC_USD_FEED,
                uniswapPool: address(0), // NO fallback for stablecoins
                twapWindow: 0,
                maxStaleness: Constants.TESTNET_MAX_STALENESS,
                isToken0: false
            });
            oracleRouter.setOracleConfig(token, config);
            console.log("[OK] USDC oracle configured (Chainlink only)");
        } else if (token == Constants.WBTC_BASE_S) {
            IOracleRouter.OracleConfig memory config = IOracleRouter.OracleConfig({
                chainlinkFeed: Constants.WBTC_USD_FEED,
                uniswapPool: address(0),
                twapWindow: 30 minutes,
                maxStaleness: Constants.TESTNET_MAX_STALENESS,
                isToken0: false // WBTC is token1 in WBTC/USDC pool
            });
            oracleRouter.setOracleConfig(token, config);
            console.log("[OK] WBTC oracle configured");
        }
        // Add more token configurations here as needed
        else {
            console.log("[WARNING] No oracle configuration found for token:", token);
            console.log("[WARNING] You may need to manually configure this oracle");
        }
    }

    /// @notice Create a lending market for the configured token pair
    function _createMarket() internal returns (address market) {
        IMarketFactory factory = IMarketFactory(marketFactoryAddr);

        // Build pool token name and symbol
        string memory poolTokenName = string.concat("ISM ", collateralSymbol, "-", borrowSymbol);
        string memory poolTokenSymbol = string.concat("i", collateralSymbol, "-", borrowSymbol);

        // Market parameters (from protocol design)
        IMarketFactory.CreateMarketParams memory params = IMarketFactory.CreateMarketParams({
            collateralToken: collateralToken,
            borrowToken: borrowToken,
            ltv: Constants.LTV,
            liquidationThreshold: Constants.LIQUIDATION_THRESHOLD,
            liquidationPenalty: Constants.LIQUIDATION_PENALTY,
            reserveFactor: Constants.RESERVE_FACTOR,
            poolTokenName: poolTokenName,
            poolTokenSymbol: poolTokenSymbol
        });

        console.log("Creating market with params:");
        console.log("  Collateral:", collateralSymbol);
        console.log("  Borrow:", borrowSymbol);
        console.log("  LTV: ", _formatPercentages_e18(Constants.LTV));
        console.log("  Liquidation Threshold: ", _formatPercentages_e18(Constants.LIQUIDATION_THRESHOLD));
        console.log("  Liquidation Penalty: ", _formatPercentages_e18(Constants.LIQUIDATION_PENALTY));
        console.log("  Reserve Factor: ", _formatPercentages_e18(Constants.RESERVE_FACTOR));
        console.log("  Pool Token:", poolTokenSymbol);

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
    function _saveMarketDeployment(address market) internal {
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
        string memory newMarketKey = "newMarket";
        vm.serializeAddress(newMarketKey, "pool", market);
        vm.serializeAddress(newMarketKey, "collateralToken", collateralToken);
        vm.serializeAddress(newMarketKey, "borrowToken", borrowToken);
        string memory newMarketObject = vm.serializeAddress(newMarketKey, "poolToken", poolToken);

        // Build markets object by reading existing markets and appending new one
        string memory marketsKey = "markets";

        // Count existing markets to determine the next index
        uint256 marketIndex = 0;
        bool hasExistingMarkets = false;

        // Try to parse existing markets object
        try vm.parseJson(existingJson, ".markets") returns (bytes memory) {
            hasExistingMarkets = true;
            // Count existing markets by trying to parse sequential indices
            while (true) {
                try vm.parseJson(existingJson, string.concat(".markets.", vm.toString(marketIndex))) returns (
                    bytes memory
                ) {
                    marketIndex++;
                } catch {
                    break;
                }
            }
        } catch {
            // No markets exist yet
            hasExistingMarkets = false;
        }

        // Re-serialize all existing markets plus the new one
        if (hasExistingMarkets) {
            // Copy all existing markets
            for (uint256 i = 0; i < marketIndex; i++) {
                string memory existingMarketKey = string.concat("existingMarket", vm.toString(i));
                string memory marketPath = string.concat(".markets.", vm.toString(i));

                vm.serializeAddress(
                    existingMarketKey, "pool", vm.parseJsonAddress(existingJson, string.concat(marketPath, ".pool"))
                );
                vm.serializeAddress(
                    existingMarketKey,
                    "collateralToken",
                    vm.parseJsonAddress(existingJson, string.concat(marketPath, ".collateralToken"))
                );
                vm.serializeAddress(
                    existingMarketKey,
                    "borrowToken",
                    vm.parseJsonAddress(existingJson, string.concat(marketPath, ".borrowToken"))
                );
                string memory existingMarketObject = vm.serializeAddress(
                    existingMarketKey,
                    "poolToken",
                    vm.parseJsonAddress(existingJson, string.concat(marketPath, ".poolToken"))
                );

                vm.serializeString(marketsKey, vm.toString(i), existingMarketObject);
            }
        }

        // Add the new market
        string memory marketsJson = vm.serializeString(marketsKey, vm.toString(marketIndex), newMarketObject);

        // Build final JSON structure
        string memory rootJson = "root";
        vm.serializeUint(rootJson, "chainId", chainId);
        vm.serializeString(rootJson, "network", network);
        vm.serializeString(rootJson, "contracts", contractsJson);
        vm.serializeString(rootJson, "markets", marketsJson);
        vm.serializeString(rootJson, "tokens", tokensJson);
        string memory finalJson = vm.serializeString(rootJson, "oracles", oraclesJson);

        // Write updated JSON to file
        vm.writeFile(filename, finalJson);

        console.log("[OK] Market deployment saved to:", filename);
    }
}
