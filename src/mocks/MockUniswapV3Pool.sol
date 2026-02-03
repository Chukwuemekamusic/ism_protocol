// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IUniswapV3Pool} from "../interfaces/external/IUniswapV3Pool.sol";

/// @title MockUniswapV3Pool
/// @notice Mock Uniswap V3 pool for TWAP testing
/// @dev Only implements observe() and basic getters needed for oracle fallback
contract MockUniswapV3Pool is IUniswapV3Pool {
    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    address private _token0;
    address private _token1;
    uint24 private _fee;
    
    // Current pool state
    uint160 private _sqrtPriceX96;
    int24 private _currentTick;
    
    // For TWAP simulation
    int56 private _tickCumulative;
    uint160 private _secondsPerLiquidityCumulativeX128;
    
    // Manual TWAP tick setting
    int24 private _twapTick;
    bool private _useTwapTick;
    
    // Control behavior
    bool private _shouldRevert;
    
    // Observation history (simplified)
    mapping(uint256 => Observation) private _observations;
    uint256 private _observationIndex;

    struct Observation {
        uint32 blockTimestamp;
        int56 tickCumulative;
        uint160 secondsPerLiquidityCumulativeX128;
        bool initialized;
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy mock pool with token pair
    /// @param token0_ First token (sorted by address)
    /// @param token1_ Second token (sorted by address)
    constructor(address token0_, address token1_) {
        _token0 = token0_;
        _token1 = token1_;
        _fee = 3000; // 0.3% default fee
        
        // Initialize with a reasonable tick (~$2000 ETH/USDC)
        _currentTick = 74959; // approximately ln(2000) / ln(1.0001)
        _sqrtPriceX96 = 1771595571142957166518320255467520; // sqrt(2000) * 2^96
        
        // Initialize first observation
        _observations[0] = Observation({
            blockTimestamp: uint32(block.timestamp),
            tickCumulative: 0,
            secondsPerLiquidityCumulativeX128: 0,
            initialized: true
        });
    }

    /*//////////////////////////////////////////////////////////////
                          SETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Set the current tick (affects spot price)
    /// @param tick_ New tick value
    function setTick(int24 tick_) external {
        _currentTick = tick_;
    }

    /// @notice Set a fixed TWAP tick for observe() to return
    /// @param twapTick_ The average tick to return for TWAP calculations
    /// @dev This simplifies testing by directly setting the TWAP result
    function setTwapTick(int24 twapTick_) external {
        _twapTick = twapTick_;
        _useTwapTick = true;
    }

    /// @notice Disable fixed TWAP tick and use calculated values
    function disableTwapTick() external {
        _useTwapTick = false;
    }

    /// @notice Set the sqrt price directly
    /// @param sqrtPriceX96_ New sqrt price in Q64.96 format
    function setSqrtPriceX96(uint160 sqrtPriceX96_) external {
        _sqrtPriceX96 = sqrtPriceX96_;
    }

    /// @notice Set the fee tier
    /// @param fee_ Fee in hundredths of a bip (e.g., 3000 = 0.3%)
    function setFee(uint24 fee_) external {
        _fee = fee_;
    }

    /// @notice Make observe() revert (simulate oracle failure)
    /// @param shouldRevert_ Whether to revert
    function setShouldRevert(bool shouldRevert_) external {
        _shouldRevert = shouldRevert_;
    }

    /// @notice Add an observation (for more realistic TWAP simulation)
    /// @param tickCumulative_ Cumulative tick value
    /// @param timestamp_ Block timestamp
    function addObservation(int56 tickCumulative_, uint32 timestamp_) external {
        _observationIndex++;
        _observations[_observationIndex] = Observation({
            blockTimestamp: timestamp_,
            tickCumulative: tickCumulative_,
            secondsPerLiquidityCumulativeX128: 0,
            initialized: true
        });
    }

    /// @notice Set up observations for a specific TWAP window
    /// @param avgTick The desired average tick
    /// @param windowSeconds The TWAP window in seconds
    /// @dev Sets up observations so observe() returns the desired average tick
    function setupTwapObservations(int24 avgTick, uint32 windowSeconds) external {
        uint32 currentTime = uint32(block.timestamp);
        uint32 pastTime = currentTime - windowSeconds;
        
        // Past observation
        _observations[0] = Observation({
            blockTimestamp: pastTime,
            tickCumulative: 0,
            secondsPerLiquidityCumulativeX128: 0,
            initialized: true
        });
        
        // Current observation
        // tickCumulative increases by avgTick every second
        int56 currentTickCumulative = int56(avgTick) * int56(uint56(windowSeconds));
        
        _observations[1] = Observation({
            blockTimestamp: currentTime,
            tickCumulative: currentTickCumulative,
            secondsPerLiquidityCumulativeX128: 0,
            initialized: true
        });
        
        _observationIndex = 1;
        _currentTick = avgTick;
    }

    /*//////////////////////////////////////////////////////////////
                       UNISWAP V3 INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IUniswapV3Pool
    function observe(uint32[] calldata secondsAgos)
        external
        view
        override
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        )
    {
        if (_shouldRevert) {
            revert("Observation unavailable");
        }

        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);

        // If using fixed TWAP tick, calculate cumulative values to produce that tick
        if (_useTwapTick) {
            for (uint256 i = 0; i < secondsAgos.length; i++) {
                // tickCumulative at time T = avgTick * T
                // So tickDelta over window = avgTick * window
                uint32 targetTime = uint32(block.timestamp) - secondsAgos[i];
                tickCumulatives[i] = int56(_twapTick) * int56(uint56(targetTime));
                secondsPerLiquidityCumulativeX128s[i] = 0;
            }
            return (tickCumulatives, secondsPerLiquidityCumulativeX128s);
        }

        // Use stored observations
        for (uint256 i = 0; i < secondsAgos.length; i++) {
            uint32 targetTime = uint32(block.timestamp) - secondsAgos[i];
            
            // Find closest observation
            (int56 tickCum, uint160 secPerLiq) = _getObservationAt(targetTime);
            
            tickCumulatives[i] = tickCum;
            secondsPerLiquidityCumulativeX128s[i] = secPerLiq;
        }
    }

    /// @inheritdoc IUniswapV3Pool
    function token0() external view override returns (address) {
        return _token0;
    }

    /// @inheritdoc IUniswapV3Pool
    function token1() external view override returns (address) {
        return _token1;
    }

    /// @inheritdoc IUniswapV3Pool
    function fee() external view override returns (uint24) {
        return _fee;
    }

    /// @inheritdoc IUniswapV3Pool
    function slot0()
        external
        view
        override
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        return (
            _sqrtPriceX96,
            _currentTick,
            uint16(_observationIndex),
            uint16(_observationIndex + 1),
            uint16(_observationIndex + 1),
            0,
            true
        );
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get observation at a specific timestamp (simplified interpolation)
    function _getObservationAt(uint32 targetTime) 
        internal 
        view 
        returns (int56 tickCumulative, uint160 secondsPerLiquidityCumulative) 
    {
        // Simple implementation: find closest observation or interpolate
        Observation memory obs = _observations[_observationIndex];
        
        if (!obs.initialized) {
            // Return based on current tick
            return (int56(_currentTick) * int56(uint56(targetTime)), 0);
        }

        // Linear interpolation based on current tick
        int56 timeDelta = int56(uint56(targetTime)) - int56(uint56(obs.blockTimestamp));
        tickCumulative = obs.tickCumulative + (int56(_currentTick) * timeDelta);
        
        return (tickCumulative, 0);
    }

    /*//////////////////////////////////////////////////////////////
                         HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get current tick
    function getCurrentTick() external view returns (int24) {
        return _currentTick;
    }

    /// @notice Get current sqrt price
    function getCurrentSqrtPriceX96() external view returns (uint160) {
        return _sqrtPriceX96;
    }

    /// @notice Calculate tick for a given price (helper for test setup)
    /// @param price Price with 18 decimals (e.g., 2000e18 for $2000)
    /// @return tick Approximate tick value
    /// @dev tick = log(price) / log(1.0001), simplified calculation
    function priceToTick(uint256 price) external pure returns (int24 tick) {
        // Simplified: tick ≈ log2(price) * 6932 (since log(1.0001) ≈ 1/6932)
        // This is approximate but good enough for testing
        require(price > 0, "Price must be positive");
        
        // For price around 2000, tick ≈ 74959
        // For price around 1800, tick ≈ 74363
        // For price around 2200, tick ≈ 75525
        
        // Use a lookup-based approximation for common test values
        if (price >= 2200e18) return 75525;
        if (price >= 2000e18) return 74959;
        if (price >= 1800e18) return 74363;
        if (price >= 1600e18) return 73742;
        if (price >= 1400e18) return 73090;
        if (price >= 1200e18) return 72397;
        if (price >= 1000e18) return 71657;
        
        // Fallback for other values
        return 70000;
    }

    /// @notice Calculate approximate price from tick (helper for verification)
    /// @param tick The tick value
    /// @return price Approximate price with 18 decimals
    function tickToPrice(int24 tick) external pure returns (uint256 price) {
        // price = 1.0001^tick
        // Simplified lookup for common test ranges
        if (tick >= 75525) return 2200e18;
        if (tick >= 74959) return 2000e18;
        if (tick >= 74363) return 1800e18;
        if (tick >= 73742) return 1600e18;
        if (tick >= 73090) return 1400e18;
        if (tick >= 72397) return 1200e18;
        if (tick >= 71657) return 1000e18;
        
        return 500e18; // Fallback
    }
}
