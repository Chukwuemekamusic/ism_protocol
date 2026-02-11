/**
 * Extract ABIs from Foundry build artifacts (ism_protocol/out/).
 *
 * This is a helper script to regenerate ABI fragments when contracts change.
 * Run: npm run extract-abis
 *
 * It reads the compiled JSON artifacts and prints the ABI arrays.
 * You can then update src/contracts/abis.ts with the output.
 *
 * Note: The bot uses ethers v6 human-readable ABI format in abis.ts,
 * so this script is mainly for reference/verification.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const ISM_PROTOCOL_DIR = join(process.cwd(), "..", "contracts");
const OUT_DIR = join(ISM_PROTOCOL_DIR, "out");

const CONTRACTS_TO_EXTRACT = [
  { name: "LendingPool", path: "LendingPool.sol/LendingPool.json" },
  {
    name: "DutchAuctionLiquidator",
    path: "DutchAuctionLiquidator.sol/DutchAuctionLiquidator.json",
  },
  { name: "OracleRouter", path: "OracleRouter.sol/OracleRouter.json" },
  { name: "MarketRegistry", path: "MarketRegistry.sol/MarketRegistry.json" },
];

function extractAbi(contractName: string, artifactPath: string): void {
  const fullPath = join(OUT_DIR, artifactPath);

  if (!existsSync(fullPath)) {
    console.warn(`⚠️  ${contractName}: artifact not found at ${fullPath}`);
    console.warn(`   Run 'forge build' in contracts/ first.`);
    return;
  }

  try {
    const artifact = JSON.parse(readFileSync(fullPath, "utf-8"));
    const abi = artifact.abi;

    console.log(`\n// ============================================`);
    console.log(`// ${contractName} ABI (${abi.length} entries)`);
    console.log(`// ============================================`);

    // Print functions
    const functions = abi.filter((item: any) => item.type === "function");
    console.log(`\n// Functions (${functions.length}):`);
    for (const fn of functions) {
      const inputs = fn.inputs
        .map((i: any) => `${i.type} ${i.name}`)
        .join(", ");
      const outputs = fn.outputs?.map((o: any) => o.type).join(", ") ?? "";
      const mutability = fn.stateMutability === "view" ? " view" : "";
      console.log(
        `//   ${fn.name}(${inputs})${mutability}${outputs ? ` → ${outputs}` : ""}`,
      );
    }

    // Print events
    const events = abi.filter((item: any) => item.type === "event");
    console.log(`\n// Events (${events.length}):`);
    for (const ev of events) {
      const inputs = ev.inputs
        .map((i: any) => `${i.indexed ? "indexed " : ""}${i.type} ${i.name}`)
        .join(", ");
      console.log(`//   ${ev.name}(${inputs})`);
    }

    console.log("");
  } catch (error) {
    console.error(`❌ ${contractName}: failed to parse artifact — ${error}`);
  }
}

// Main
console.log("Extracting ABIs from Foundry artifacts...");
console.log(`Looking in: ${OUT_DIR}\n`);

if (!existsSync(OUT_DIR)) {
  console.error(`❌ Foundry output directory not found: ${OUT_DIR}`);
  console.error(`   Make sure contracts/ is adjacent to liquidation_bot/`);
  console.error(`   and run 'forge build' in contracts/ first.`);
  process.exit(1);
}

for (const contract of CONTRACTS_TO_EXTRACT) {
  extractAbi(contract.name, contract.path);
}

console.log(
  "\n✅ Done. Update src/contracts/abis.ts if any signatures changed.",
);
