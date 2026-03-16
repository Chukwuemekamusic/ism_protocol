import { ethers } from "ethers";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import type { BotConfig, MarketInfo } from "./types.js";
import { OpportunityType } from "./types.js";

// Contracts abis
import {
  LENDING_POOL_ABI,
  MARKET_REGISTRY_ABI,
  ERC20_ABI,
} from "./contracts/abis.js";

// State
import { PositionStore } from "./state/positionStore.js";
import { AuctionStore } from "./state/auctionStore.js";

// Indexing
import { EventIndexer } from "./indexer/eventIndexer.js";
import { EventListener } from "./indexer/eventListener.js";

// Monitoring
import { HealthMonitor } from "./monitor/healthMonitor.js";
import { PriceMonitor } from "./monitor/priceMonitor.js";

// Strategy
import { OpportunityDetector } from "./strategy/opportunities.js";
import { ProfitabilityCalculator } from "./strategy/calculator.js";

// Execution
import { Executor } from "./executor/executor.js";
import { TransactionSimulator } from "./executor/simulator.js";

/**
 * MAIN ENTRY POINT
 *
 * The bot goes through these phases:
 *
 *   PHASE 1: INITIALIZATION
 *   ────────────────────────
 *   Load config, create providers, connect wallet.
 *   This is where we validate that the .env is correct
 *   and we can actually reach the RPC.
 *
 *   PHASE 2: MARKET DISCOVERY
 *   ─────────────────────────
 *   Query the MarketRegistry to find all deployed markets.
 *   For each market, read its parameters (LTV, threshold, etc.)
 *   and token addresses. This tells us WHAT to monitor.
 *
 *   PHASE 3: STATE RECONSTRUCTION
 *   ─────────────────────────────
 *   Scan historical events to rebuild the current state of
 *   all positions and auctions. Then subscribe to live events
 *   so we stay up to date.
 *
 *   PHASE 4: MONITORING LOOP
 *   ────────────────────────
 *   Every pollingInterval:
 *     1. Fetch latest oracle prices
 *     2. Calculate health factors for all borrowers
 *     3. Find actionable opportunities
 *     4. Execute profitable ones
 *     5. Log stats
 *
 *   PHASE 5: SHUTDOWN
 *   ─────────────────
 *   On SIGINT/SIGTERM: unsubscribe events, close connections,
 *   log final stats.
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Discover all markets from MarketRegistry and load thier info */
async function discoverMarkets(
  registryAddress: string,
  provider: ethers.JsonRpcProvider,
  logger: ReturnType<typeof createLogger>,
): Promise<Map<string, MarketInfo>> {
  const registry = new ethers.Contract(
    registryAddress,
    MARKET_REGISTRY_ABI,
    provider,
  );

  const marketAddresses: string[] = await registry.getActiveMarkets();

  const markets = new Map<string, MarketInfo>();

  for (const marketAddress of marketAddresses) {
    try {
      const pool = new ethers.Contract(
        marketAddress,
        LENDING_POOL_ABI,
        provider,
      );

      // fetch all market parameters in parallel
      const [
        collateralToken,
        borrowToken,
        collateralDecimals,
        borrowDecimals,
        ltv,
        liquidationThreshold,
        liquidationPenalty,
        poolToken,
      ] = await Promise.all([
        pool.collateralToken() as Promise<string>,
        pool.borrowToken() as Promise<string>,
        pool.collateralDecimals() as Promise<number>,
        pool.borrowDecimals() as Promise<number>,
        pool.ltv() as Promise<bigint>,
        pool.liquidationThreshold() as Promise<bigint>,
        pool.liquidationPenalty() as Promise<bigint>,
        pool.poolToken() as Promise<string>,
      ]);

      markets.set(marketAddress.toLowerCase(), {
        pool: marketAddress.toLowerCase(),
        collateralToken: collateralToken.toLowerCase(),
        borrowToken: borrowToken.toLowerCase(),
        collateralDecimals: Number(collateralDecimals),
        borrowDecimals: Number(borrowDecimals),
        ltv,
        liquidationThreshold,
        liquidationPenalty,
        poolToken: poolToken.toLowerCase(),
      });

      // Log token smbols for readability
      const collateralContract = new ethers.Contract(
        collateralToken,
        ERC20_ABI,
        provider,
      );
      const borrowContract = new ethers.Contract(
        borrowToken,
        ERC20_ABI,
        provider,
      );
      const [collateralSymbol, borrowSymbol] = await Promise.all([
        collateralContract.symbol() as Promise<string>,
        borrowContract.symbol() as Promise<string>,
      ]);
      logger.info(
        ` Market: ${collateralSymbol}/${borrowSymbol} at ${marketAddress.slice(0, 10)}...`,
        {
          ltv: `${Number(ltv) / 1e16}%`,
          threshold: `${Number(liquidationThreshold) / 1e16}%`,
          penalty: `${Number(liquidationPenalty) / 1e16}%`,
        },
      );
    } catch (error) {
      logger.warn(`Failed to fetch market info for ${marketAddress}`, {
        error: (error as Error).message,
      });
    }
  }

  return markets;
}

