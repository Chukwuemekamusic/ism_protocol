import { config as dotenvConfig } from "dotenv";
import { BotConfig } from "./types";

dotenvConfig();

/**
 * Require an environment variable to be set.
 * Throws a clear error message if missing.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "" || value === "0x") {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value.trim();
}

/**
 * Return an optional environment variable, or a default value if missing.
 */
function optionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") return defaultValue;
  return value.trim();
}

/**
 * Validate that a string looks like an Ethereum address.
 */
function validateAddress(value: string, name: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid Ethereum address for ${name} address: ${value}`);
  }
  return value;
}

/**
 * Load and validate the complete bot configuration from environment variables.
 *
 * Required vars: RPC_URL, WS_URL, CHAIN_ID, PRIVATE_KEY,
 *                MARKET_REGISTRY_ADDRESS, ORACLE_ROUTER_ADDRESS, LIQUIDATOR_ADDRESS
 *
 * Optional vars (with defaults): MIN_PROFIT_USD, MAX_GAS_PRICE, GAS_MULTIPLIER,
 *                                 POLLING_INTERVAL_MS, HF_THRESHOLD,
 *                                 HISTORICAL_BLOCK_RANGE, LOG_LEVEL
 */
export async function loadConfig(): Promise<BotConfig> {
  const config: BotConfig = {
    // Network
    rpcUrl: requireEnv("RPC_URL"),
    wsUrl: requireEnv("WS_URL"),
    chainId: parseInt(requireEnv("CHAIN_ID")),

    // Wallet
    privateKey: requireEnv("PRIVATE_KEY"),

    // Contracts
    marketRegistry: "",
    oracleRouter: "",
    liquidator: "",

    // Execution parameters
    minProfitUsd: parseFloat(optionalEnv("MIN_PROFIT_USD", "0.001")),
    maxGasPrice: BigInt(optionalEnv("MAX_GAS_PRICE", "50000000000")), // 50 gwei
    gasMultiplier: parseFloat(optionalEnv("GAS_MULTIPLIER", "1.2")),

    // Monitoring
    pollingIntervalMs: Number(optionalEnv("POLLING_INTERVAL_MS", "2000")),
    healthFactorThreshold: BigInt(
      optionalEnv("HF_THRESHOLD", "1100000000000000000"),
    ), // 1.1
    historicalBlockRange: Number(
      optionalEnv("HISTORICAL_BLOCK_RANGE", "10000"),
    ),

    // Logging
    logLevel: optionalEnv("LOG_LEVEL", "info") as BotConfig["logLevel"],
  };

  // Resolve contract addresses: .env takes priority, else read from deployments/
  const envRegistry = process.env.MARKET_REGISTRY_ADDRESS;
  const envOracle = process.env.ORACLE_ROUTER_ADDRESS;
  const envLiquidator = process.env.LIQUIDATOR_ADDRESS;

  if (
    envRegistry &&
    envOracle &&
    envLiquidator &&
    envRegistry !== "0x..." &&
    envOracle !== "0x..." &&
    envLiquidator !== "0x..."
  ) {
    config.marketRegistry = validateAddress(
      envRegistry,
      "MARKET_REGISTRY_ADDRESS",
    );
    config.oracleRouter = validateAddress(envOracle, "ORACLE_ROUTER_ADDRESS");
    config.liquidator = validateAddress(envLiquidator, "LIQUIDATOR_ADDRESS");
  } else {
    // Fall back to deployment file
    const { loadDeployment } = await import("./contracts/addresses.js");
    const deployment = loadDeployment(config.chainId);
    config.marketRegistry = validateAddress(
      deployment.contracts.marketRegistry,
      "marketRegistry",
    );
    config.oracleRouter = validateAddress(
      deployment.contracts.oracleRouter,
      "oracleRouter",
    );
    config.liquidator = validateAddress(
      deployment.contracts.liquidator,
      "liquidator",
    );
  }

  // Validate
  validateConfig(config);

  return config;
}

function validateConfig(config: BotConfig): BotConfig {
  // Validate
  if (isNaN(config.chainId) || config.chainId <= 0) {
    throw new Error(`Invalid CHAIN_ID: ${config.chainId}`);
  }
  if (config.minProfitUsd <= 0) {
    throw new Error(`Invalid MIN_PROFIT_USD: ${config.minProfitUsd}`);
  }

  if (config.gasMultiplier < 1) {
    throw new Error("GAS_MULTIPLIER must be >= 1");
  }
  if (!["debug", "info", "warn", "error"].includes(config.logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${config.logLevel}`);
  }

  return config;
}
