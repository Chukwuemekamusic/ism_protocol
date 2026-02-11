/**
 * Contract ABIs for the Isolated Lending Markets Protocol.
 *
 * This file re-exports auto-generated ABIs from abis.human-readable.ts
 * The ABIs are extracted from Foundry build artifacts to ensure they
 * always match the deployed contracts.
 *
 * To regenerate from Foundry artifacts, run: npm run extract-abis
 */

// Re-export all ABIs from the generated human-readable file
export {
  LENDINGPOOL_ABI as LENDING_POOL_ABI,
  DUTCHAUCTIONLIQUIDATOR_ABI as LIQUIDATOR_ABI,
  ORACLEROUTER_ABI as ORACLE_ROUTER_ABI,
  MARKETREGISTRY_ABI as MARKET_REGISTRY_ABI,
  ERC20_ABI,
  POOLTOKEN_ABI as POOL_TOKEN_ABI,
  INTERESTRATEMODEL_ABI as INTEREST_RATE_MODEL_ABI,
} from './abis.human-readable';

// Note: If you prefer the full JSON ABIs (with more metadata), use:
// import { LENDINGPOOL_ABI } from './abis.generated';
