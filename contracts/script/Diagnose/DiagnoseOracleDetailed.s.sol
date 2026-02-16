// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {console2} from "forge-std/console2.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {IUniswapV3Pool} from "src/interfaces/external/IUniswapV3Pool.sol";
import {
    AggregatorV3Interface
} from "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {DeploymentHelper} from "script/DeploymentHelper.sol";
import {Constants} from "script/Constants.s.sol";

/// @notice Deep diagnostic script for oracle price calculation issues
/// @dev Run with: forge script script/Diagnose/DiagnoseOracleDetailed.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL
contract DiagnoseOracleDetailed is DeploymentHelper {
    function run() external view {
        CoreDeployment memory deployment = loadDeployment();
        console2.log("=== DETAILED ORACLE DIAGNOSTIC ===\n");

        IOracleRouter oracle = IOracleRouter(deployment.oracleRouter);

        // Diagnose WETH oracle
        console2.log("====================================");
        console2.log("WETH ORACLE ANALYSIS");
        console2.log("====================================\n");
        diagnoseToken(oracle, Constants.WETH_BASE_S, "WETH");

        console2.log("\n====================================");
        console2.log("USDC ORACLE ANALYSIS");
        console2.log("====================================\n");
        diagnoseToken(oracle, Constants.USDC_BASE_S, "USDC");

        console2.log("\n=== END DIAGNOSTIC ===");
    }

    function diagnoseToken(IOracleRouter oracle, address token, string memory symbol) internal view {
        // 1. Get oracle configuration
        console2.log("1. ORACLE CONFIGURATION:");
        console2.log("   ---------------------");

        try oracle.getOracleConfig(token) returns (IOracleRouter.OracleConfig memory config) {
            console2.log("   Token: ", token);
            console2.log("   Symbol: ", symbol);
            console2.log("   Chainlink Feed: ", config.chainlinkFeed);
            console2.log("   Uniswap Pool: ", config.uniswapPool);
            console2.log("   TWAP Window: ", config.twapWindow, " seconds");
            console2.log("   Max Staleness: ", config.maxStaleness, " seconds");
            console2.log("   Is Token0 in Pool: ", config.isToken0);
            console2.log("");

            // Get token decimals
            try IERC20Metadata(token).decimals() returns (uint8 decimals) {
                console2.log("   Token Decimals: ", decimals);
            } catch {
                console2.log("   Token Decimals: (unable to fetch)");
            }
            console2.log("");

            // 2. Chainlink price analysis
            console2.log("2. CHAINLINK PRICE:");
            console2.log("   ----------------");
            if (config.chainlinkFeed != address(0)) {
                analyzeChainlink(config.chainlinkFeed, config.maxStaleness, symbol);
            } else {
                console2.log("   No Chainlink feed configured");
            }
            console2.log("");

            // 3. Uniswap TWAP analysis
            console2.log("3. UNISWAP TWAP PRICE:");
            console2.log("   -------------------");
            if (config.uniswapPool != address(0)) {
                analyzeUniswap(config.uniswapPool, config.twapWindow, config.isToken0, token, symbol);
            } else {
                console2.log("   No Uniswap pool configured");
            }
            console2.log("");

            // 4. Try to get final price from router
            console2.log("4. FINAL ORACLE ROUTER PRICE:");
            console2.log("   --------------------------");
            try oracle.getPrice(token) returns (uint256 price) {
                console2.log("   Status: SUCCESS");
                console2.log("   Price (raw): ", price);
                console2.log("   Price (USD): $", price / 1e18);
            } catch Error(string memory reason) {
                console2.log("   Status: FAILED");
                console2.log("   Error: ", reason);
            } catch (bytes memory lowLevelData) {
                console2.log("   Status: FAILED (low-level error)");
                decodePriceDeviationError(lowLevelData);
            }
        } catch {
            console2.log("   ERROR: Unable to get oracle config for ", symbol);
        }
    }

    function analyzeChainlink(address feed, uint96 maxStaleness, string memory symbol) internal view {
        AggregatorV3Interface aggregator = AggregatorV3Interface(feed);

        try aggregator.latestRoundData() returns (uint80 roundId, int256 answer, uint256, uint256 updatedAt, uint80) {
            console2.log("   Feed Address: ", feed);
            console2.log("   Round ID: ", roundId);
            console2.log("   Answer (raw): ", uint256(answer));

            // Get decimals
            try aggregator.decimals() returns (uint8 decimals) {
                console2.log("   Feed Decimals: ", decimals);

                // Calculate USD price
                uint256 priceUSD = uint256(answer);
                if (decimals < 18) {
                    priceUSD = priceUSD * (10 ** (18 - decimals));
                }
                console2.log("   Price (normalized to 18 decimals): ", priceUSD);
                console2.log("   Price (USD): $", priceUSD / 1e18);
            } catch {
                console2.log("   Feed Decimals: (unable to fetch)");
            }

            console2.log("   Updated At: ", updatedAt);
            console2.log("   Age: ", block.timestamp - updatedAt, " seconds");
            console2.log("   Max Staleness: ", maxStaleness, " seconds");

            if (block.timestamp - updatedAt > maxStaleness) {
                console2.log("   WARNING: Price is STALE!");
            } else {
                console2.log("   Status: Fresh");
            }
        } catch {
            console2.log("   ERROR: Unable to fetch Chainlink data for ", symbol);
        }
    }

    function analyzeUniswap(address pool, uint32 twapWindow, bool isToken0, address targetToken, string memory symbol)
        internal
        view
    {
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool);

        console2.log("   Pool Address: ", pool);

        try uniPool.token0() returns (address token0) {
            try uniPool.token1() returns (address token1) {
                console2.log("   Token0: ", token0);
                console2.log("   Token1: ", token1);
                console2.log("   Target token is token0: ", isToken0);

                // Get token decimals
                uint8 decimals0 = IERC20Metadata(token0).decimals();
                uint8 decimals1 = IERC20Metadata(token1).decimals();
                console2.log("   Token0 Decimals: ", decimals0);
                console2.log("   Token1 Decimals: ", decimals1);

                // Get current price
                try uniPool.slot0() returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool) {
                    console2.log("   Current sqrtPriceX96: ", sqrtPriceX96);
                } catch {
                    console2.log("   Unable to fetch slot0");
                }

                // Try TWAP observation
                console2.log("   TWAP Window: ", twapWindow, " seconds");
                uint32[] memory secondsAgos = new uint32[](2);
                secondsAgos[0] = twapWindow;
                secondsAgos[1] = 0;

                try uniPool.observe(secondsAgos) returns (int56[] memory tickCumulatives, uint160[] memory) {
                    console2.log("   TWAP Observation SUCCESS");
                    int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
                    int24 arithmeticMeanTick = int24(tickDelta / int56(uint56(twapWindow)));
                    console2.log("   Tick Cumulative [0]: ", uint256(uint56(tickCumulatives[0])));
                    console2.log("   Tick Cumulative [1]: ", uint256(uint56(tickCumulatives[1])));
                    console2.log("   Arithmetic Mean Tick: ", uint256(uint24(arithmeticMeanTick)));

                    // Calculate approximate price from tick
                    // Note: This is simplified, actual calculation uses TickMath library
                    console2.log("");
                    console2.log("   IMPORTANT DECIMAL ANALYSIS:");
                    console2.log("   --------------------------");
                    if (isToken0) {
                        console2.log("   Pricing: token0 (", symbol, ") in terms of token1");
                        console2.log("   Quote token (token1) decimals: ", decimals1);
                    } else {
                        console2.log("   Pricing: token1 (", symbol, ") in terms of token0");
                        console2.log("   Quote token (token0) decimals: ", decimals0);
                    }
                    console2.log("");
                    console2.log("   CRITICAL: TWAP returns price in quote token units");
                    console2.log("   The price must be adjusted by: 10^(18 - quoteDecimals)");
                    console2.log("   to normalize to 18-decimal USD representation");
                    console2.log("");

                    if (!isToken0 && decimals0 == 6) {
                        console2.log("   For this config: multiply raw TWAP by 10^12");
                    } else if (isToken0 && decimals1 == 6) {
                        console2.log("   For this config: multiply raw TWAP by 10^12");
                    }
                } catch (bytes memory err) {
                    console2.log("   TWAP Observation FAILED");
                    console2.log("   Error data length: ", err.length);
                }
            } catch {
                console2.log("   ERROR: Unable to fetch pool tokens");
            }
        } catch {
            console2.log("   ERROR: Unable to fetch pool token0");
        }
    }

    function decodePriceDeviationError(bytes memory errorData) internal view {
        if (errorData.length >= 4) {
            bytes4 selector = bytes4(errorData);
            console2.log("   Error selector:");
            console2.logBytes4(selector);

            // PriceDeviationTooHigh(address,uint256,uint256)
            if (errorData.length >= 100) {
                (address token, uint256 price1, uint256 price2) =
                    abi.decode(_slice(errorData, 4, errorData.length - 4), (address, uint256, uint256));

                console2.log("");
                console2.log("   Decoded Error: PriceDeviationTooHigh");
                console2.log("   Token: ", token);
                console2.log("");
                console2.log("   Price 1 (Chainlink, raw): ", price1);
                console2.log("   Price 1 (Chainlink, USD): $", price1 / 1e18);
                console2.log("");
                console2.log("   Price 2 (TWAP, raw): ", price2);
                console2.log("   Price 2 (TWAP, USD): $", price2 / 1e18);
                console2.log("");

                // Calculate what TWAP SHOULD be if multiplied by 10^12
                uint256 adjustedTwap = price2 * 1e12;
                console2.log("   If TWAP was multiplied by 10^12: ", adjustedTwap);
                console2.log("   Adjusted TWAP (USD): $", adjustedTwap / 1e18);
                console2.log("");

                // Calculate deviation
                uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
                uint256 avg = (price1 + price2) / 2;
                if (avg > 0) {
                    uint256 deviation = (diff * 1e18) / avg;
                    console2.log("   Current Deviation: ", deviation / 1e16, "% (threshold: 5%)");
                }

                // Calculate deviation if TWAP was adjusted
                uint256 diffAdj = price1 > adjustedTwap ? price1 - adjustedTwap : adjustedTwap - price1;
                uint256 avgAdj = (price1 + adjustedTwap) / 2;
                if (avgAdj > 0) {
                    uint256 deviationAdj = (diffAdj * 1e18) / avgAdj;
                    console2.log("   Deviation if TWAP adjusted: ", deviationAdj / 1e16, "%");
                }
            }
        }
    }

    function _slice(bytes memory data, uint256 start, uint256 length) private pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }
}
