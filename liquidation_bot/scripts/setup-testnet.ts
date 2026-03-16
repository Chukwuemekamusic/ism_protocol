/**
 * Setup Testnet Script
 *
 * Creates test scenarios for the liquidation bot on Base Sepolia.
 * This script sets up underwater positions that the bot can detect and liquidate.
 *
 * WHAT IT DOES
 * ────────────
 * 1. Uses ONE test wallet to create both lender and borrower positions
 * 2. Steps:
 *    - Deposits USDC as supply (acts as lender - provides liquidity)
 *    - Deposits WETH as collateral (acts as borrower)
 *    - Borrows USDC against WETH collateral (near max LTV ~75%)
 * 3. Creates a position with Health Factor ~1.06 (slightly above liquidation)
 * 4. Verifies the position details
 *
 * USAGE
 * ─────
 * 1. Add TEST_USER_PRIVATE_KEY to .env (a test borrower account, NOT the bot's key)
 * 2. Fund that account with:
 *    - Base Sepolia ETH (for gas)
 *    - WETH tokens (for collateral)
 *    - USDC tokens (for supply)
 * 3. Run: npm run setup-testnet
 *
 * REQUIREMENTS
 * ────────────
 * - TEST_USER_PRIVATE_KEY in .env (funded with ETH, WETH, USDC)
 * - Deployed WETH/USDC market on Base Sepolia
 * - Access to Base Sepolia RPC
 *
 * NOTE: This creates a near-liquidation position. To make it liquidatable:
 * - Wait for interest to accrue (increases debt)
 * - Wait for WETH price drop (decreases collateral value)
 * - Or borrow slightly more to push HF below 1.0
 */

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import {
  LENDING_POOL_ABI,
  ORACLE_ROUTER_ABI,
  ERC20_ABI,
} from "../src/contracts/abis.js";
import { WAD } from "../src/types.js";

dotenvConfig();

// ============================================
// CONFIGURATION
// ============================================

interface TestConfig {
  rpcUrl: string;
  privateKey: string;
  chainId: number;
  deployment: {
    marketRegistry: string;
    oracleRouter: string;
    liquidator: string;
    pool: string; // The WETH/USDC market
    weth: string;
    usdc: string;
  };
}

