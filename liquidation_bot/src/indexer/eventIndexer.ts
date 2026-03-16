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

/** How many blocks to scan per getLogs call */
const CHUNK_SIZE = 10; // 2000 for paid providers

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

  async indexAll(
    markets: string[],
    liquidatorAddress: string,
    fromBlock: number,
  ): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    this.logger.info("Starting historical indexing", {
      fromBlock,
      currentBlock,
      markets: markets.length,
    });
    for (const market of markets)
      await this.indexMarketEvents(market, fromBlock, currentBlock);
    await this.indexLiquidatorEvents(
      liquidatorAddress,
      fromBlock,
      currentBlock,
    );
    const pruned = this.positionStore.pruneEmpty();
    this.logger.info("Indexing complete", {
      positions: this.positionStore.getTotalPositions(),
      borrowers: this.positionStore.getActiveBorrowerCount(),
      auctions: this.auctionStore.getActiveCount(),
      pruned,
    });
  }

  private async indexMarketEvents(
    marketAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    const iface = new ethers.Interface(LENDING_POOL_ABI);
    const topics = [
      iface.getEvent("DepositCollateral")!.topicHash,
      iface.getEvent("WithdrawCollateral")!.topicHash,
      iface.getEvent("Borrow")!.topicHash,
      iface.getEvent("Repay")!.topicHash,
    ];
    const logs = await this.fetchLogsInChunks(
      marketAddress,
      topics,
      fromBlock,
      toBlock,
    );
    logs.sort((a, b) =>
      a.blockNumber !== b.blockNumber
        ? a.blockNumber - b.blockNumber
        : a.index - b.index,
    );
    for (const log of logs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed) continue;
        const bn = log.blockNumber;
        switch (parsed.name) {
          case "DepositCollateral":
            this.positionStore.addCollateral(
              marketAddress,
              parsed.args[0],
              parsed.args[1],
              bn,
            );
            break;
          case "WithdrawCollateral":
            this.positionStore.removeCollateral(
              marketAddress,
              parsed.args[0],
              parsed.args[1],
              bn,
            );
            break;
          case "Borrow":
            this.positionStore.addBorrowShares(
              marketAddress,
              parsed.args[0],
              parsed.args[1],
              bn,
            );
            break;
          case "Repay":
            this.positionStore.removeBorrowShares(
              marketAddress,
              parsed.args[0],
              parsed.args[1],
              bn,
            );
            break;
        }
      } catch (e) {
        this.logger.warn("Failed to parse event", {
          block: log.blockNumber,
          error: (e as Error).message,
        });
      }
    }
  }

  private async indexLiquidatorEvents(
    liquidatorAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    const iface = new ethers.Interface(LIQUIDATOR_ABI);
    const topics = [
      iface.getEvent("AuctionStarted")!.topicHash,
      iface.getEvent("AuctionExecuted")!.topicHash,
      iface.getEvent("AuctionCancelled")!.topicHash,
    ];
    const logs = await this.fetchLogsInChunks(
      liquidatorAddress,
      topics,
      fromBlock,
      toBlock,
    );
    logs.sort((a, b) =>
      a.blockNumber !== b.blockNumber
        ? a.blockNumber - b.blockNumber
        : a.index - b.index,
    );
    for (const log of logs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed) continue;
        switch (parsed.name) {
          case "AuctionStarted": {
            const block = await this.provider.getBlock(log.blockNumber);
            const startTime = block?.timestamp ?? Math.floor(Date.now() / 1000);
            this.auctionStore.add({
              auctionId: parsed.args[0],
              user: (parsed.args[1] as string).toLowerCase(),
              pool: (parsed.args[2] as string).toLowerCase(),
              debtToRepay: parsed.args[3],
              collateralForSale: parsed.args[4],
              startTime,
              endTime: startTime + 1200,
              startPrice: parsed.args[5],
              endPrice: parsed.args[6],
              isActive: true,
            });
            this.positionStore.removeCollateral(
              parsed.args[2],
              parsed.args[1],
              parsed.args[4],
              log.blockNumber,
            );
            break;
          }
          case "AuctionExecuted":
            this.auctionStore.markCompleted(parsed.args[0]);
            break;
          case "AuctionCancelled":
            this.auctionStore.markCompleted(parsed.args[0]);
            break;
        }
      } catch (e) {
        this.logger.warn("Failed to parse liquidator event", {
          error: (e as Error).message,
        });
      }
    }
  }

  private async fetchLogsInChunks(
    address: string,
    eventTopics: string[],
    from: number,
    to: number,
  ): Promise<ethers.Log[]> {
    const all: ethers.Log[] = [];
    let current = from;
    while (current <= to) {
      const end = Math.min(current + CHUNK_SIZE - 1, to);
      try {
        const logs = await this.provider.getLogs({
          address,
          topics: [eventTopics],
          fromBlock: current,
          toBlock: end,
        });
        all.push(...logs);
      } catch (e) {
        if (end - current > 500) {
          const mid = Math.floor((current + end) / 2);
          all.push(
            ...(await this.fetchLogsInChunks(
              address,
              eventTopics,
              current,
              mid,
            )),
          );
          all.push(
            ...(await this.fetchLogsInChunks(
              address,
              eventTopics,
              mid + 1,
              end,
            )),
          );
        } else {
          this.logger.error("getLogs failed", {
            from: current,
            to: end,
            error: (e as Error).message,
          });
        }
      }
      current = end + 1;
    }
    return all;
  }
}
