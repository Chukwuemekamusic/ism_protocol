#!/usr/bin/env tsx
/**
 * ABI Extraction Script
 *
 * Extracts contract ABIs from Foundry build artifacts and generates
 * TypeScript files with typed ABIs for the liquidation bot.
 *
 * Run from liquidation_bot/: npm run extract-abis
 */

import * as fs from 'fs';
import * as path from 'path';

// Paths relative to liquidation_bot/
const FOUNDRY_OUT_DIR = path.join(__dirname, '../../contracts/out');
const OUTPUT_DIR = path.join(__dirname, '../src/contracts');

// Contracts to extract (matches abis.ts)
const CONTRACTS = [
  { name: 'LendingPool', path: 'LendingPool.sol/LendingPool.json' },
  { name: 'DutchAuctionLiquidator', path: 'DutchAuctionLiquidator.sol/DutchAuctionLiquidator.json' },
  { name: 'OracleRouter', path: 'OracleRouter.sol/OracleRouter.json' },
  { name: 'MarketRegistry', path: 'MarketRegistry.sol/MarketRegistry.json' },
  { name: 'PoolToken', path: 'PoolToken.sol/PoolToken.json' },
  { name: 'InterestRateModel', path: 'InterestRateModel.sol/InterestRateModel.json' },
  { name: 'ERC20', path: 'ERC20.sol/ERC20.json' },
] as const;

interface FoundryArtifact {
  abi: any[];
  bytecode?: { object: string };
  deployedBytecode?: { object: string };
}

function extractABI(contractName: string, artifactPath: string): any[] {
  const fullPath = path.join(FOUNDRY_OUT_DIR, artifactPath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Warning: ${contractName} artifact not found at ${fullPath}`);
    console.warn(`   Skipping... (run 'forge build' in contracts/ first)`);
    return [];
  }

  try {
    const artifact: FoundryArtifact = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    return artifact.abi;
  } catch (error) {
    console.error(`❌ Error reading ${contractName}:`, error);
    return [];
  }
}

function generateABIFile() {
  console.log('🔍 Extracting ABIs from Foundry artifacts...\n');

  const abis: Record<string, any[]> = {};
  let successCount = 0;

  // Extract all ABIs
  for (const contract of CONTRACTS) {
    const abi = extractABI(contract.name, contract.path);
    if (abi.length > 0) {
      abis[contract.name] = abi;
      console.log(`✅ ${contract.name}: ${abi.length} items extracted`);
      successCount++;
    }
  }

  if (successCount === 0) {
    console.error('\n❌ No ABIs extracted! Make sure contracts are compiled:');
    console.error('   cd contracts && forge build');
    process.exit(1);
  }

  // Generate TypeScript file
  const outputPath = path.join(OUTPUT_DIR, 'abis.generated.ts');

  let output = `/**
 * Auto-generated Contract ABIs
 *
 * Generated from Foundry build artifacts in contracts/out/
 * DO NOT EDIT MANUALLY - run 'npm run extract-abis' to regenerate
 *
 * Last generated: ${new Date().toISOString()}
 */

`;

  // Export each ABI
  for (const [name, abi] of Object.entries(abis)) {
    output += `export const ${name.toUpperCase()}_ABI = ${JSON.stringify(abi, null, 2)} as const;\n\n`;
  }

  // Write file
  fs.writeFileSync(outputPath, output, 'utf-8');

  console.log(`\n✨ Success! Generated ${outputPath}`);
  console.log(`📊 Total: ${successCount}/${CONTRACTS.length} contracts extracted\n`);
}

function generateHumanReadableABIs() {
  console.log('📝 Generating human-readable ABIs (ethers v6 format)...\n');

  const humanReadable: Record<string, string[]> = {};

  for (const contract of CONTRACTS) {
    const abi = extractABI(contract.name, contract.path);
    if (abi.length === 0) continue;

    const readable: string[] = [];

    for (const item of abi) {
      try {
        if (item.type === 'function') {
          const inputs = item.inputs?.map((i: any) => `${i.type} ${i.name || ''}`).join(', ') || '';
          const outputs = item.outputs?.length > 0
            ? ` returns (${item.outputs.map((o: any) => o.type).join(', ')})`
            : '';
          const stateMut = item.stateMutability !== 'nonpayable' ? ` ${item.stateMutability}` : '';
          readable.push(`function ${item.name}(${inputs})${stateMut}${outputs}`);
        } else if (item.type === 'event') {
          const inputs = item.inputs?.map((i: any) => {
            const indexed = i.indexed ? 'indexed ' : '';
            return `${indexed}${i.type} ${i.name || ''}`;
          }).join(', ') || '';
          readable.push(`event ${item.name}(${inputs})`);
        } else if (item.type === 'error') {
          const inputs = item.inputs?.map((i: any) => `${i.type} ${i.name || ''}`).join(', ') || '';
          readable.push(`error ${item.name}(${inputs})`);
        }
      } catch (error) {
        console.warn(`⚠️  Skipping malformed ABI item in ${contract.name}`);
      }
    }

    humanReadable[contract.name] = readable;
  }

  // Generate human-readable file
  const outputPath = path.join(OUTPUT_DIR, 'abis.human-readable.ts');

  let output = `/**
 * Human-Readable Contract ABIs (ethers v6 format)
 *
 * Generated from Foundry build artifacts - easier to read than full JSON ABIs
 * DO NOT EDIT MANUALLY - run 'npm run extract-abis' to regenerate
 *
 * Last generated: ${new Date().toISOString()}
 */

`;

  for (const [name, items] of Object.entries(humanReadable)) {
    output += `export const ${name.toUpperCase()}_ABI = [\n`;
    output += items.map(item => `  "${item}",`).join('\n');
    output += '\n] as const;\n\n';
  }

  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`✨ Generated ${outputPath}\n`);
}

// Main execution
console.log('═══════════════════════════════════════════════════');
console.log('  ISM Protocol - ABI Extraction Tool');
console.log('═══════════════════════════════════════════════════\n');

// Check if Foundry output exists
if (!fs.existsSync(FOUNDRY_OUT_DIR)) {
  console.error('❌ Error: Foundry output directory not found!');
  console.error(`   Expected: ${FOUNDRY_OUT_DIR}`);
  console.error('   Run: cd contracts && forge build');
  process.exit(1);
}

// Generate both formats
generateABIFile();
generateHumanReadableABIs();

console.log('═══════════════════════════════════════════════════');
console.log('✅ ABI extraction complete!');
console.log('═══════════════════════════════════════════════════');
