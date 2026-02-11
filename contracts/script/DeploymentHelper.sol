// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

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
}