/** Get all unique token address all markets */
function getUniqueTokens(markets: Map<string, MarketInfo>): string[] {
  const tokens = new Set<string>();
  for (const market of markets.values()) {
    tokens.add(market.collateralToken);
    tokens.add(market.borrowToken);
  }
  return Array.from(tokens);
}

/** ensure the bot wallet has approved all borrow tokens for the liquidator */
async function ensureAllApprovals(
  executor: Executor,
  markets: Map<string, MarketInfo>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const borrowTokens = new Set<string>();

  for (const market of markets.values()) {
    borrowTokens.add(market.borrowToken);
  }
  for (const token of borrowTokens) {
    await executor.ensureApproval(token);
  }

  logger.info(
    `Token approvals verified for ${borrowTokens.size} borrow tokens`,
  );
}

/** Sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stats logging - called periodically to show bot health */
let lastStatsLog = 0;
function logStats(
  positionStore: PositionStore,
  auctionStore: AuctionStore,
  cycleCount: number,
  logger: ReturnType<typeof createLogger>,
): void {
  const now = Date.now();
  // log stats every 30 seconds
  if (now - lastStatsLog < 30000) return;
  lastStatsLog = now;

  logger.info("Bot is running", {
    cycles: cycleCount,
    totalPositions: positionStore.getTotalPositions(),
    activeBorrowers: positionStore.getActiveBorrowerCount(),
    activeAuctions: auctionStore.getActiveCount(),
    martketsTraced: positionStore.getMarketCount(),
  });
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main(): Promise<void> {
  // - PHASE 1: INITIALIZATION --
  const config = await loadConfig();
  const logger = await createLogger(config);

  logger.info("═══════════════════════════════════════════");
  logger.info("  🤖 ISM Liquidation Bot Starting...");
  logger.info("═══════════════════════════════════════════");

  // Create providers
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wsProvider = new ethers.WebSocketProvider(config.wsUrl);

  // create wallet
  const wallet = new ethers.Wallet(config.privateKey, provider);
  logger.info("Wallet connected", {
    address: wallet.address,
  });

  const ethBalance = await provider.getBalance(wallet.address);
  logger.info("Wallet balance", {
    eth: ethers.formatEther(ethBalance),
  });

  if (ethBalance <= 0n) {
    logger.warn(
      `Wallet has no ETH. Please fund ${wallet.address} to pay for gas`,
    );
  }

  // verify we can reach the RPC
  const network = await provider.getNetwork();
  logger.info(
    `Connected to network ${network.name} (chainId ${network.chainId})`,
  );

  // -- PHASE 2: MARKET DISCOVERY --
  logger.info("Discovering markets...");
  const markets = await discoverMarkets(
    config.marketRegistry,
    provider,
    logger,
  );

  if (markets.size === 0) {
    logger.error("No markets found, exiting");
    process.exit(1);
  }

  logger.info(`Discovered ${markets.size} markets`);

  // -- PHASE 3: STATE RECONSTRUCTION --
  const positionStore = new PositionStore();
  const auctionStore = new AuctionStore();

  // Historical indexing
  logger.info("Indexing historical events...");
  const indexer = new EventIndexer(
    provider,
    positionStore,
    auctionStore,
    logger,
  );
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - config.historicalBlockRange);
  await indexer.indexAll(
    Array.from(markets.keys()),
    config.liquidator,
    fromBlock,
  );

  // Live event subscription
  logger.info("Subscribing to live events...");
  const listener = new EventListener(
    wsProvider,
    positionStore,
    auctionStore,
    logger,
  );
  listener.subscribeToAllMarkets(Array.from(markets.keys()));
  listener.subscribeToLiquidator(config.liquidator);
  listener.subscribeToNewMarkets(config.marketRegistry, (newMarket) => {
    logger.info("Auto-adding new market to monitoring", { market: newMarket });
    markets.set(newMarket, {
      pool: newMarket,
      collateralToken: "",
      borrowToken: "",
      collateralDecimals: 0,
      borrowDecimals: 0,
      ltv: 0n,
      liquidationThreshold: 0n,
      liquidationPenalty: 0n,
      poolToken: "",
    });
  });

  // ── PHASE 4: INITIALIZE EXECUTION COMPONENTS ──
  const priceMonitor = new PriceMonitor(config.oracleRouter, provider, logger);
  const healthMonitor = new HealthMonitor(
    positionStore,
    priceMonitor,
    markets,
    provider,
    config.healthFactorThreshold,
    logger,
  );
  const calculator = new ProfitabilityCalculator(config, priceMonitor, logger);
  const opportunityDetector = new OpportunityDetector(
    healthMonitor,
    auctionStore,
    calculator,
    config.liquidator,
    provider,
    markets,
    logger,
  );
  const simulator = new TransactionSimulator(provider, logger);
  const executor = new Executor(
    wallet,
    config.liquidator,
    simulator,
    config,
    logger,
  );

  await executor.initialize();
  // ensure token approvals
  logger.info("Ensuring token approvals...");
  await ensureAllApprovals(executor, markets, logger);

  // -- PHASE 5: GRACEFUL SHUTDOWN --
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`\nReceived ${signal} signal, shutting down...`);

    // Unsubscribe from events
    await listener.unsubscribeAll();

    // Close WebSocket
    try {
      await wsProvider.destroy();
    } catch {
      /* ignore */
    }

    logger.info("═══════════════════════════════════════════");
    logger.info("  Bot stopped. Final stats:");
    logger.info(`    Positions tracked: ${positionStore.getTotalPositions()}`);
    logger.info(
      `    Active borrowers: ${positionStore.getActiveBorrowerCount()}`,
    );
    logger.info(`    Active auctions: ${auctionStore.getActiveCount()}`);
    logger.info("═══════════════════════════════════════════");

    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // -- PHASE 6: MONITORING LOOP --
  logger.info("═══════════════════════════════════════════");
  logger.info("  🚀 Bot is running! Monitoring positions...");
  logger.info(`  Polling interval: ${config.pollingIntervalMs}ms`);
  logger.info(`  Min profit: $${config.minProfitUsd}`);
  logger.info(`  HF threshold: ${Number(config.healthFactorThreshold) / 1e18}`);
  logger.info("═══════════════════════════════════════════");

  let cycleCount = 0;
  while (!isShuttingDown) {
    cycleCount++;

    try {
      // 1. Fetch latest oracle prices
      const tokens = getUniqueTokens(markets);
      await priceMonitor.updatePrices(tokens);

      // 2. Clean up expired auctions
      const now = Math.floor(Date.now() / 1000);
      const expiredAuctions = auctionStore.removeExpired(now);
      if (expiredAuctions.length > 0) {
        logger.info(`Removed ${expiredAuctions.length} expired auctions`);
      }

      // 3. Find actionable opportunities
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;

      const opportunities =
        await opportunityDetector.findOpportunities(gasPrice);

      // 4. Execute profitable opportunities(sequenctially)
      if (opportunities.length > 0) {
        logger.info(`Processing ${opportunities.length} opportunities...`);

        for (const opp of opportunities) {
          // Don't execute if we have pending txs (wait for them first)
          if (executor.hasPendingTransactions()) {
            logger.debug("Waiting for pending transaction to confirm...");
            break;
          }

          // Don't execute during shutdown
          if (isShuttingDown) break;

          const result = await executor.execute(opp);

          if (result.success) {
            logger.info(`✅ ${opp.type} executed successfully`, {
              txHash: result.txHash,
              gasUsed: result.gasUsed?.toString(),
              market: opp.market.slice(0, 10),
              user: opp.user.slice(0, 10),
              profit:
                opp.type === OpportunityType.LIQUIDATE
                  ? `$${opp.estimatedProfitUsd.toFixed(2)}`
                  : "N/A (auction start)",
            });
          } else {
            logger.warn(`❌ ${opp.type} failed`, {
              error: result.error,
              market: opp.market.slice(0, 10),
              user: opp.user.slice(0, 10),
            });
          }
        }
      }

      // 5. Periodic stats
      logStats(positionStore, auctionStore, cycleCount, logger);

      // Periodic cleanup
      if (cycleCount % 100 === 0) {
        const pruned = positionStore.pruneEmpty();
        if (pruned > 0) {
          logger.debug(`Pruned ${pruned} empty positions`);
        }
      }
    } catch (error) {
      logger.error("Monitoring cycle failed", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        cycle: cycleCount,
      });
    }

    // Back off on errors to avoid hammering a failing RPC
    await sleep(config.pollingIntervalMs * 2);
    continue;
  }

  // wait before next cycle
  await sleep(config.pollingIntervalMs);
}

// ── RUN ──
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
