// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {Constants} from "script/Constants.s.sol";

/// @title DeploymentHelper
/// @notice Helper library for reading deployment addresses from JSON files
/// @dev Usage: import and inherit this contract in your deployment scripts
abstract contract DeploymentHelper is Script {
    using stdJson for string;

    struct CoreDeployment {
        address interestRateModel;
        address oracleRouter;
        address marketRegistry;
        address lendingPoolImplementation;
        address dutchAuctionLiquidator;
        address marketFactory;
        uint256 chainId;
        uint256 deploymentTimestamp;
        address deployer;
    }

    /// @notice Load deployment addresses for the current chain
    /// @return deployment struct with all core contract addresses
    function loadDeployment() internal view returns (CoreDeployment memory deployment) {
        return loadDeployment(block.chainid);
    }

    /// @notice Load deployment addresses for a specific chain
    /// @param chainId The chain ID to load deployment for
    /// @return deployment struct with all core contract addresses
    function loadDeployment(uint256 chainId) internal view returns (CoreDeployment memory deployment) {
        // Path is relative to contracts/ directory, so go up one level to reach deployments/
        string memory filename = string.concat("../deployments/", vm.toString(chainId), ".json");
        require(vm.exists(filename), string.concat("Deployment file not found: ", filename));

        string memory json = vm.readFile(filename);

        // Read from nested "contracts" object
        deployment.interestRateModel = json.readAddress(".contracts.interestRateModel");
        deployment.oracleRouter = json.readAddress(".contracts.oracleRouter");
        deployment.marketRegistry = json.readAddress(".contracts.marketRegistry");
        deployment.lendingPoolImplementation = json.readAddress(".contracts.lendingPoolImplementation");
        deployment.dutchAuctionLiquidator = json.readAddress(".contracts.dutchAuctionLiquidator");
        deployment.marketFactory = json.readAddress(".contracts.marketFactory");
        deployment.chainId = json.readUint(".contracts.chainId");
        deployment.deploymentTimestamp = json.readUint(".contracts.deploymentTimestamp");
        deployment.deployer = json.readAddress(".contracts.deployer");
    }

    /// @notice Check if deployment exists for current chain
    /// @return true if deployment file exists
    function deploymentExists() internal view returns (bool) {
        return deploymentExists(block.chainid);
    }

    /// @notice Check if deployment exists for specific chain
    /// @param chainId The chain ID to check
    /// @return true if deployment file exists
    function deploymentExists(uint256 chainId) internal view returns (bool) {
        // Path is relative to contracts/ directory
        string memory filename = string.concat("../deployments/", vm.toString(chainId), ".json");
        return vm.exists(filename);
    }

    // @notice Get the appropriate sequencer uptime feed address based on chain
    function getSequencerUptimeFeed() internal view returns (address) {
        if (block.chainid == 8453) {
            // Base Mainnet
            return Constants.SEQUENCER_UPTIME_FEED_BASE_MAINNET;
        } else if (block.chainid == 84532) {
            // Base Sepolia - No official sequencer feed on testnet
            console.log("  WARNING: Base Sepolia testnet. Sequencer feed not available.");
            console.log("  Deploying with address(0) - sequencer check will be skipped.");
            return address(0);
        } else if (block.chainid == 31337) {
            // Local Anvil (return zero address - will need to be mocked)
            console.log("  WARNING: Local chain detected. Sequencer feed not available.");
            console.log("  Use address(0) or mock sequencer feed in tests.");
            return address(0);
        } else {
            // Unsupported chain
            revert("Unsupported chain ID");
        }
    }
}
