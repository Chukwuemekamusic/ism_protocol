/**
 * Contract ABIs for the Isolated Lending Markets Protocol.
 *
 * This file re-exports auto-generated ABIs from abis.generated.ts (JSON format)
 * The ABIs are extracted from Foundry build artifacts to ensure they
 * always match the deployed contracts.
 *
 * We use JSON ABIs (not human-readable) for guaranteed wagmi/viem compatibility.
 *
 * To regenerate from Foundry artifacts, run: npm run extract-abis
 */

// Re-export all ABIs from the generated JSON file
export {
  LENDINGPOOL_ABI as LENDING_POOL_ABI,
  DUTCHAUCTIONLIQUIDATOR_ABI as LIQUIDATOR_ABI,
  ORACLEROUTER_ABI as ORACLE_ROUTER_ABI,
  MARKETREGISTRY_ABI as MARKET_REGISTRY_ABI,
  ERC20_ABI,
  POOLTOKEN_ABI as POOL_TOKEN_ABI,
  INTERESTRATEMODEL_ABI as INTEREST_RATE_MODEL_ABI,
} from './abis.generated';

// Note: Human-readable ABIs are kept in abis.human-readable.ts for reference/documentation only
