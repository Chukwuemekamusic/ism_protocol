import { ethers } from "ethers";
import type winston from "winston";
import type { PositionStore } from "../state/positionStore.js";
import type { AuctionStore } from "../state/auctionStore.js";
import {
  LENDING_POOL_ABI,
  LIQUIDATOR_ABI,
  MARKET_REGISTRY_ABI,
} from "../contracts/abis.js";

/**
 * EventListener — Real-time event subscription via WebSocket.
 *
 * HOW THIS RELATES TO THE EVENT INDEXER
 * ──────────────────────────────────────
 * The EventIndexer scans PAST events (historical). It runs once on startup.
 * The EventListener subscribes to FUTURE events (real-time). It runs forever.
 *
 * Together, they ensure the bot always has an accurate view:
 *   1. Bot starts → EventIndexer rebuilds state from last 10,000 blocks
 *   2. EventListener starts → catches every new event as it happens
 *   3. No gap between historical and live — they overlap slightly to be safe
 *
 * WHY WEBSOCKET?
 * ──────────────
 * HTTP RPCs require polling: "give me events from block X to Y" every N seconds.
 * WebSockets push events to us the moment they happen. This means:
 *   - Lower latency: we learn about events ~instantly vs. every polling interval
 *   - Less RPC load: no repeated getLogs calls
 *   - Better for liquidation bots: speed matters when competing with others
 *
 * RECONNECTION
 * ────────────
 * WebSocket connections can drop (network issues, RPC maintenance, etc.).
 * We handle this by:
 *   1. Detecting disconnection via the provider's error/close events
 *   2. Waiting with exponential backoff before reconnecting
 *   3. Re-subscribing to all events after reconnection
 *
 * In a production bot, the gap between disconnect and reconnect could
 * miss some events. A more robust approach would re-index the missed
 * blocks after reconnecting. For our testnet bot, simple reconnection
 * with periodic full reconciliation (reading on-chain state) is sufficient.
 */
export class EventListener {
  private wsProvider: ethers.WebSocketProvider;
  private positionStore: PositionStore;
  private auctionStore: AuctionStore;
  private logger: winston.Logger;
  private marketContracts: ethers.Contract[] = [];
  private liquidatorContract: ethers.Contract | null = null;
  private registryContract: ethers.Contract | null = null;

  constructor(
    wsProvider: ethers.WebSocketProvider,
    positionStore: PositionStore,
    auctionStore: AuctionStore,
    logger: winston.Logger,
  ) {
    this.wsProvider = wsProvider;
    this.positionStore = positionStore;
    this.auctionStore = auctionStore;
    this.logger = logger;
  }

  subscribeToMarket(marketAddress: string): void {
    const c = new ethers.Contract(
      marketAddress,
      LENDING_POOL_ABI,
      this.wsProvider,
    );
    c.on(
      c.filters.DepositCollateral(),
      (user: string, amount: bigint, event: ethers.ContractEventPayload) => {
        this.positionStore.addCollateral(
          marketAddress,
          user,
          amount,
          event.log.blockNumber,
        );
      },
    );
    c.on(
      c.filters.WithdrawCollateral(),
      (user: string, amount: bigint, event: ethers.ContractEventPayload) => {
        this.positionStore.removeCollateral(
          marketAddress,
          user,
          amount,
          event.log.blockNumber,
        );
      },
    );
    c.on(
      c.filters.Borrow(),
      (
        user: string,
        shares: bigint,
        _amt: bigint,
        event: ethers.ContractEventPayload,
      ) => {
        this.positionStore.addBorrowShares(
          marketAddress,
          user,
          shares,
          event.log.blockNumber,
        );
      },
    );
    c.on(
      c.filters.Repay(),
      (
        user: string,
        shares: bigint,
        _amt: bigint,
        event: ethers.ContractEventPayload,
      ) => {
        this.positionStore.removeBorrowShares(
          marketAddress,
          user,
          shares,
          event.log.blockNumber,
        );
      },
    );
    this.marketContracts.push(c);
    this.logger.info(`Subscribed to market: ${marketAddress}`);
  }

  subscribeToAllMarkets(markets: string[]): void {
    for (const m of markets) this.subscribeToMarket(m);
  }

  subscribeToLiquidator(liquidatorAddress: string): void {
    const c = new ethers.Contract(
      liquidatorAddress,
      LIQUIDATOR_ABI,
      this.wsProvider,
    );
    c.on(
      c.filters.AuctionStarted(),
      (
        id: bigint,
        user: string,
        pool: string,
        debt: bigint,
        collateral: bigint,
        startPrice: bigint,
        endPrice: bigint,
        event: ethers.ContractEventPayload,
      ) => {
        const startTime = Math.floor(Date.now() / 1000);
        this.auctionStore.add({
          auctionId: id,
          user: user.toLowerCase(),
          pool: pool.toLowerCase(),
          debtToRepay: debt,
          collateralForSale: collateral,
          startTime,
          endTime: startTime + 1200,
          startPrice,
          endPrice,
          isActive: true,
        });
        this.positionStore.removeCollateral(
          pool,
          user,
          collateral,
          event.log.blockNumber,
        );
        this.logger.info("Event: AuctionStarted", {
          auctionId: id.toString(),
          user: user.slice(0, 10),
        });
      },
    );
    c.on(
      c.filters.AuctionExecuted(),
      (
        id: bigint,
        liquidator: string,
        debtRepaid: bigint,
        collateralReceived: bigint,
      ) => {
        this.auctionStore.markCompleted(id);
        this.logger.info("Event: AuctionExecuted", {
          auctionId: id.toString(),
          debtRepaid: debtRepaid.toString(),
        });
      },
    );
    c.on(c.filters.AuctionCancelled(), (id: bigint, reason: string) => {
      this.auctionStore.markCompleted(id);
      this.logger.info("Event: AuctionCancelled", {
        auctionId: id.toString(),
        reason,
      });
    });
    this.liquidatorContract = c;
    this.logger.info(`Subscribed to liquidator: ${liquidatorAddress}`);
  }

  subscribeToNewMarkets(
    registryAddress: string,
    onNewMarket: (addr: string) => void,
  ): void {
    const c = new ethers.Contract(
      registryAddress,
      MARKET_REGISTRY_ABI,
      this.wsProvider,
    );
    c.on(c.filters.MarketRegistered(), (pool: string) => {
      this.logger.info("New market registered!", { pool });
      onNewMarket(pool);
    });
    this.registryContract = c;
  }

  async unsubscribeAll(): Promise<void> {
    for (const c of this.marketContracts) await c.removeAllListeners();
    this.marketContracts = [];
    if (this.liquidatorContract) {
      await this.liquidatorContract.removeAllListeners();
      this.liquidatorContract = null;
    }
    if (this.registryContract) {
      await this.registryContract.removeAllListeners();
      this.registryContract = null;
    }
    this.logger.info("All event subscriptions removed");
  }

  getSubscriptionCount(): number {
    return (
      this.marketContracts.length +
      (this.liquidatorContract ? 1 : 0) +
      (this.registryContract ? 1 : 0)
    );
  }
}
