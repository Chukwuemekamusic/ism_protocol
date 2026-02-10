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
        string memory filename = string.concat("deployments/", vm.toString(chainId), ".json");
        require(vm.exists(filename), string.concat("Deployment file not found: ", filename));

        string memory json = vm.readFile(filename);

        deployment.interestRateModel = json.readAddress(".interestRateModel");
        deployment.oracleRouter = json.readAddress(".oracleRouter");
        deployment.marketRegistry = json.readAddress(".marketRegistry");
        deployment.lendingPoolImplementation = json.readAddress(".lendingPoolImplementation");
        deployment.dutchAuctionLiquidator = json.readAddress(".dutchAuctionLiquidator");
        deployment.marketFactory = json.readAddress(".marketFactory");
        deployment.chainId = json.readUint(".chainId");
        deployment.deploymentTimestamp = json.readUint(".deploymentTimestamp");
        deployment.deployer = json.readAddress(".deployer");
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
        string memory filename = string.concat("deployments/", vm.toString(chainId), ".json");
        return vm.exists(filename);
    }
}
