/**
 * Contract Deployment Addresses
 *
 * Loads deployed contract addresses from the shared deployments directory
 * Supports multiple chains (Base Mainnet, Base Sepolia)
 */

// Import deployment JSONs (these will be loaded at build time)
import baseSepolia from './deployments/84532.json';

// TypeScript interfaces
export interface DeploymentContracts {
  interestRateModel: string;
  oracleRouter: string;
  marketRegistry: string;
  lendingPoolImplementation: string;
  dutchAuctionLiquidator: string;
  marketFactory: string;
  chainId: number;
  deploymentTimestamp: number;
  deployer: string;
}

export interface Market {
  address: string;
  collateralToken: string;
  borrowToken: string;
  collateralSymbol?: string;
  borrowSymbol?: string;
}

export interface Deployment {
  chainId: number;
  network: string;
  contracts: DeploymentContracts;
  markets: Market[];
  tokens: Record<string, string>;
  oracles: Record<string, string>;
}

// Supported chain IDs
export const SUPPORTED_CHAINS = {
  BASE_SEPOLIA: 84532,
  BASE_MAINNET: 8453,
} as const;

export type SupportedChainId = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

// Deployment data by chain ID
const DEPLOYMENTS: Record<number, Deployment> = {
  [SUPPORTED_CHAINS.BASE_SEPOLIA]: baseSepolia as Deployment,
  // Add Base Mainnet when deployed
  // [SUPPORTED_CHAINS.BASE_MAINNET]: baseMainnet as Deployment,
};

/**
 * Get deployment data for a specific chain
 */
export function getDeployment(chainId: number): Deployment {
  const deployment = DEPLOYMENTS[chainId];
  if (!deployment) {
    throw new Error(`No deployment found for chain ID: ${chainId}`);
  }
  return deployment;
}

/**
 * Get a specific contract address for a chain
 */
export function getContractAddress(
  chainId: number,
  contractName: keyof DeploymentContracts
): `0x${string}` {
  const deployment = getDeployment(chainId);
  const address = deployment.contracts[contractName];

  if (!address || typeof address !== 'string') {
    throw new Error(`Contract ${contractName} not found in deployment for chain ${chainId}`);
  }

  return address as `0x${string}`;
}

/**
 * Get all markets for a chain
 */
export function getMarkets(chainId: number): Market[] {
  const deployment = getDeployment(chainId);
  return deployment.markets || [];
}

/**
 * Get token address for a chain
 */
export function getTokenAddress(chainId: number, symbol: string): `0x${string}` {
  const deployment = getDeployment(chainId);
  const address = deployment.tokens[symbol];

  if (!address) {
    throw new Error(`Token ${symbol} not found in deployment for chain ${chainId}`);
  }

  return address as `0x${string}`;
}

/**
 * Get all available token symbols for a chain
 */
export function getAvailableTokens(chainId: number): string[] {
  const deployment = getDeployment(chainId);
  return Object.keys(deployment.tokens);
}

/**
 * Check if a chain is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in DEPLOYMENTS;
}

// Export contract addresses for default chain (Base Sepolia)
export const DEFAULT_CHAIN_ID = SUPPORTED_CHAINS.BASE_SEPOLIA;
export const CONTRACTS = getDeployment(DEFAULT_CHAIN_ID).contracts;
