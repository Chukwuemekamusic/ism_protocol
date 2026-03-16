/**
 * Check Positions Debug Script
 *
 * Inspects the current state of the bot's tracked positions without running the bot.
 * Useful for debugging, monitoring, and understanding what the bot sees.
 *
 * WHAT IT SHOWS
 * ─────────────
 * 1. Bot wallet balance (ETH, WETH, USDC)
 * 2. Current oracle prices
 * 3. All tracked positions with health factors
 * 4. Active auctions with current prices
 * 5. Liquidation opportunities
 *
 * USAGE
 * ─────
 * npm run check-positions
 *
 * This script is read-only — it doesn't modify any state or submit transactions.
 */

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import {
  LENDING_POOL_ABI,
  ORACLE_ROUTER_ABI,
  MARKET_REGISTRY_ABI,
  LIQUIDATOR_ABI,
  ERC20_ABI,
} from "../src/contracts/abis.js";
import { WAD } from "../src/types.js";
import type { MarketInfo } from "../src/types.js";

dotenvConfig();

// ============================================
// CONFIGURATION
// ============================================

interface Config {
  rpcUrl: string;
  chainId: number;
  marketRegistry: string;
  oracleRouter: string;
  liquidator: string;
  walletAddress?: string;
}

function loadConfig(): Config {
  const chainId = parseInt(process.env.CHAIN_ID || "84532");
  const deploymentPath = `../../../deployments/${chainId}.json`;

  let deployment: any;
  try {
    deployment = require(deploymentPath);
  } catch (err) {
    console.error(`❌ Failed to load deployment from ${deploymentPath}`);
    process.exit(1);
  }

  return {
    rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
    chainId,
    marketRegistry: deployment.contracts.marketRegistry,
    oracleRouter: deployment.contracts.oracleRouter,
    liquidator: deployment.contracts.dutchAuctionLiquidator,
    walletAddress: process.env.PRIVATE_KEY
      ? new ethers.Wallet(process.env.PRIVATE_KEY).address
      : undefined,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBigInt(value: bigint, decimals: number): string {
  return ethers.formatUnits(value, decimals);
}

function formatHealthFactor(hf: bigint): string {
  const formatted = ethers.formatUnits(hf, 18);
  const num = parseFloat(formatted);

  if (num >= 1000) return "∞ (no debt)";
  if (num >= 1.5) return `${formatted} ✅ (healthy)`;
  if (num >= 1.1) return `${formatted} ⚠️  (at risk)`;
  if (num >= 1.0) return `${formatted} 🟡 (near liquidation)`;
  return `${formatted} 🔴 (LIQUIDATABLE)`;
}

async function getTokenInfo(
  address: string,
  provider: ethers.JsonRpcProvider,
): Promise<{ symbol: string; decimals: number }> {
  try {
    const token = new ethers.Contract(address, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals(),
    ]);
    return { symbol, decimals: Number(decimals) };
  } catch {
    return { symbol: "???", decimals: 18 };
  }
}

// ============================================
// DISCOVERY FUNCTIONS
// ============================================

/**
 * Discover all markets from the registry
 */
async function discoverMarkets(
  registry: ethers.Contract,
  provider: ethers.JsonRpcProvider,
): Promise<Map<string, MarketInfo>> {
  const markets = new Map<string, MarketInfo>();

  try {
    // Get all markets from registry
    const marketCount = await registry.getMarketCount();
    console.log(`  Found ${marketCount} markets in registry\n`);

    for (let i = 0; i < marketCount; i++) {
      const marketAddress = await registry.getMarketByIndex(i);
      const pool = new ethers.Contract(
        marketAddress,
        LENDING_POOL_ABI,
        provider,
      );

      // Get market details
      const [collateralToken, borrowToken, liquidationThreshold, poolToken] =
        await Promise.all([
          pool.collateralToken(),
          pool.borrowToken(),
          pool.liquidationThreshold(),
          pool.poolToken(),
        ]);

      // Get token info
      const collateralInfo = await getTokenInfo(collateralToken, provider);
      const borrowInfo = await getTokenInfo(borrowToken, provider);

      markets.set(marketAddress.toLowerCase(), {
        pool: marketAddress,
        collateralToken,
        borrowToken,
        collateralDecimals: collateralInfo.decimals,
        borrowDecimals: borrowInfo.decimals,
        ltv: 750000000000000000n, // Default 75%
        liquidationThreshold,
        liquidationPenalty: 50000000000000000n, // Default 5%
        poolToken,
      });

      console.log(
        `  Market ${i + 1}: ${collateralInfo.symbol}/${borrowInfo.symbol} - ${formatAddress(marketAddress)}`,
      );
    }
  } catch (error: any) {
    console.error("Failed to discover markets:", error.message);
  }

  return markets;
}

/**
 * Get all positions from events (simplified version)
 */
async function getPositionsFromEvents(
  pool: ethers.Contract,
  fromBlock: number,
  toBlock: number,
): Promise<Set<string>> {
  const users = new Set<string>();

  try {
    // Get all events that involve user positions
    const filters = [pool.filters.DepositCollateral(), pool.filters.Borrow()];

    for (const filter of filters) {
      const events = await pool.queryFilter(filter, fromBlock, toBlock);
      for (const event of events) {
        if ("args" in event && event.args && event.args.user) {
          users.add(event.args.user.toLowerCase());
        }
      }
    }
  } catch (error: any) {
    console.error("  Warning: Failed to fetch events:", error.message);
  }

  return users;
}

/**
 * Calculate health factor for a position
 */
async function calculateHealthFactor(
  pool: ethers.Contract,
  user: string,
): Promise<bigint> {
  try {
    return await pool.healthFactor(user);
  } catch (error: any) {
    // If healthFactor() call fails, position might not exist or have no debt
    return WAD * 1000n; // Return "infinite" HF
  }
}

/**
 * Get active auctions
 */
async function getActiveAuctions(
  liquidator: ethers.Contract,
  fromBlock: number,
  toBlock: number,
): Promise<any[]> {
  const auctions: any[] = [];

  try {
    const filter = liquidator.filters.AuctionStarted();
    const events = await liquidator.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
      if (!("args" in event) || !event.args) continue;

      const auctionId = event.args.auctionId;

      // Check if auction is still active
      try {
        const auction = await liquidator.getAuction(auctionId);
        if (auction.isActive) {
          auctions.push({
            auctionId,
            user: auction.user,
            pool: auction.pool,
            debtToRepay: auction.debtToRepay,
            collateralForSale: auction.collateralForSale,
            startTime: Number(auction.startTime),
            endTime: Number(auction.endTime),
            startPrice: auction.startPrice,
            endPrice: auction.endPrice,
          });
        }
      } catch {
        // Auction doesn't exist or was completed
      }
    }
  } catch (error: any) {
    console.error("  Warning: Failed to fetch auctions:", error.message);
  }

  return auctions;
}

