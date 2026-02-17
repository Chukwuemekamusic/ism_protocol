// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IUniswapV3Pool} from "../../src/interfaces/external/IUniswapV3Pool.sol";

contract OracleSpotPriceForkTest is Test {
    address constant UNISWAP_POOL = 0x94bfc0574FF48E92cE43d495376C477B1d0EEeC0;

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));
    }

    function test_fork_spotPrice() public view {
        IUniswapV3Pool pool = IUniswapV3Pool(UNISWAP_POOL);

        // Get current slot0
        (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality,,,) = pool.slot0();

        console2.log("=== Spot Price ===");
        console2.log("Current tick:", uint256(uint24(tick)));
        console2.log("sqrtPriceX96:", sqrtPriceX96);
        console2.log("observationIndex:", observationIndex);
        console2.log("observationCardinality:", observationCardinality);
    }
}
