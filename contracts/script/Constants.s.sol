// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Constants {
    // sequencer uptime feed
    address internal constant SEQUENCER_UPTIME_FEED_BASE_MAINNET = 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433;

    // Interest rate model config
    uint256 internal constant BASE_RATE_PER_YEAR = 0;
    uint256 internal constant SLOPE_BEFORE_KINK = 0.04e18; // 4%
    uint256 internal constant SLOPE_AFTER_KINK = 0.75e18; // 75%
    uint256 internal constant KINK = 0.8e18; // 80%

    // Dutch Auction configuration
    uint64 internal constant AUCTION_DURATION = 1200; // 20 minutes
    uint64 internal constant START_PREMIUM = 1.05e18; // 105%
    uint64 internal constant END_DISCOUNT = 0.95e18; // 95%
    uint64 internal constant CLOSE_FACTOR = 0.5e18; // 50%

    // Common constants
    uint256 internal constant WAD = 1e18;
    uint256 internal constant MAX_BPS = 1e4;

    // default oracle config
    uint32 internal constant STALE_DELAY = 3600; // 1 hour
    uint32 internal constant TWAP_PERIOD = 1800; // 30 minutes

    /*//////////////////////////////////////////////////////////////
                            MARKET CREATION
    //////////////////////////////////////////////////////////////*/

    // Chainlink price feeds (Base Sepolia)
    address internal constant ETH_USD_FEED = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address internal constant BTC_USD_FEED = 0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298;
    address internal constant USDC_USD_FEED = 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165;
    address internal constant WETH_USD_FEED = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;

    // market tokens (Base Sepolia)
    address internal constant WETH_BASE_S = 0x4200000000000000000000000000000000000006;
    address internal constant USDC_BASE_S = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Uniswap V3 pools (Base Sepolia) -
    address internal constant WETH_USDC_POOL = 0x94bfc0574FF48E92cE43d495376C477B1d0EEeC0;

    // Market parameters (from protocol design)
    uint64 internal constant LTV = 0.75e18; // 75%
    uint64 internal constant LIQUIDATION_THRESHOLD = 0.8e18; // 80%
    uint64 internal constant LIQUIDATION_PENALTY = 0.05e18; // 5%
    uint64 internal constant RESERVE_FACTOR = 0.1e18; // 10%
}
