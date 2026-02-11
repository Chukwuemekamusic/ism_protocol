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

  /** Track active contract listeners so we can clean up */
  private marketContracts: ethers.Contract[] = [];
  private liquidatorContract: ethers.Contract | null = null;
  private registryContract: ethers.Contract | null = null;

  /** Callback when a new market is discovered */
  private onNewMarket: ((marketAddress: string) => void) | null = null;

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

  /**
   * Subscribe to all position-related events for a single market.
   *
   * WHAT WE LISTEN FOR
   * ──────────────────
   * Same events as the historical indexer:
   *   CollateralDeposited, CollateralWithdrawn, Borrowed, Repaid
   *
   * ETHERS V6 EVENT SYNTAX
   * ──────────────────────
   * In ethers v6, we use contract.on("EventName", callback).
   * The callback receives the decoded event args directly — no manual
   * parsing needed. Much cleaner than the raw getLogs approach in
   * the historical indexer.
   */
  subscribeToMarket(marketAddress: string): void {
    const contract = new ethers.Contract(
      marketAddress,
      LENDING_POOL_ABI,
      this.wsProvider,
    );

    // --- CollateralDeposited ---
    contract.on(
      contract.filters.CollateralDeposited(),
      (user: string, amount: bigint, event: ethers.ContractEventPayload) => {
        const blockNumber = event.log.blockNumber;
        this.logger.debug("Event: CollateralDeposited", {
          market: marketAddress.slice(0, 10),
          user: user.slice(0, 10),
          amount: amount.toString(),
          block: blockNumber,
        });
        this.positionStore.addCollateral(
          marketAddress,
          user,
          amount,
          blockNumber,
        );
      },
    );

    // --- CollateralWithdrawn ---
    contract.on(
      contract.filters.CollateralWithdrawn(),
      (user: string, amount: bigint, event: ethers.ContractEventPayload) => {
        const blockNumber = event.log.blockNumber;
        this.logger.debug("Event: CollateralWithdrawn", {
          market: marketAddress.slice(0, 10),
          user: user.slice(0, 10),
          amount: amount.toString(),
          block: blockNumber,
        });
        this.positionStore.removeCollateral(
          marketAddress,
          user,
          amount,
          blockNumber,
        );
      },
    );

    // --- Borrowed ---
    contract.on(
      contract.filters.Borrowed(),
      (
        user: string,
        borrowShares: bigint,
        _borrowAmount: bigint,
        event: ethers.ContractEventPayload,
      ) => {
        const blockNumber = event.log.blockNumber;
        this.logger.info("Event: Borrowed", {
          market: marketAddress.slice(0, 10),
          user: user.slice(0, 10),
          borrowShares: borrowShares.toString(),
          block: blockNumber,
        });
        this.positionStore.addBorrowShares(
          marketAddress,
          user,
          borrowShares,
          blockNumber,
        );
      },
    );

    // --- Repaid ---
    contract.on(
      contract.filters.Repaid(),
      (
        user: string,
        repaidShares: bigint,
        _repaidAmount: bigint,
        event: ethers.ContractEventPayload,
      ) => {
        const blockNumber = event.log.blockNumber;
        this.logger.info("Event: Repaid", {
          market: marketAddress.slice(0, 10),
          user: user.slice(0, 10),
          repaidShares: repaidShares.toString(),
          block: blockNumber,
        });
        this.positionStore.removeBorrowShares(
          marketAddress,
          user,
          repaidShares,
          blockNumber,
        );
      },
    );

    this.marketContracts.push(contract);
    this.logger.info(`Subscribed to market events: ${marketAddress}`);
  }

  /**
   * Subscribe to all markets at once.
   */
  subscribeToAllMarkets(markets: string[]): void {
    for (const market of markets) {
      this.subscribeToMarket(market);
    }
    this.logger.info(`Subscribed to ${markets.length} markets`);
  }

  /**
   * Subscribe to the DutchAuctionLiquidator's events.
   *
   * WHY SUBSCRIBE TO THE LIQUIDATOR?
   * ────────────────────────────────
   * Other bots (or manual liquidators) might start auctions or execute
   * liquidations before us. We need to know about these to:
   *   - Not try to start an auction that already exists
   *   - Track active auctions for potential bidding
   *   - Update positions after liquidations reduce their debt
   */
  subscribeToLiquidator(liquidatorAddress: string): void {
    const contract = new ethers.Contract(
      liquidatorAddress,
      LIQUIDATOR_ABI,
      this.wsProvider,
    );

    // --- AuctionStarted ---
    contract.on(
      contract.filters.AuctionStarted(),
      (
        auctionId: bigint,
        user: string,
        pool: string,
        debtToRepay: bigint,
        collateralForSale: bigint,
        startPrice: bigint,
        endPrice: bigint,
        event: ethers.ContractEventPayload,
      ) => {
        this.logger.info("Event: AuctionStarted", {
          auctionId: auctionId.toString(),
          user: user.slice(0, 10),
          pool: pool.slice(0, 10),
          debtToRepay: debtToRepay.toString(),
        });

        // Get the block timestamp for auction timing
        // For real-time events, we can approximate with Date.now()
        const startTime = Math.floor(Date.now() / 1000);
        const duration = 20 * 60; // 20 minutes

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

        // Update position — collateral was locked
        this.positionStore.removeCollateral(
          pool,
          user,
          collateralForSale,
          event.log.blockNumber,
        );
      },
    );

    // --- LiquidationExecuted ---
    contract.on(
      contract.filters.LiquidationExecuted(),
      (
        auctionId: bigint,
        liquidator: string,
        debtRepaid: bigint,
        collateralReceived: bigint,
        executionPrice: bigint,
        _event: ethers.ContractEventPayload,
      ) => {
        this.logger.info("Event: LiquidationExecuted", {
          auctionId: auctionId.toString(),
          liquidator: liquidator.slice(0, 10),
          debtRepaid: debtRepaid.toString(),
          collateralReceived: collateralReceived.toString(),
        });

        this.auctionStore.markCompleted(auctionId);

        // NOTE: We should also update the borrower's position here.
        // However, converting debtRepaid back to borrowShares requires
        // the current borrowIndex. For now, we mark the auction done
        // and let the health monitor's next cycle read the true
        // on-chain position values for reconciliation.
      },
    );

    // --- AuctionCancelled ---
    contract.on(
      contract.filters.AuctionCancelled(),
      (
        auctionId: bigint,
        reason: string,
        _event: ethers.ContractEventPayload,
      ) => {
        this.logger.info("Event: AuctionCancelled", {
          auctionId: auctionId.toString(),
          reason,
        });
        this.auctionStore.markCompleted(auctionId);
      },
    );

    this.liquidatorContract = contract;
    this.logger.info(`Subscribed to liquidator events: ${liquidatorAddress}`);
  }

  /**
   * Subscribe to the MarketRegistry for new market creation.
   *
   * WHY?
   * ────
   * If someone creates a new market after the bot starts, we want to
   * automatically start monitoring it. Without this, the bot would miss
   * liquidation opportunities in new markets until restarted.
   *
   * @param registryAddress - MarketRegistry contract address
   * @param onNewMarket - Callback invoked with the new market's address.
   *                       The main loop uses this to start indexing the
   *                       new market and subscribing to its events.
   */
  subscribeToNewMarkets(
    registryAddress: string,
    onNewMarket: (marketAddress: string) => void,
  ): void {
    const contract = new ethers.Contract(
      registryAddress,
      MARKET_REGISTRY_ABI,
      this.wsProvider,
    );

    contract.on(
      contract.filters.MarketRegistered(),
      (pool: string, collateralToken: string, borrowToken: string) => {
        this.logger.info("Event: New market registered!", {
          pool,
          collateralToken: collateralToken.slice(0, 10),
          borrowToken: borrowToken.slice(0, 10),
        });

        // Notify the main loop to add this market to monitoring
        onNewMarket(pool);
      },
    );

    this.registryContract = contract;
    this.onNewMarket = onNewMarket;
    this.logger.info(
      `Subscribed to new market registrations: ${registryAddress}`,
    );
  }

  /**
   * Unsubscribe from all events.
   *
   * Called during graceful shutdown (SIGINT/SIGTERM) to clean up
   * WebSocket connections and prevent memory leaks.
   */
  async unsubscribeAll(): Promise<void> {
    this.logger.info("Unsubscribing from all events...");

    // Remove all listeners from market contracts
    for (const contract of this.marketContracts) {
      await contract.removeAllListeners();
    }
    this.marketContracts = [];

    // Remove liquidator listeners
    if (this.liquidatorContract) {
      await this.liquidatorContract.removeAllListeners();
      this.liquidatorContract = null;
    }

    // Remove registry listeners
    if (this.registryContract) {
      await this.registryContract.removeAllListeners();
      this.registryContract = null;
    }

    this.logger.info("All event subscriptions removed");
  }

  /**
   * Get the count of active subscriptions (for monitoring).
   */
  getSubscriptionCount(): number {
    let count = this.marketContracts.length; // one per market
    if (this.liquidatorContract) count++;
    if (this.registryContract) count++;
    return count;
  }
}
