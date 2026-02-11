/**
 * Configuration loader for ISM Protocol Liquidation Bot
 * 
 * This file demonstrates how to load deployment addresses from the shared
 * deployments folder in the monorepo structure.
 */

import * as fs from 'fs';
import * as path from 'path';

// Type definitions matching the deployment JSON structure
export interface DeploymentConfig {
  chainId: number;
  network: string;
  contracts: {
    interestRateModel: string;
    oracleRouter: string;
    marketRegistry: string;
    lendingPoolImplementation: string;
    dutchAuctionLiquidator: string;
    marketFactory: string;
    chainId: number;
    deploymentTimestamp: number;
    deployer: string;
  };
  markets: Array<{
    pool: string;
    collateralToken: string;
    borrowToken: string;
    poolToken: string;
  }>;
  tokens: {
    WETH: string;
    USDC: string;
    WBTC?: string;
  };
  oracles: {
    ethUsdFeed: string;
    btcUsdFeed: string;
    usdcUsdFeed: string;
  };
}

/**
 * Load deployment configuration for a specific chain
 * @param chainId - The chain ID to load (e.g., 8453 for Base Mainnet, 84532 for Base Sepolia)
 * @returns Deployment configuration object
 */
export function loadDeployment(chainId: number): DeploymentConfig {
  // Path is relative to liquidation_bot/src, so go up two levels to reach deployments/
  const deploymentPath = path.join(__dirname, '../../deployments', `${chainId}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found for chain ${chainId}: ${deploymentPath}`);
  }
  
  const deploymentData = fs.readFileSync(deploymentPath, 'utf-8');
  return JSON.parse(deploymentData) as DeploymentConfig;
}

/**
 * Get deployment for current environment
 * Reads CHAIN_ID from environment variable
 */
export function getDeployment(): DeploymentConfig {
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 84532; // Default to Base Sepolia
  return loadDeployment(chainId);
}

// Example usage:
if (require.main === module) {
  try {
    // Load Base Sepolia deployment
    const deployment = loadDeployment(84532);
    
    console.log('=== ISM Protocol Deployment Info ===');
    console.log(`Network: ${deployment.network}`);
    console.log(`Chain ID: ${deployment.chainId}`);
    console.log('\n=== Core Contracts ===');
    console.log(`Market Factory: ${deployment.contracts.marketFactory}`);
    console.log(`Oracle Router: ${deployment.contracts.oracleRouter}`);
    console.log(`Liquidator: ${deployment.contracts.dutchAuctionLiquidator}`);
    console.log('\n=== Tokens ===');
    console.log(`WETH: ${deployment.tokens.WETH}`);
    console.log(`USDC: ${deployment.tokens.USDC}`);
    console.log('\n=== Markets ===');
    console.log(`Total markets: ${deployment.markets.length}`);
    deployment.markets.forEach((market, i) => {
      console.log(`Market ${i + 1}:`);
      console.log(`  Pool: ${market.pool}`);
      console.log(`  Collateral: ${market.collateralToken}`);
      console.log(`  Borrow: ${market.borrowToken}`);
    });
  } catch (error) {
    console.error('Error loading deployment:', error);
    process.exit(1);
  }
}

