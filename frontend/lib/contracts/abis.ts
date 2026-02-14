/**
 * Contract ABIs for ISM Protocol Frontend
 *
 * Imports JSON ABIs from the liquidation bot for wagmi/viem compatibility
 *
 * We use JSON ABIs (not human-readable) for guaranteed wagmi/viem compatibility
 * and proper TypeScript type inference.
 *
 * To update ABIs after contract changes:
 * 1. cd ../liquidation_bot
 * 2. npm run extract-abis
 * 3. Restart the frontend dev server (ABIs are auto-imported from bot)
 */

// Import all ABIs from bot's generated JSON format
import {
  LENDINGPOOL_ABI,
  DUTCHAUCTIONLIQUIDATOR_ABI,
  ORACLEROUTER_ABI,
  MARKETREGISTRY_ABI,
  ERC20_ABI,
  POOLTOKEN_ABI,
  INTERESTRATEMODEL_ABI,
} from "./abis.generated";

// Re-export with consistent naming (with underscores)
export const LENDING_POOL_ABI = LENDINGPOOL_ABI;
export const LIQUIDATOR_ABI = DUTCHAUCTIONLIQUIDATOR_ABI;
export const ORACLE_ROUTER_ABI = ORACLEROUTER_ABI;
export const MARKET_REGISTRY_ABI = MARKETREGISTRY_ABI;
export const POOL_TOKEN_ABI = POOLTOKEN_ABI;
export const INTEREST_RATE_MODEL_ABI = INTERESTRATEMODEL_ABI;
export { ERC20_ABI };
