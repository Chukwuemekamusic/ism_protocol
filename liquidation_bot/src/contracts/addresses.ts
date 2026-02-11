/**
 * Loads contract addresses from the shared deployments/ directory.
 * This keeps addresses in sync between contracts and bot.
 */

import { readFileSync } from "fs";
import { join } from "path";

export interface DeploymentAddresses {
  chainId: number;
  network: string;
  contracts: {
    interestRateModel: string;
    oracleRouter: string;
    lendingPoolImpl: string;
    liquidator: string;
    marketRegistry: string;
    marketFactory: string;
    poolTokenImpl: string;
  };
  markets: string[];
  tokens: Record<string, string>;
  oracles: Record<string, string>;
}

/**
 * Load deployment addresses for a given chain ID.
 * Reads from ism_protocol/deployments/{chainId}.json
 */
export function loadDeployment(chainId: number): DeploymentAddresses {
  const deploymentsDir = join(process.cwd(), "..", "deployments");
  const filePath = join(deploymentsDir, `${chainId}.json`);

  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as DeploymentAddresses;
  } catch (error) {
    throw new Error(
      `Deployment file not found: ${filePath}\n` +
        `Make sure you've deployed contracts and saved addresses to deployments/${chainId}.json`,
    );
  }
}
