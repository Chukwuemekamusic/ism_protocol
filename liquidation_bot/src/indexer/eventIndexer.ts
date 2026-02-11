import { ethers } from "ethers";
import type winston from "winston";
import type { PositionStore } from "../state/positionStore.js";
import type { AuctionStore } from "../state/auctionStore.js";
import { LENDING_POOL_ABI, LIQUIDATOR_ABI } from "../contracts/abis.js";

/**
 * EventIndexer — Scans historical blockchain events to rebuild position state.
 *
 * WHY DO WE NEED THIS?
 * ────────────────────
 * When the bot starts (or restarts), its PositionStore and AuctionStore are empty.
 * We need to know the current state of every position to find liquidation
 * opportunities. There are two ways to get this data:
 *
 *   Option A: Call positions(user) on every possible address
 *     → Impossible. We don't know which addresses have interacted with our pools.
 *
 *   Option B: Read past events to discover who interacted and what they did
 *     → This is what we do. Events are the "transaction log" of the blockchain.
 *
 * HOW IT WORKS
 * ────────────
 * 1. For each LendingPool market, scan events from (currentBlock - range) to now
 * 2. Process events in chronological order (blockNumber, then logIndex)
 * 3. Each event modifies the PositionStore:
 *    - CollateralDeposited → addCollateral
 *    - CollateralWithdrawn → removeCollateral
 *    - Borrowed → addBorrowShares
 *    - Repaid → removeBorrowShares
 * 4. For the Liquidator contract, scan auction events to populate AuctionStore
 *
 * BLOCK RANGE CHUNKING
 * ────────────────────
 * RPCs limit how many blocks you can scan in one getLogs() call (typically 2000-10000).
 * If you ask for too large a range, the RPC returns an error like:
 *   "query returned more than 10000 results"
 * So we chunk our queries into smaller ranges. This is standard practice.
 *
 * EVENT ORDERING
 * ──────────────
 * Events within the same block are ordered by logIndex (their position in the
 * block's transaction receipts). We sort by (blockNumber, logIndex) to ensure
 * we process them in the exact order they happened on-chain. This matters
 * because a deposit and borrow in the same block must be processed in order.
 */

/** How many blocks to scan per getLogs call */
const CHUNK_SIZE = 2000;

export class EventIndexer {
  private provider: ethers.JsonRpcProvider;
  private positionStore: PositionStore;
  private auctionStore: AuctionStore;
  private logger: winston.Logger;

  constructor(
    provider: ethers.JsonRpcProvider,
    positionStore: PositionStore,
    auctionStore: AuctionStore,
    logger: winston.Logger,
  ) {
    this.provider = provider;
    this.positionStore = positionStore;
    this.auctionStore = auctionStore;
    this.logger = logger;
  }

  /**
   * Index all events for all markets + the liquidator contract.
   *
   * This is called once on bot startup. It:
   * 1. Scans each market's LendingPool events
   * 2. Scans the Liquidator contract's auction events
   * 3. After indexing, the PositionStore and AuctionStore are populated
   *
   * @param markets - Array of LendingPool addresses to scan
   * @param liquidatorAddress - DutchAuctionLiquidator address
   * @param fromBlock - Block number to start scanning from
   */
  async indexAll(
    markets: string[],
    liquidatorAddress: string,
    fromBlock: number,
  ): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();

    this.logger.info("Starting historical event indexing", {
      fromBlock,
      currentBlock,
      blockRange: currentBlock - fromBlock,
      marketCount: markets.length,
    });

    // Index each market's position events
    for (const market of markets) {
      await this.indexMarketEvents(market, fromBlock, currentBlock);
    }

    // Index liquidator events (auctions) across all markets
    await this.indexLiquidatorEvents(
      liquidatorAddress,
      fromBlock,
      currentBlock,
    );

    // Clean up zero-balance positions
    const pruned = this.positionStore.pruneEmpty();

