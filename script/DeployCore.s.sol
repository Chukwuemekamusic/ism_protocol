// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// Core contracts
import {InterestRateModel} from "src/core/InterestRateModel.sol";
import {OracleRouter} from "src/core/OracleRouter.sol";
import {DutchAuctionLiquidator} from "src/core/DutchAuctionLiquidator.sol";
import {MarketRegistry} from "src/core/MarketRegistry.sol";
import {LendingPool} from "src/core/LendingPool.sol";
import {MarketFactory} from "src/core/MarketFactory.sol";

// Interfaces
import {IDutchAuctionLiquidator} from "src/interfaces/IDutchAuctionLiquidator.sol";
import {IMarketRegistry} from "src/interfaces/IMarketRegistry.sol";

contract DeployCore is Script {
    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 constant WAD = 1e18;

    // Interest Rate Model parameters (from documentation/tests)
    uint256 constant BASE_RATE_PER_YEAR = 0; // 0% base rate
    uint256 constant SLOPE_BEFORE_KINK = 0.04e18; // 4% per year
    uint256 constant SLOPE_AFTER_KINK = 0.75e18; // 75% per year
    uint256 constant KINK = 0.8e18; // 80% utilization threshold

    // Dutch Auction configuration
    uint64 constant AUCTION_DURATION = 1200; // 20 minutes
    uint64 constant START_PREMIUM = 1.05e18; // 105% of oracle price
    uint64 constant END_DISCOUNT = 0.95e18; // 95% of oracle price
    uint64 constant CLOSE_FACTOR = 0.5e18; // 50% max debt liquidatable

    /*//////////////////////////////////////////////////////////////
                        DEPLOYMENT VARIABLES
    //////////////////////////////////////////////////////////////*/

    address public interestRateModel;
    address public oracleRouter;
    address public dutchAuctionLiquidator;
    address public marketRegistry;
    address public lendingPoolImplementation;
    address public marketFactory;

    address public sequencerUptimeFeed;

    /*//////////////////////////////////////////////////////////////
                            MAIN FUNCTION
    //////////////////////////////////////////////////////////////*/

    function run() external {
        // Get the deployer's private key from environment
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("========== ISM Protocol Core Deployment ==========");
        console.log("Deployer address:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("================================================\n");

        vm.startBroadcast(deployerKey);

        // Step 1: Deploy standalone contracts (no dependencies)
        console.log("STEP 1: Deploying standalone contracts...");
        deployInterestRateModel();
        deployOracleRouter();
        deployMarketRegistry();
        deployLendingPoolImplementation();

        // Step 2: Deploy dependent contracts
        console.log("\nSTEP 2: Deploying dependent contracts...");
        deployDutchAuctionLiquidator();
        deployMarketFactory();

        // Step 3: Post-deployment configuration
        console.log("\nSTEP 3: Configuring permissions...");
        configurePermissions();

        vm.stopBroadcast();

        console.log("\n========== Deployment Complete ==========");
        logDeploymentAddresses();
    }

    /*//////////////////////////////////////////////////////////////
                        DEPLOYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy the interest rate model
    function deployInterestRateModel() internal {
        console.log("Deploying InterestRateModel...");
        console.log("  Base Rate: 0%%");
        console.log("  Slope Before Kink: 4%%");
        console.log("  Slope After Kink: 75%%");
        console.log("  Kink: 80%%");

        interestRateModel = address(
            new InterestRateModel(
                BASE_RATE_PER_YEAR,
                SLOPE_BEFORE_KINK,
                SLOPE_AFTER_KINK,
                KINK
            )
        );

        console.log("[OK] InterestRateModel deployed:", interestRateModel);
    }

    /// @notice Deploy the oracle router with sequencer uptime feed
    function deployOracleRouter() internal {
        console.log("Deploying OracleRouter...");

        // Set sequencer uptime feed based on chain
        sequencerUptimeFeed = getSequencerUptimeFeed();
        console.log("  Sequencer Uptime Feed:", sequencerUptimeFeed);

        oracleRouter = address(new OracleRouter(sequencerUptimeFeed));

        console.log("[OK] OracleRouter deployed:", oracleRouter);
    }

    /// @notice Deploy the market registry
    function deployMarketRegistry() internal {
        console.log("Deploying MarketRegistry...");
        marketRegistry = address(new MarketRegistry());
        console.log("[OK] MarketRegistry deployed:", marketRegistry);
    }

    /// @notice Deploy the LendingPool implementation contract
    function deployLendingPoolImplementation() internal {
        console.log("Deploying LendingPool implementation...");
        lendingPoolImplementation = address(new LendingPool());
        console.log("[OK] LendingPool implementation deployed:", lendingPoolImplementation);
    }

    /// @notice Deploy the Dutch auction liquidator
    function deployDutchAuctionLiquidator() internal {
        console.log("Deploying DutchAuctionLiquidator...");
        console.log("  Duration: 1200 seconds (20 minutes)");
        console.log("  Start Premium: 105%%");
        console.log("  End Discount: 95%%");
        console.log("  Close Factor: 50%%");

        IDutchAuctionLiquidator.AuctionConfig memory config = IDutchAuctionLiquidator
            .AuctionConfig({
                duration: AUCTION_DURATION,
                startPremium: START_PREMIUM,
                endDiscount: END_DISCOUNT,
                closeFactor: CLOSE_FACTOR
            });

        dutchAuctionLiquidator = address(
            new DutchAuctionLiquidator(oracleRouter, config)
        );

        console.log("[OK] DutchAuctionLiquidator deployed:", dutchAuctionLiquidator);
    }

    /// @notice Deploy the market factory
    function deployMarketFactory() internal {
        console.log("Deploying MarketFactory...");
        console.log("  LendingPool Implementation:", lendingPoolImplementation);
        console.log("  OracleRouter:", oracleRouter);
        console.log("  InterestRateModel:", interestRateModel);
        console.log("  DutchAuctionLiquidator:", dutchAuctionLiquidator);
        console.log("  MarketRegistry:", marketRegistry);

        marketFactory = address(
            new MarketFactory(
                lendingPoolImplementation,
                oracleRouter,
                interestRateModel,
                dutchAuctionLiquidator,
                marketRegistry
            )
        );

        console.log("[OK] MarketFactory deployed:", marketFactory);
    }

    /// @notice Configure permissions and authorizations
    function configurePermissions() internal {
        console.log("Authorizing MarketFactory in MarketRegistry...");
        IMarketRegistry(marketRegistry).setFactory(marketFactory, true);
        console.log("[OK] MarketFactory authorized");
    }

    /*//////////////////////////////////////////////////////////////
                        HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the appropriate sequencer uptime feed address based on chain
    function getSequencerUptimeFeed() internal view returns (address) {
        if (block.chainid == 8453) {
            // Base Mainnet
            return 0xbCf85224fC0756b9Fa45Aa7892130B8Ac4eda50a;
        } else if (block.chainid == 84532) {
            // Base Sepolia
            return 0x07f2985C78CD78f585880c1b8c1e1AB6F9C76D79;
        } else if (block.chainid == 31337) {
            // Local Anvil (return zero address - will need to be mocked)
            console.log("  WARNING: Local chain detected. Sequencer feed not available.");
            console.log("  Use address(0) or mock sequencer feed in tests.");
            return address(0);
        } else {
            revert("Unsupported chain ID");
        }
    }

    /// @notice Log all deployment addresses
    function logDeploymentAddresses() internal view {
        console.log("\n========== Deployed Contract Addresses ==========");
        console.log("InterestRateModel:      ", interestRateModel);
        console.log("OracleRouter:           ", oracleRouter);
        console.log("MarketRegistry:         ", marketRegistry);
        console.log("LendingPool (impl):     ", lendingPoolImplementation);
        console.log("DutchAuctionLiquidator: ", dutchAuctionLiquidator);
        console.log("MarketFactory:          ", marketFactory);
        console.log("==================================================\n");

        console.log("Next steps:");
        console.log("1. Configure oracle feeds for each token:");
        console.log("   oracleRouter.setOracleConfig(tokenAddress, config)");
        console.log("2. Create markets via MarketFactory:");
        console.log("   factory.createMarket(collateral, borrow, params)");
        console.log("3. Authorize pools in liquidator (automatic on market creation)");
    }
}