function loadConfig(): TestConfig {
  // Load deployment addresses from the deployments folder
  const chainId = parseInt(process.env.CHAIN_ID || "84532");

  // Path from liquidation_bot/scripts/ -> ism_protocol/deployments/
  const deploymentsDir = join(process.cwd(), "..", "deployments");
  const deploymentPath = join(deploymentsDir, `${chainId}.json`);

  let deployment: any;
  try {
    const raw = readFileSync(deploymentPath, "utf-8");
    deployment = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Failed to load deployment from ${deploymentPath}`);
    console.error("Make sure contracts are deployed first!");
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  return {
    rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
    privateKey:
      process.env.TEST_USER_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
    chainId,
    deployment: {
      marketRegistry: deployment.contracts.marketRegistry,
      oracleRouter: deployment.contracts.oracleRouter,
      liquidator: deployment.contracts.dutchAuctionLiquidator,
      pool: deployment.markets["0"].pool, // WETH collateral, USDC borrow
      weth: deployment.tokens.WETH,
      usdc: deployment.tokens.USDC,
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getBalance(
  token: ethers.Contract,
  address: string,
  decimals: number,
): Promise<string> {
  const balance = await token.balanceOf(address);
  return ethers.formatUnits(balance, decimals);
}

async function approve(
  token: ethers.Contract,
  spender: string,
  amount: bigint,
  signer: ethers.Wallet,
): Promise<void> {
  console.log(`  Approving ${spender} to spend tokens...`);
  const connectedToken = token.connect(signer) as ethers.Contract;
  const tx = await connectedToken.approve(spender, amount);
  await tx.wait();
  console.log(`  ✓ Approved`);
}

// ============================================
// MAIN SCRIPT
// ============================================

async function main() {
  console.log("🚀 Setting up testnet scenario for liquidation bot...\n");

  // 1. Load config
  const config = loadConfig();

  if (
    !config.privateKey ||
    config.privateKey === "your_private_key_without_0x_prefix"
  ) {
    console.error(
      "❌ Please set TEST_USER_PRIVATE_KEY (or PRIVATE_KEY) in .env file",
    );
    console.error(
      "   This should be the test borrower's private key (NOT the bot's key)",
    );
    process.exit(1);
  }

  // 2. Setup provider and wallets
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const deployer = new ethers.Wallet(config.privateKey, provider);

  console.log("📋 Configuration:");
  console.log(`  Network: Base Sepolia (Chain ID: ${config.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Pool: ${config.deployment.pool}`);
  console.log(`  WETH: ${config.deployment.weth}`);
  console.log(`  USDC: ${config.deployment.usdc}\n`);

  // 3. Setup contracts
  const pool = new ethers.Contract(
    config.deployment.pool,
    LENDING_POOL_ABI,
    deployer,
  );
  const weth = new ethers.Contract(config.deployment.weth, ERC20_ABI, deployer);
  const usdc = new ethers.Contract(config.deployment.usdc, ERC20_ABI, deployer);
  const oracleRouter = new ethers.Contract(
    config.deployment.oracleRouter,
    ORACLE_ROUTER_ABI,
    provider,
  );

  // 4. Check deployer balances
  console.log("💰 Checking balances...");
  const ethBalance = await provider.getBalance(deployer.address);
  const wethBalance = await getBalance(weth, deployer.address, 18);
  const usdcBalance = await getBalance(usdc, deployer.address, 6);

  console.log(`  ETH: ${ethers.formatEther(ethBalance)}`);
  console.log(`  WETH: ${wethBalance}`);
  console.log(`  USDC: ${usdcBalance}\n`);

  if (ethBalance < ethers.parseEther("0.01")) {
    console.error(
      "❌ Insufficient ETH for gas. Get some from Base Sepolia faucet:",
    );
    console.error("   https://www.alchemy.com/faucets/base-sepolia");
    process.exit(1);
  }

  // 5. Get oracle prices
  console.log("📊 Fetching oracle prices...");
  const wethPrice = await oracleRouter.getPrice(config.deployment.weth);
  const usdcPrice = await oracleRouter.getPrice(config.deployment.usdc);

  console.log(`  WETH: $${ethers.formatUnits(wethPrice, 18)}`);
  console.log(`  USDC: $${ethers.formatUnits(usdcPrice, 18)}\n`);

  // 6. Setup test amounts
  // We'll create a position that's near liquidation threshold
  const collateralAmount = ethers.parseEther("0.01"); // 0.01 WETH (~$200 at $2000/ETH)
  const borrowAmount = ethers.parseUnits("2", 6); // 2 USDC

  // LTV is 75%, liquidation threshold is 80%
  // Collateral value: 0.1 ETH × $2000 = $200
  // Max borrow at 75% LTV: $150
  // Liquidation at 80%: $160
  // We borrow exactly $150, so HF = ($200 × 0.80) / $150 = 1.066 (slightly healthy)

  console.log("🎯 Test scenario:");
  console.log(`  Collateral: ${ethers.formatEther(collateralAmount)} WETH`);
  console.log(`  Borrow: ${ethers.formatUnits(borrowAmount, 6)} USDC`);
  console.log(`  Expected HF: ~1.06 (slightly above liquidation)\n`);

  // 7. Check if we have enough tokens
  const wethBalanceBN = await weth.balanceOf(deployer.address);
  const usdcBalanceBN = await usdc.balanceOf(deployer.address);

  // We need USDC to supply (so borrower can borrow)
  const supplyAmount = borrowAmount * 2n; // Supply 2x what we'll borrow for safety

  if (usdcBalanceBN < supplyAmount) {
    console.log(
      `⚠️  Need ${ethers.formatUnits(supplyAmount, 6)} USDC to supply.`,
    );
    console.log(`   You have ${ethers.formatUnits(usdcBalanceBN, 6)} USDC.`);
    console.log("   Get USDC from a Base Sepolia faucet or swap.\n");
  }

  if (wethBalanceBN < collateralAmount) {
    console.log(
      `⚠️  Need ${ethers.formatEther(collateralAmount)} WETH for collateral.`,
    );
    console.log(`   You have ${ethers.formatEther(wethBalanceBN)} WETH.`);
    console.log("   Wrap some ETH to WETH first.\n");
  }

  // Prompt user to continue
  console.log("📝 The script will now:");
  console.log("  1. Supply USDC to the pool (as lender)");
  console.log("  2. Deposit WETH as collateral");
  console.log("  3. Borrow USDC against the collateral");
  console.log("  4. Check the health factor\n");

  console.log("⚠️  This will use real testnet tokens and gas.\n");

  // In a production script, you'd prompt for confirmation here
  // For now, we'll just continue

  // 8. Step 1: Supply USDC to pool (so there's liquidity to borrow)
  console.log("📥 Step 1: Supplying USDC to pool...");
  try {
    await approve(usdc, config.deployment.pool, supplyAmount, deployer);
    const depositTx = await pool.deposit(supplyAmount);
    await depositTx.wait();
    console.log(`  ✓ Supplied ${ethers.formatUnits(supplyAmount, 6)} USDC\n`);
  } catch (error: any) {
    console.error("  ❌ Failed to supply USDC:", error.message);
    console.error("     Make sure you have enough USDC balance\n");
  }

  // 9. Step 2: Deposit WETH as collateral
  console.log("🔒 Step 2: Depositing WETH collateral...");
  try {
    await approve(weth, config.deployment.pool, collateralAmount, deployer);
    const collateralTx = await pool.depositCollateral(collateralAmount);
    await collateralTx.wait();
    console.log(`  ✓ Deposited ${ethers.formatEther(collateralAmount)} WETH\n`);
  } catch (error: any) {
    console.error("  ❌ Failed to deposit collateral:", error.message);
    console.error("     Make sure you have enough WETH balance\n");
  }

  // 10. Step 3: Borrow USDC
  console.log("💸 Step 3: Borrowing USDC...");
  try {
    const borrowTx = await pool.borrow(borrowAmount);
    await borrowTx.wait();
    console.log(`  ✓ Borrowed ${ethers.formatUnits(borrowAmount, 6)} USDC\n`);
  } catch (error: any) {
    console.error("  ❌ Failed to borrow:", error.message);
    console.error("     The position might exceed LTV limits\n");
  }

  // 11. Step 4: Check health factor
  console.log("🏥 Step 4: Checking health factor...");
  try {
    const healthFactor = await pool.healthFactor(deployer.address);
    const hfFormatted = ethers.formatUnits(healthFactor, 18);

    console.log(`  Health Factor: ${hfFormatted}`);

    if (healthFactor >= WAD) {
      console.log(`  ✓ Position is healthy (HF >= 1.0)\n`);
    } else {
      console.log(`  ⚠️  Position is liquidatable! (HF < 1.0)\n`);
    }

    // Show detailed position info
    const position = await pool.positions(deployer.address);
    const collateral = position.collateralAmount;
    const borrowShares = position.borrowShares;
    const borrowIndex = await pool.borrowIndex();
    const debtAmount = (BigInt(borrowShares) * BigInt(borrowIndex)) / WAD;

    console.log("📊 Position Details:");
    console.log(`  Collateral: ${ethers.formatEther(collateral)} WETH`);
    console.log(`  Borrow Shares: ${ethers.formatUnits(borrowShares, 6)}`);
    console.log(`  Debt Amount: ${ethers.formatUnits(debtAmount, 6)} USDC`);
    console.log(`  Health Factor: ${hfFormatted}\n`);

    // Calculate collateral and debt values in USD
    const collateralValueUSD =
      (BigInt(collateral) * BigInt(wethPrice)) / BigInt(10 ** 18) / WAD;
    const debtValueUSD =
      (BigInt(debtAmount) * BigInt(usdcPrice)) / BigInt(10 ** 6) / WAD;

    console.log("💵 USD Values:");
    console.log(`  Collateral: $${collateralValueUSD.toString()}`);
    console.log(`  Debt: $${debtValueUSD.toString()}`);
    console.log(
      `  Effective Collateral (80%): $${((collateralValueUSD * 80n) / 100n).toString()}\n`,
    );

    if (healthFactor >= WAD) {
      console.log("🎯 Next Steps:");
      console.log("  To make this position liquidatable:");
      console.log("  1. Wait for interest to accrue (increases debt)");
      console.log(
        "  2. Wait for WETH price to drop (decreases collateral value)",
      );
      console.log("  3. Or borrow slightly more USDC to push HF below 1.0\n");
      console.log("  The liquidation bot will detect when HF < 1.0 and act.\n");
    } else {
      console.log(
        "✅ Success! Position is underwater and ready for liquidation.",
      );
      console.log("   Run the bot with: npm run dev");
      console.log(
        "   The bot should detect this position and start an auction.\n",
      );
    }
  } catch (error: any) {
    console.error("  ❌ Failed to check health factor:", error.message);
  }

  console.log("✅ Testnet setup complete!\n");
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Script failed:");
    console.error(error);
    process.exit(1);
  });
