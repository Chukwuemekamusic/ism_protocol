// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IUniswapV3Pool} from "../../src/interfaces/external/IUniswapV3Pool.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";
import {FullMath} from "../../src/libraries/FullMath.sol";

contract OracleDebugForkTest is Test {
    // Base Sepolia addresses
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant UNISWAP_POOL = 0x94bfc0574FF48E92cE43d495376C477B1d0EEeC0;

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));
    }

    function test_fork_debugTwapCalculation() public view {
        IUniswapV3Pool pool = IUniswapV3Pool(UNISWAP_POOL);

        // Get token info
        address token0 = pool.token0();
        address token1 = pool.token1();
        uint8 decimals0 = IERC20Metadata(token0).decimals();
        uint8 decimals1 = IERC20Metadata(token1).decimals();

        console2.log("=== Pool Info ===");
        console2.log("token0:", token0);
        console2.log("decimals0:", decimals0);
        console2.log("token1:", token1);
        console2.log("decimals1:", decimals1);

        // Get TWAP
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = 1800; // 30 min ago
        secondsAgos[1] = 0; // now

        (int56[] memory tickCumulatives,) = pool.observe(secondsAgos);
        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 avgTick = int24(tickDelta / 1800);

        console2.log("\n=== TWAP Calculation ===");
        console2.log("tickCumulatives[0]:", uint256(uint56(tickCumulatives[0])));
        console2.log("tickCumulatives[1]:", uint256(uint56(tickCumulatives[1])));
        console2.log("avgTick:", uint256(uint24(avgTick)));

        // Get sqrtPriceX96
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);
        console2.log("sqrtPriceX96:", sqrtPriceX96);

        // Calculate ratioX128
        uint256 ratioX128 = FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 64);
        console2.log("ratioX128:", ratioX128);

        // Price WETH (token1) in terms of USDC (token0)
        uint256 baseAmount = 10 ** decimals1; // 1 WETH
        console2.log("\n=== Pricing token1 (WETH) ===");
        console2.log("baseAmount:", baseAmount);

        // Method 1: Invert ratio (current implementation)
        uint256 quoteAmount1 = FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        console2.log("quoteAmount (inverted):", quoteAmount1);
        console2.log("quoteAmount in USDC:", quoteAmount1 / 10 ** decimals0);

        // Method 2: Direct ratio
        uint256 quoteAmount2 = FullMath.mulDiv(ratioX128, baseAmount, 1 << 128);
        console2.log("quoteAmount (direct):", quoteAmount2);
        console2.log("quoteAmount in USDC:", quoteAmount2 / 10 ** decimals0);

        // Normalize to 18 decimals
        uint256 price1 = quoteAmount1 * (10 ** (18 - decimals0));
        uint256 price2 = quoteAmount2 * (10 ** (18 - decimals0));
        console2.log("\n=== Final Prices (18 decimals) ===");
        console2.log("Price (inverted):", price1);
        console2.log("Price (direct):", price2);
    }
}
