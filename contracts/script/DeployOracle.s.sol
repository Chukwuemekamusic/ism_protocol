// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DeploymentHelper} from "./DeploymentHelper.sol";

contract DeployOracle is Script {
    function run() external {
        console.log("Deploying OracleRouter...");

        // Set sequencer uptime feed based on chain
        sequencerUptimeFeed = getSequencerUptimeFeed();
        console.log("  Sequencer Uptime Feed:", sequencerUptimeFeed);

        oracleRouter = address(new OracleRouter(sequencerUptimeFeed));

        console.log("[OK] OracleRouter deployed:", oracleRouter);
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
