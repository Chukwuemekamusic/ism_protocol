// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {OracleRouter} from "../../src/core/OracleRouter.sol";
import {IOracleRouter} from "../../src/interfaces/IOracleRouter.sol";

contract OracleRouterForkTest is Test {
    OracleRouter public router;

    // Base Sepolia addresses
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant ETH_USD_FEED = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant UNISWAP_POOL = 0x94bfc0574FF48E92cE43d495376C477B1d0EEeC0; // USDC/WETH pool

    function setUp() public {
        // Fork Base Sepolia
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));

        // Deploy router
        router = new OracleRouter(address(0)); // No sequencer feed for now

        // Configure oracle for WETH
        router.setOracleConfig(
            WETH,
            IOracleRouter.OracleConfig({
                chainlinkFeed: ETH_USD_FEED,
                uniswapPool: UNISWAP_POOL,
                twapWindow: 1800, // 30 minutes
                maxStaleness: 86400, // 1 day (Chainlink on testnet updates slowly)
                isToken0: false // WETH is token1 in the pool
            })
        );
    }

    function test_fork_getTwapPrice() public view {
        uint256 twapPrice = router.getTwapPrice(WETH);
        console2.log("TWAP Price:", twapPrice);
        console2.log("Expected: ~2000e18 (around $2000)");

        // Sanity check: price should be between $500 and $10000
        assertGt(twapPrice, 500e18, "TWAP price too low");
        assertLt(twapPrice, 10000e18, "TWAP price too high");
    }

    function test_fork_getChainlinkPrice() public view {
        uint256 clPrice = router.getPrice(WETH);
        console2.log("Chainlink Price:", clPrice);

        // Sanity check
        assertGt(clPrice, 500e18, "Chainlink price too low");
        assertLt(clPrice, 10000e18, "Chainlink price too high");
    }

    function test_fork_getPriceData() public view {
        IOracleRouter.PriceData memory data = router.getPriceData(WETH);
        console2.log("Price:", data.price);
        console2.log("From fallback:", data.isFromFallback);

        assertGt(data.price, 500e18, "Price too low");
        assertLt(data.price, 10000e18, "Price too high");
    }

    function test_fork_debugPoolInfo() public view {
        // Get pool info
        (bool success, bytes memory data) = UNISWAP_POOL.staticcall(abi.encodeWithSignature("token0()"));
        require(success, "token0 call failed");
        address token0 = abi.decode(data, (address));

        (success, data) = UNISWAP_POOL.staticcall(abi.encodeWithSignature("token1()"));
        require(success, "token1 call failed");
        address token1 = abi.decode(data, (address));

        console2.log("Pool token0:", token0);
        console2.log("Pool token1:", token1);
        console2.log("USDC:", USDC);
        console2.log("WETH:", WETH);
        console2.log("token0 < token1?", token0 < token1);
    }
}
