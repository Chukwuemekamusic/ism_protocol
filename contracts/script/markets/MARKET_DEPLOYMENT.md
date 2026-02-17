# Market Deployment Guide

This guide explains how to deploy new lending markets using the ISM Protocol deployment scripts.

## Overview

The ISM Protocol uses a flexible market deployment system that allows you to create isolated lending markets for any token pair. Each market is independent, preventing contagion between different assets.

## Quick Start

### Deploy Default WETH/USDC Market

```bash
cd contracts
forge script script/DeployMarket.s.sol:DeployMarket \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account testnet \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --slow
```

### Deploy USDC/WETH Market (Reverse Pair)

```bash
cd contracts
forge script script/DeployUSDCWETHMarket.s.sol:DeployUSDCWETHMarket \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account testnet \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --slow
```

## Creating a New Market Pair

### Step 1: Add Token Constants (if needed)

If your token isn't already in `Constants.s.sol`, add it:

```solidity
// In contracts/script/Constants.s.sol

// Add token address
address internal constant YOUR_TOKEN_BASE_S = 0x...;

// Add Chainlink price feed
address internal constant YOUR_TOKEN_USD_FEED = 0x...;

// (Optional) Add Uniswap V3 pool for TWAP fallback
address internal constant YOUR_TOKEN_USDC_POOL = 0x...;
```

### Step 2: Add Oracle Configuration

Update `DeployMarket.s.sol` to include oracle configuration for your token:

```solidity
// In _configureTokenOracle function, add a new else-if block:

else if (token == Constants.YOUR_TOKEN_BASE_S) {
    IOracleRouter.OracleConfig memory config = IOracleRouter.OracleConfig({
        chainlinkFeed: Constants.YOUR_TOKEN_USD_FEED,
        uniswapPool: Constants.YOUR_TOKEN_USDC_POOL, // or address(0) if no fallback
        twapWindow: 30 minutes,
        maxStaleness: Constants.TESTNET_MAX_STALENESS,
        isToken0: false // Check Uniswap pool to determine this
    });
    oracleRouter.setOracleConfig(token, config);
    console.log("[OK] YOUR_TOKEN oracle configured");
}
```

### Step 3: Create Deployment Script

Create a new script file (e.g., `DeployYourMarket.s.sol`):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DeployMarket} from "./DeployMarket.s.sol";
import {Constants} from "./Constants.s.sol";

/// @title DeployYourMarket
/// @notice Script to create YOUR_TOKEN/USDC lending market
contract DeployYourMarket is DeployMarket {
    function run() external override {
        deployMarket(
            Constants.YOUR_TOKEN_BASE_S,  // collateral
            Constants.USDC_BASE_S,        // borrow
            "YOUR_TOKEN",                 // collateral symbol
            "USDC"                        // borrow symbol
        );
    }
}
```

### Step 4: Deploy the Market

```bash
cd contracts
forge script script/DeployYourMarket.s.sol:DeployYourMarket \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account testnet \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --slow
```

## Market Parameters

All markets use the same risk parameters defined in `Constants.s.sol`:

- **LTV (Loan-to-Value)**: 75% - Maximum borrow as % of collateral value
- **Liquidation Threshold**: 80% - Health factor threshold for liquidation
- **Liquidation Penalty**: 5% - Bonus for liquidators
- **Reserve Factor**: 10% - Protocol fee on interest

To use different parameters for a specific market, you can override them in your deployment script.

## Finding Token Addresses

### Base Sepolia Testnet

- **WETH**: `0x4200000000000000000000000000000000000006`
- **USDC**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### Chainlink Price Feeds (Base Sepolia)

- **ETH/USD**: `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1`
- **BTC/USD**: `0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298`
- **USDC/USD**: `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165`

Find more feeds at: https://docs.chain.link/data-feeds/price-feeds/addresses?network=base

### Uniswap V3 Pools (Base Sepolia)

- **WETH/USDC**: `0x94bfc0574FF48E92cE43d495376C477B1d0EEeC0`

Find pools at: https://app.uniswap.org/explore/pools/base-sepolia

## Verification

After deployment, verify the market was created:

1. Check the deployment JSON file: `deployments/84532.json`
2. The new market should appear in the `markets` array
3. Verify on BaseScan: https://sepolia.basescan.org

## Troubleshooting

### Oracle Not Configured

If you see `[WARNING] No oracle configuration found for token`, you need to add the oracle configuration in `_configureTokenOracle`.

### Market Already Exists

The protocol prevents creating duplicate markets. If a market for the same collateral/borrow pair already exists, the transaction will revert.

### Price Feed Stale

On testnet, price feeds may become stale. The protocol uses a 4-day staleness window for testnet (`TESTNET_MAX_STALENESS`).

## Examples

See the following example scripts:
- `DeployMarket.s.sol` - Default WETH/USDC market
- `DeployUSDCWETHMarket.s.sol` - USDC/WETH reverse pair

