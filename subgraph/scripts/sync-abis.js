#!/usr/bin/env node

/**
 * Sync ABIs from contracts/out/ to subgraph/abis/
 * Runs automatically before codegen and build
 */

const fs = require('fs');
const path = require('path');

const contracts = [
  'LendingPool',
  'MarketRegistry',
  'MarketFactory',
  'DutchAuctionLiquidator',
  'OracleRouter',
  'ERC20'
];

const sourceDir = path.join(__dirname, '../../contracts/out');
const targetDir = path.join(__dirname, '../abis');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('🔄 Syncing ABIs from contracts...\n');

let successCount = 0;
let failCount = 0;

contracts.forEach(contract => {
  try {
    const sourcePath = path.join(sourceDir, `${contract}.sol`, `${contract}.json`);
    const targetPath = path.join(targetDir, `${contract}.json`);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  ${contract}.json - Source not found (may need to run forge build)`);
      failCount++;
      return;
    }

    // Read the full artifact
    const artifact = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    // Extract only the ABI
    const abi = artifact.abi;

    // Write ABI to target
    fs.writeFileSync(targetPath, JSON.stringify(abi, null, 2));

    console.log(`✅ ${contract}.json - Synced successfully`);
    successCount++;
  } catch (error) {
    console.log(`❌ ${contract}.json - Error: ${error.message}`);
    failCount++;
  }
});

console.log(`\n📊 Summary: ${successCount} synced, ${failCount} failed`);

if (failCount > 0) {
  console.log('\n💡 Tip: Run "forge build" in contracts/ directory first');
  process.exit(1);
}