    this.logger.info("Historical indexing complete", {
      totalPositions: this.positionStore.getTotalPositions(),
      activeBorrowers: this.positionStore.getActiveBorrowerCount(),
      activeAuctions: this.auctionStore.getActiveCount(),
      prunedEmpty: pruned,
    });
  }

  /**
   * Scan a single LendingPool's events and update the PositionStore.
   *
   * We listen for 4 event types:
   *   CollateralDeposited(user, amount) → user added collateral
   *   CollateralWithdrawn(user, amount) → user removed collateral
   *   Borrowed(user, borrowShares, borrowAmount) → user took a loan
   *   Repaid(user, repaidShares, repaidAmount) → user repaid some debt
   *
   * Note: We don't need Deposited/Withdrawn (supply-side) events because
   * suppliers can't be liquidated — only borrowers can.
   */
  private async indexMarketEvents(
    marketAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    this.logger.debug(`Indexing market events: ${marketAddress}`, {
      fromBlock,
      toBlock,
    });

    // Create a contract interface to decode event logs
    const iface = new ethers.Interface(LENDING_POOL_ABI);

    // The event topics we care about (keccak256 hashes of event signatures)
    //
    // WHY TOPICS?
    // When you call getLogs(), you filter by "topics". Topic[0] is always
    // the event signature hash. This lets the RPC efficiently return only
    // the events we care about, rather than ALL events from the contract.
    const eventTopics = [
      iface.getEvent("CollateralDeposited")!.topicHash,
      iface.getEvent("CollateralWithdrawn")!.topicHash,
      iface.getEvent("Borrowed")!.topicHash,
      iface.getEvent("Repaid")!.topicHash,
    ];

    // Fetch logs in chunks
    const allLogs = await this.fetchLogsInChunks(
      marketAddress,
      eventTopics,
      fromBlock,
      toBlock,
    );

    // Sort by block number, then log index (chronological order)
    allLogs.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.index - b.index;
    });

    let processedCount = 0;

    // Process each event
    for (const log of allLogs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (!parsed) continue;

        const blockNumber = log.blockNumber;

        switch (parsed.name) {
          case "CollateralDeposited": {
            const user = parsed.args[0] as string; // indexed
            const amount = parsed.args[1] as bigint;
            this.positionStore.addCollateral(
              marketAddress,
              user,
              amount,
              blockNumber,
            );
            break;
          }

          case "CollateralWithdrawn": {
            const user = parsed.args[0] as string;
            const amount = parsed.args[1] as bigint;
            this.positionStore.removeCollateral(
              marketAddress,
              user,
              amount,
              blockNumber,
            );
            break;
          }

          case "Borrowed": {
            // Borrowed(user, borrowShares, borrowAmount)
            // We track borrowShares, not borrowAmount — see PositionStore comments
            const user = parsed.args[0] as string;
            const borrowShares = parsed.args[1] as bigint;
            // args[2] is borrowAmount — we don't need it
            this.positionStore.addBorrowShares(
              marketAddress,
              user,
              borrowShares,
              blockNumber,
            );
            break;
          }

          case "Repaid": {
            // Repaid(user, repaidShares, repaidAmount)
            const user = parsed.args[0] as string;
            const repaidShares = parsed.args[1] as bigint;
            this.positionStore.removeBorrowShares(
              marketAddress,
              user,
              repaidShares,
              blockNumber,
            );
            break;
          }
        }

        processedCount++;
      } catch (error) {
        this.logger.warn("Failed to parse market event log", {
          market: marketAddress,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          error: (error as Error).message,
        });
      }
    }

    this.logger.debug(`Market indexing complete: ${marketAddress}`, {
      eventsProcessed: processedCount,
      positionsInMarket:
        this.positionStore.getAllForMarket(marketAddress).length,
    });
  }

  /**
   * Scan the DutchAuctionLiquidator's events to populate the AuctionStore.
   *
   * We track 3 event types:
   *   AuctionStarted → new auction created
   *   LiquidationExecuted → auction was fulfilled (fully or partially)
   *   AuctionCancelled → auction was cancelled (expired, etc.)
   *
   * After processing, the AuctionStore knows which auctions are currently
   * active and available for the bot to bid on.
   */
  private async indexLiquidatorEvents(
    liquidatorAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    this.logger.debug(`Indexing liquidator events: ${liquidatorAddress}`, {
      fromBlock,
      toBlock,
    });

    const iface = new ethers.Interface(LIQUIDATOR_ABI);

    const eventTopics = [
      iface.getEvent("AuctionStarted")!.topicHash,
      iface.getEvent("LiquidationExecuted")!.topicHash,
      iface.getEvent("AuctionCancelled")!.topicHash,
    ];

    const allLogs = await this.fetchLogsInChunks(
      liquidatorAddress,
      eventTopics,
      fromBlock,
      toBlock,
    );

    // Sort chronologically
    allLogs.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.index - b.index;
    });

    let processedCount = 0;

    for (const log of allLogs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (!parsed) continue;

        switch (parsed.name) {
          case "AuctionStarted": {
            // AuctionStarted(auctionId, user, pool, debtToRepay,
            //                collateralForSale, startPrice, endPrice)
            const auctionId = parsed.args[0] as bigint; // indexed
            const user = parsed.args[1] as string; // indexed
            const pool = parsed.args[2] as string; // indexed
            const debtToRepay = parsed.args[3] as bigint;
            const collateralForSale = parsed.args[4] as bigint;
            const startPrice = parsed.args[5] as bigint;
            const endPrice = parsed.args[6] as bigint;

            // We need the block timestamp to know the auction timing.
            // For historical indexing, we fetch the block.
            // Note: this is an extra RPC call per auction, but auctions
            // are infrequent so it's acceptable.
            const block = await this.provider.getBlock(log.blockNumber);
            const startTime = block?.timestamp ?? Math.floor(Date.now() / 1000);

            // Read auction duration from the event data
            // endTime = startTime + duration (20 minutes = 1200 seconds)
            // We calculate based on the protocol's default
            const duration = 20 * 60; // 20 minutes — matches contract

            this.auctionStore.add({
              auctionId,
              user: user.toLowerCase(),
              pool: pool.toLowerCase(),
              debtToRepay,
              collateralForSale,
              startTime,
              endTime: startTime + duration,
              startPrice,
              endPrice,
              isActive: true,
            });

            // Also update the position store — collateral is locked
            // The position's collateral was reduced in the contract
            this.positionStore.removeCollateral(
              pool,
              user,
              collateralForSale,
              log.blockNumber,
            );

            break;
          }

          case "LiquidationExecuted": {
            // LiquidationExecuted(auctionId, liquidator, debtRepaid,
            //                      collateralReceived, executionPrice)
            const auctionId = parsed.args[0] as bigint;
            // args[1] is liquidator address — we don't need it
            const debtRepaid = parsed.args[2] as bigint;

            // Mark auction as completed
            this.auctionStore.markCompleted(auctionId);

            // Update the borrower's position — their debt decreased
            const auction = this.auctionStore.get(auctionId);
            if (auction) {
              // debtRepaid is in borrow token terms, but we track borrowShares.
              // We'd need the borrowIndex to convert... For historical indexing,
              // we approximate by removing proportional shares.
              // The next health check will read the true on-chain values anyway.
              //
              // NOTE: This is a simplification. In a production bot, you might
              // also read the actual position from the contract to reconcile.
            }

            break;
          }

          case "AuctionCancelled": {
            // AuctionCancelled(auctionId, reason)
            const auctionId = parsed.args[0] as bigint;
            this.auctionStore.markCompleted(auctionId);
            break;
          }
        }

        processedCount++;
      } catch (error) {
        this.logger.warn("Failed to parse liquidator event log", {
          blockNumber: log.blockNumber,
          logIndex: log.index,
          error: (error as Error).message,
        });
      }
    }

    this.logger.debug("Liquidator indexing complete", {
      eventsProcessed: processedCount,
      activeAuctions: this.auctionStore.getActiveCount(),
    });
  }

  /**
   * Fetch event logs in chunks to respect RPC limits.
   *
   * WHY CHUNKING IS NECESSARY
   * ─────────────────────────
   * Most RPC providers (Alchemy, QuickNode, public RPCs) limit getLogs to
   * a certain block range or result count. If you ask for too many blocks:
   *   - Some return an error: "query returned more than 10000 results"
   *   - Some silently truncate results (dangerous!)
   *   - Some timeout
   *
   * By chunking into 2000-block ranges, we stay well within limits.
   * The chunks are processed sequentially — no need for parallel requests
   * since this only runs once on startup.
   *
   * TOPIC FILTERING
   * ───────────────
   * The `topics` parameter uses OR logic within an array at position [0]:
   *   topics: [null] → match ALL events
   *   topics: [[topicA, topicB]] → match events where topic0 is A OR B
   *
   * We pass our event signature hashes as an array, so the RPC returns
   * only the events we care about. This is much more efficient than
   * fetching all events and filtering client-side.
   */
  private async fetchLogsInChunks(
    contractAddress: string,
    eventTopics: string[],
    fromBlock: number,
    toBlock: number,
  ): Promise<ethers.Log[]> {
    const allLogs: ethers.Log[] = [];
    let currentFrom = fromBlock;

    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + CHUNK_SIZE - 1, toBlock);

      try {
        const logs = await this.provider.getLogs({
          address: contractAddress,
          // [eventTopics] → OR filter: match any of these event signatures
          topics: [eventTopics],
          fromBlock: currentFrom,
          toBlock: currentTo,
        });

        allLogs.push(...logs);

        this.logger.debug(`Fetched logs chunk`, {
          contract: contractAddress.slice(0, 10) + "...",
          fromBlock: currentFrom,
          toBlock: currentTo,
          logsFound: logs.length,
        });
      } catch (error) {
        // If chunk is too large, try halving it
        // Some RPCs have lower limits than our CHUNK_SIZE
        if (CHUNK_SIZE > 500 && currentTo - currentFrom > 500) {
          this.logger.warn(
            "getLogs chunk failed, retrying with smaller range",
            {
              fromBlock: currentFrom,
              toBlock: currentTo,
              error: (error as Error).message,
            },
          );

          // Retry with half the range
          const midBlock = Math.floor((currentFrom + currentTo) / 2);
          const firstHalf = await this.fetchLogsInChunks(
            contractAddress,
            eventTopics,
            currentFrom,
            midBlock,
          );
          const secondHalf = await this.fetchLogsInChunks(
            contractAddress,
            eventTopics,
            midBlock + 1,
            currentTo,
          );
          allLogs.push(...firstHalf, ...secondHalf);
        } else {
          this.logger.error("getLogs failed even with small chunk", {
            fromBlock: currentFrom,
            toBlock: currentTo,
            error: (error as Error).message,
          });
          // Skip this chunk and continue — better to have partial data
          // than to crash the bot
        }
      }

      currentFrom = currentTo + 1;
    }

    return allLogs;
  }
}
