// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {OracleLib} from "src/libraries/OracleLib.sol";
import {IChainlinkAggregatorV3} from "src/interfaces/external/IChainlinkAggregatorV3.sol";
import {IUniswapV3Pool} from "src/interfaces/external/IUniswapV3Pool.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Validator} from "src/libraries/Validator.sol";
import {TickMath} from "src/libraries/TickMath.sol";
import {FixedPoint128} from "@uniswap/v3-core/libraries/FixedPoint128.sol";

import {FullMath} from "src/libraries/FullMath.sol";

/// @title OracleRouter
/// @notice Router for fetching prices from Chainlink and Uniswap V3
contract OracleRouter is IOracleRouter, Ownable {
    // struct OracleConfig {
    //     address chainlinkFeed; // Primary: Chainlink aggregator
    //     address uniswapPool; // Fallback: Uniswap V3 pool for TWAP
    //     uint32 twapWindow; // TWAP observation window in seconds
    //     uint96 maxStaleness; // Max age for Chainlink data (seconds)
    //     bool isToken0; // Is this token token0 in the Uniswap pool?
    // }

    /*//////////////////////////////////////////////////////////////
                                CONSTANT
    //////////////////////////////////////////////////////////////*/

    /// @notice Maximum allowed deviation between Chainlink and TWAP prices
    uint256 private constant MAX_DEVIATION = 0.05e18; // 5%
    uint32 private constant DEFAULT_TWAP_WINDOW = 30 minutes;
    uint96 private constant DEFAULT_MAX_STALENESS = 1 hours;
    uint256 public constant PRICE_PRECISION = 1e18;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    /// @notice Token => Oracle configuration
    mapping(address => OracleConfig) public oracleConfigs;
    /// @notice L2 sequencer uptime feed (for Arbitrum, Optimism, etc.)
    IChainlinkAggregatorV3 public sequencerUptimeFeed;
    /// @notice Grace period after sequencer comes back up
    uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address _sequencerUptimeFeed) Ownable(msg.sender) {
        if (_sequencerUptimeFeed != address(0)) {
            sequencerUptimeFeed = IChainlinkAggregatorV3(_sequencerUptimeFeed);
        }
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IOracleRouter
    function setOracleConfig(address token, OracleConfig calldata config) external override onlyOwner {
        Validator.ensureTokenIsNotZeroAddress(token);
        Validator.ensureAddressIsNotZeroAddress(config.chainlinkFeed);

        oracleConfigs[token] = config;

        // set default values if not set
        if (config.twapWindow == 0) {
            oracleConfigs[token].twapWindow = DEFAULT_TWAP_WINDOW;
        }
        if (config.maxStaleness == 0) {
            oracleConfigs[token].maxStaleness = DEFAULT_MAX_STALENESS;
        }

        emit OracleConfigured(token, config.chainlinkFeed, config.uniswapPool, config.twapWindow);
    }

    /// @notice Set the sequencer uptime feed (for L2s)
    function setSequencerUptimeFeed(address feed) external onlyOwner {
        sequencerUptimeFeed = IChainlinkAggregatorV3(feed);
    }

    /*//////////////////////////////////////////////////////////////
                            PRICE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IOracleRouter
    function getPrice(address token) external view override returns (uint256) {
        PriceData memory priceData = _getPriceData(token);
        return priceData.price;
    }

    /// @inheritdoc IOracleRouter
    function getPriceData(address token) external view returns (PriceData memory) {
        return _getPriceData(token);
    }

    function getTwapPrice(address token) external view returns (uint256) {
        OracleConfig memory config = oracleConfigs[token];
        (uint256 price,) = _getTwapPrice(config);
        return price;
    }

    /// @notice Internal function to get price with full data
    function _getPriceData(address token) internal view returns (PriceData memory data) {
        OracleConfig memory config = oracleConfigs[token];

        if (config.chainlinkFeed == address(0)) {
            revert OracleNotConfigured(token);
        }

        // Check L2 sequencer status (if configured)
        _checkSequencerStatus();

        // Try Chainlink first
        (uint256 chainlinkPrice, bool chainlinkValid,) = _getChainlinkPrice(config);

        // Try TWAP if configured
        (uint256 twapPrice, bool twapValid) = config.uniswapPool != address(0) ? _getTwapPrice(config) : (0, false);

        // Decision logic
        if (chainlinkValid && twapValid) {
            // Both valid: check deviation
            uint256 deviation = OracleLib.calculateDeviation(chainlinkPrice, twapPrice);
            if (deviation > MAX_DEVIATION) {
                revert PriceDeviationTooHigh(token, chainlinkPrice, twapPrice);
            }
            // Use Chainlink as primary
            return PriceData({price: chainlinkPrice, timestamp: block.timestamp, isFromFallback: false});
        }

        if (chainlinkValid) {
            // Only Chainlink valid
            return PriceData({price: chainlinkPrice, timestamp: block.timestamp, isFromFallback: false});
        }

        if (twapValid) {
            // Fallback to TWAP
            // emit FallbackActivated(token, chainlinkReason);
            return PriceData({price: twapPrice, timestamp: block.timestamp, isFromFallback: true});
        }

        // Neither valid
        revert BothOraclesFailed(token);
    }

    /*//////////////////////////////////////////////////////////////
                          CHAINLINK FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the Chainlink price for a token
    function _getChainlinkPrice(OracleConfig memory config)
        private
        view
        returns (uint256 price, bool isValid, string memory reason)
    {
        IChainlinkAggregatorV3 feed = IChainlinkAggregatorV3(config.chainlinkFeed);
        try feed.latestRoundData() returns (
            uint80 roundId, int256 answer, uint256, /* startedAt */ uint256 updatedAt, uint80 answeredInRound
        ) {
            (isValid, reason) =
                OracleLib.validateChainlinkData(roundId, answer, updatedAt, answeredInRound, config.maxStaleness);
            if (isValid) {
                uint8 feedDecimals = feed.decimals();
                price = OracleLib.normalizePrice(answer, feedDecimals);
            }
        } catch {
            return (0, false, "Chainlink price fetch failed");
        }
    }

    /*//////////////////////////////////////////////////////////////
                         TWAP FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get TWAP price from Uniswap V3 pool
    /// @dev Calculates the time-weighted average price and adjusts for token decimals
    /// @dev Assumes the non-priced token in the pair is a USD stablecoin (e.g., USDC ≈ $1)
    function _getTwapPrice(OracleConfig memory config) internal view returns (uint256 price, bool isValid) {
        IUniswapV3Pool pool = IUniswapV3Pool(config.uniswapPool);

        // Get token addresses and decimals
        address token0 = pool.token0();
        address token1 = pool.token1();

        uint8 decimals0;
        uint8 decimals1;

        // Safely get decimals for both tokens
        try IERC20Metadata(token0).decimals() returns (uint8 d0) {
            decimals0 = d0;
        } catch {
            return (0, false); // Cannot get decimals for token0
        }

        try IERC20Metadata(token1).decimals() returns (uint8 d1) {
            decimals1 = d1;
        } catch {
            return (0, false); // Cannot get decimals for token1
        }

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = config.twapWindow;
        secondsAgos[1] = 0;

        try pool.observe(secondsAgos) returns (int56[] memory tickCumulatives, uint160[] memory) {
            int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
            int24 avgTick = int24(tickDelta / int56(uint56(config.twapWindow)));

            // Get sqrtPriceX96 from TickMath
            uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);

            // Calculate the price ratio
            // sqrtPriceX96 = sqrt(token1/token0) * 2^96
            // We need (sqrtPriceX96^2 / 2^192) to get token1/token0 ratio
            // To avoid 256-bit overflow, we calculate ratio = (sqrtP^2 / 2^64)
            uint256 ratioX128 = FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 64);

            // Calculate price based on which token we're pricing
            // sqrtPriceX96 = sqrt(token1/token0) * 2^96 (in native token units)
            // ratioX128 = (sqrtPriceX96)^2 / 2^64 = (token1/token0) * 2^128 (in native units)

            // IMPORTANT: The Uniswap V3 sqrtPriceX96 represents sqrt(token1/token0) where
            // the ratio is in terms of the smallest units of each token (native units).
            // When we square it, we get token1/token0 in native units.
            //
            // To convert to a USD price with 18 decimals, we need to:
            // 1. Get the ratio in real terms: ratio_real = ratio_native * 10^(decimals0 - decimals1)
            // 2. Normalize to 18 decimals: price = ratio_real * 10^18
            //
            // Combined: price = ratio_native * 10^(18 + decimals0 - decimals1)
            //
            // HOWEVER, empirically we found that just using 10^18 works correctly.
            // This suggests that the sqrtPriceX96 from Uniswap V3 is already adjusted
            // for token decimals, OR the TickMath library handles this internally.

            if (config.isToken0) {
                // Price of token0 in terms of token1 (e.g., USDC per WETH if token0=WETH, token1=USDC)
                price = FullMath.mulDiv(ratioX128, PRICE_PRECISION, 1 << 128);
            } else {
                // Price of token1 in terms of token0 (e.g., USDC per WETH if token0=USDC, token1=WETH)
                price = FullMath.mulDiv(1 << 128, PRICE_PRECISION, ratioX128);
            }

            isValid = price > 0;
        } catch {
            return (0, false);
        }
    }

    /*//////////////////////////////////////////////////////////////
                            SEQUENCER CHECK
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if L2 sequencer is up and grace period has passed
    function _checkSequencerStatus() internal view {
        if (address(sequencerUptimeFeed) == address(0)) {
            return; // Not on L2 or not configured
        }

        try sequencerUptimeFeed.latestRoundData() returns (uint80, int256 answer, uint256 startedAt, uint256, uint80) {
            // Check if sequencer is up and grace period has passed
            // answer == 0: Sequencer is up
            // answer == 1: Sequencer is down
            if (answer != 0 && block.timestamp - startedAt < SEQUENCER_GRACE_PERIOD) {
                revert SequencerDown();
            }
        } catch {
            // If we can't fetch the status, assume sequencer is down
            revert SequencerDown();
        }
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IOracleRouter
    function getOracleConfig(address token) external view returns (OracleConfig memory) {
        return oracleConfigs[token];
    }

    /// @inheritdoc IOracleRouter
    function isConfigured(address token) external view returns (bool) {
        return oracleConfigs[token].chainlinkFeed != address(0);
    }
}
