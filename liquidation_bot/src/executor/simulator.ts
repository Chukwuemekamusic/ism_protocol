import { ethers } from "ethers";
import type winston from "winston";

/**
 * TransactionSimulator — "Dry run" transactions before submitting them.
 *
 * WHY SIMULATE FIRST?
 * ───────────────────
 * Every failed transaction still costs gas. On Ethereum mainnet, a failed
 * liquidation attempt could cost $5-50 in wasted gas. Even on Base where
 * gas is cheap, failed txs are noisy and slow down the bot.
 *
 * Simulation uses eth_call (staticCall in ethers v6) to execute the
 * transaction against the current blockchain state WITHOUT actually
 * submitting it. If it reverts, we find out for free. If it succeeds,
 * we get the return values (like the auctionId or collateral received).
 *
 * COMMON REASONS FOR SIMULATION FAILURE
 * ──────────────────────────────────────
 * - Position was repaid between detection and execution
 * - Another bot already started the auction
 * - Another bot already liquidated the auction
 * - Price moved and position is no longer liquidatable
 * - Insufficient token balance or allowance
 * - Auction expired during our processing
 *
 * All of these are normal in competitive liquidation environments.
 * The simulation catches them before we waste gas.
 */
export class TransactionSimulator {
  private provider: ethers.JsonRpcProvider;
  private logger: winston.Logger;

  constructor(provider: ethers.JsonRpcProvider, logger: winston.Logger) {
    this.provider = provider;
    this.logger = logger;
  }

  /**
   * Simulate a startAuction call.
   *
   * staticCall executes the function against the current state and returns
   * what WOULD happen, without actually modifying state or costing gas.
   *
   * On success: returns the auctionId that would be created
   * On failure: returns the revert reason (e.g., "PositionNotLiquidatable")
   */
  async simulateStartAuction(
    liquidatorContract: ethers.Contract,
    pool: string,
    user: string,
  ): Promise<{ success: boolean; auctionId?: bigint; error?: string }> {
    try {
      // staticCall = eth_call = read-only simulation
      const auctionId: bigint =
        await liquidatorContract.startAuction.staticCall(pool, user);

      this.logger.debug("startAuction simulation succeeded", {
        pool: pool.slice(0, 10),
        user: user.slice(0, 10),
        auctionId: auctionId.toString(),
      });

      return { success: true, auctionId };
    } catch (error: unknown) {
      const err = error as Error & {
        reason?: string;
        revert?: { name: string };
      };

      // Extract the revert reason for clear logging
      const reason = err.revert?.name ?? err.reason ?? err.message;

      this.logger.debug("startAuction simulation failed", {
        pool: pool.slice(0, 10),
        user: user.slice(0, 10),
        reason,
      });

      return { success: false, error: reason };
    }
  }

  /**
   * Simulate a liquidate call.
   *
   * Returns the exact amounts that would be exchanged:
   *   - debtRepaid: how much borrow token we'd pay
   *   - collateralReceived: how much collateral we'd get
   *
   * This lets us do a final profit check with exact numbers
   * before committing real funds.
   */
  async simulateLiquidate(
    liquidatorContract: ethers.Contract,
    auctionId: bigint,
    maxDebtToRepay: bigint,
  ): Promise<{
    success: boolean;
    debtRepaid?: bigint;
    collateralReceived?: bigint;
    error?: string;
  }> {
    try {
      const [debtRepaid, collateralReceived]: [bigint, bigint] =
        await liquidatorContract.liquidate.staticCall(
          auctionId,
          maxDebtToRepay,
        );

      this.logger.debug("liquidate simulation succeeded", {
        auctionId: auctionId.toString(),
        debtRepaid: debtRepaid.toString(),
        collateralReceived: collateralReceived.toString(),
      });

      return { success: true, debtRepaid, collateralReceived };
    } catch (error: unknown) {
      const err = error as Error & {
        reason?: string;
        revert?: { name: string };
      };
      const reason = err.revert?.name ?? err.reason ?? err.message;

      this.logger.debug("liquidate simulation failed", {
        auctionId: auctionId.toString(),
        reason,
      });

      return { success: false, error: reason };
    }
  }
}