// ============================================
// MAIN SCRIPT
// ============================================

async function main() {
  console.log("🔍 Checking positions and bot state...\n");

  // 1. Load config
  const config = loadConfig();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  console.log("📋 Configuration:");
  console.log(`  Network: Base Sepolia (Chain ID: ${config.chainId})`);
  console.log(`  RPC: ${config.rpcUrl}`);
  console.log(`  Registry: ${formatAddress(config.marketRegistry)}`);
  console.log(`  Oracle: ${formatAddress(config.oracleRouter)}`);
  console.log(`  Liquidator: ${formatAddress(config.liquidator)}\n`);

  // 2. Check bot wallet (if configured)
  if (config.walletAddress) {
    console.log("💰 Bot Wallet:");
    console.log(`  Address: ${config.walletAddress}`);

    const ethBalance = await provider.getBalance(config.walletAddress);
    console.log(`  ETH: ${ethers.formatEther(ethBalance)}`);

    // Try to get WETH and USDC balances (common tokens)
    try {
      const deployment = require(`../../../deployments/${config.chainId}.json`);
      const weth = new ethers.Contract(
        deployment.tokens.WETH,
        ERC20_ABI,
        provider,
      );
      const usdc = new ethers.Contract(
        deployment.tokens.USDC,
        ERC20_ABI,
        provider,
      );

      const [wethBalance, usdcBalance] = await Promise.all([
        weth.balanceOf(config.walletAddress),
        usdc.balanceOf(config.walletAddress),
      ]);

      console.log(`  WETH: ${ethers.formatEther(wethBalance)}`);
      console.log(`  USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    } catch {
      // Couldn't load token balances
    }
    console.log();
  }

  // 3. Setup contracts
  const registry = new ethers.Contract(
    config.marketRegistry,
    MARKET_REGISTRY_ABI,
    provider,
  );
  const oracleRouter = new ethers.Contract(
    config.oracleRouter,
    ORACLE_ROUTER_ABI,
    provider,
  );
  const liquidator = new ethers.Contract(
    config.liquidator,
    LIQUIDATOR_ABI,
    provider,
  );

  // 4. Get current block for event scanning
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks

  console.log("📊 Blockchain State:");
  console.log(`  Current Block: ${currentBlock}`);
  console.log(`  Scanning from: ${fromBlock}\n`);

  // 5. Discover markets
  console.log("🏪 Markets:");
  const markets = await discoverMarkets(registry, provider);

  if (markets.size === 0) {
    console.log("  No markets found. Deploy markets first!\n");
    return;
  }

  // 6. Get prices
  console.log("\n💵 Oracle Prices:");
  const priceCache = new Map<string, bigint>();

  for (const market of markets.values()) {
    for (const token of [market.collateralToken, market.borrowToken]) {
      if (!priceCache.has(token.toLowerCase())) {
        try {
          const price = await oracleRouter.getPrice(token);
          priceCache.set(token.toLowerCase(), price);

          const tokenInfo = await getTokenInfo(token, provider);
          console.log(
            `  ${tokenInfo.symbol}: $${ethers.formatUnits(price, 18)}`,
          );
        } catch (error: any) {
          console.log(`  ${formatAddress(token)}: ❌ Failed to fetch`);
        }
      }
    }
  }
  console.log();

  // 7. Check positions in each market
  console.log("👥 Positions:");

  let totalPositions = 0;
  let liquidatableCount = 0;

  for (const [marketAddress, marketInfo] of markets) {
    const pool = new ethers.Contract(marketAddress, LENDING_POOL_ABI, provider);

    // Get users who have interacted with this market
    const users = await getPositionsFromEvents(pool, fromBlock, currentBlock);

    if (users.size === 0) {
      console.log(
        `  ${formatAddress(marketAddress)}: No positions found in recent blocks\n`,
      );
      continue;
    }

    console.log(`  Market: ${formatAddress(marketAddress)}`);
    console.log(`  Found ${users.size} users with activity:\n`);

    for (const user of users) {
      try {
        // Get position details
        const [collateral, borrowShares, borrowIndex, healthFactor] =
          await Promise.all([
            pool.collateralBalance(user),
            pool.borrowBalance(user),
            pool.borrowIndex(),
            calculateHealthFactor(pool, user),
          ]);

        // Skip positions with no debt
        if (borrowShares === 0n) continue;

        totalPositions++;

        const debtAmount = (BigInt(borrowShares) * BigInt(borrowIndex)) / WAD;

        console.log(`    User: ${formatAddress(user)}`);
        console.log(
          `    Collateral: ${formatBigInt(collateral, marketInfo.collateralDecimals)}`,
        );
        console.log(
          `    Debt: ${formatBigInt(debtAmount, marketInfo.borrowDecimals)}`,
        );
        console.log(`    Health Factor: ${formatHealthFactor(healthFactor)}`);

        if (healthFactor < WAD) {
          liquidatableCount++;
          console.log(`    🔴 LIQUIDATABLE!`);
        }

        console.log();
      } catch (error: any) {
        console.log(
          `    ❌ Failed to fetch position for ${formatAddress(user)}\n`,
        );
      }
    }
  }

  console.log(`  Total positions with debt: ${totalPositions}`);
  console.log(`  Liquidatable positions: ${liquidatableCount}\n`);

  // 8. Check active auctions
  console.log("🔨 Active Auctions:");
  const auctions = await getActiveAuctions(liquidator, fromBlock, currentBlock);

  if (auctions.length === 0) {
    console.log("  No active auctions\n");
  } else {
    console.log(`  Found ${auctions.length} active auctions:\n`);

    const now = Math.floor(Date.now() / 1000);

    for (const auction of auctions) {
      console.log(`  Auction #${auction.auctionId}`);
      console.log(`    User: ${formatAddress(auction.user)}`);
      console.log(`    Pool: ${formatAddress(auction.pool)}`);

      // Calculate current price (linear interpolation)
      const elapsed = now - auction.startTime;
      const duration = auction.endTime - auction.startTime;
      const progress = Math.min(1, elapsed / duration);

      const priceDiff = auction.startPrice - auction.endPrice;
      const currentPrice =
        auction.startPrice - BigInt(Math.floor(Number(priceDiff) * progress));

      console.log(`    Progress: ${(progress * 100).toFixed(1)}%`);
      console.log(`    Time remaining: ${Math.max(0, auction.endTime - now)}s`);
      console.log(`    Current Price: ${currentPrice}`);

      if (now > auction.endTime) {
        console.log(`    ⚠️  Auction expired!`);
      }

      console.log();
    }
  }

  // 9. Summary
  console.log("📈 Summary:");
  console.log(`  Markets: ${markets.size}`);
  console.log(`  Positions: ${totalPositions}`);
  console.log(`  Liquidatable: ${liquidatableCount}`);
  console.log(`  Active Auctions: ${auctions.length}\n`);

  if (liquidatableCount > 0 || auctions.length > 0) {
    console.log("✅ Bot has opportunities to act!");
    console.log("   Run: npm run dev\n");
  } else {
    console.log("✅ All positions are healthy. Nothing to liquidate yet.\n");
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Script failed:");
    console.error(error);
    process.exit(1);
  });
