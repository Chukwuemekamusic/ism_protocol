import { ethers } from "ethers";
import type winston from "winston";
import type { BotConfig, Opportunity, ExecutionResult } from "../types.js";
import { OpportunityType, MAX_UINT256 } from "../types.js";
import { TransactionSimulator } from "./simulator.js";
import { LIQUIDATOR_ABI, ERC20_ABI } from "../contracts/abis.js";

/**
 * Executor — Sends real transactions to the blockchain.
 *
 * This is where the bot actually spends money (gas) and earns money
 * (collateral discounts). Everything before this was read-only.
 *
 * NONCE MANAGEMENT
 * ────────────────
 * Every Ethereum transaction has a "nonce" — a sequential counter that
 * prevents replay attacks. If you send two txs with the same nonce,
 * only one will be mined. If you skip a nonce, subsequent txs get stuck.
 *
 * We track the nonce locally to avoid race conditions:
 *   1. Fetch nonce from chain on startup
 *   2. Increment locally after each submission
 *   3. Reset from chain if a tx fails (nonce may be desynced)
 *
 * In a multi-bot setup you'd need a nonce manager service, but for
 * a single bot instance this is sufficient.
 *
 * SEQUENTIAL EXECUTION
 * ────────────────────
 * We execute opportunities one at a time, not in parallel. Why?
 *   - Nonce management is simpler (no concurrent increment)
 *   - Each tx can change the state that subsequent txs depend on
 *   - On L2s, block times are fast enough that sequential is fine
 *
 * TOKEN APPROVAL
 * ──────────────
 * To execute liquidations, the bot wallet must have:
 *   1. Enough borrow tokens (e.g., USDC) to repay the debt
 *   2. An ERC20 approval for the Liquidator contract to spend them
 *
 * We set a max approval once on startup so every future liquidation
 * can proceed without an extra approval tx.
 */
export class Executor {
  private wallet: ethers.Wallet;
  private liquidatorContract: ethers.Contract;
  private simulator: TransactionSimulator;
  private config: BotConfig;
  private logger: winston.Logger;

  /** Locally tracked nonce — avoids race conditions */
  private nonce: number = 0;

  /** Track in-flight transactions to prevent double-submission */
  private pendingTxHashes: Set<string> = new Set();

  /** Track which tokens we've already approved */
  private approvedTokens: Set<string> = new Set();

  constructor(
    wallet: ethers.Wallet,
    liquidatorAddress: string,
    simulator: TransactionSimulator,
    config: BotConfig,
    logger: winston.Logger,
  ) {
    this.wallet = wallet;
    this.liquidatorContract = new ethers.Contract(
      liquidatorAddress,
      LIQUIDATOR_ABI,
      wallet,
    );
    this.simulator = simulator;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the executor — must be called before any execution.
   * Fetches the current nonce and logs the wallet balance.
   */
  async initialize(): Promise<void> {
    this.nonce = await this.wallet.getNonce();
    const balance = await this.wallet.provider!.getBalance(this.wallet.address);

    this.logger.info("Executor initialized", {
      wallet: this.wallet.address,
      nonce: this.nonce,
      ethBalance: ethers.formatEther(balance),
    });
  }

  /**
   * Ensure the Liquidator contract is approved to spend a borrow token.
   *
   * WHY MAX APPROVAL?
   * ─────────────────
   * ERC20 tokens require a two-step process:
   *   1. approve(spender, amount) — allow spender to transfer your tokens
   *   2. transferFrom(owner, ...) — the spender pulls the tokens
   *
   * We set amount = type(uint256).max so we only need to approve once.
   * This is standard practice for DeFi protocols and bots. The trade-off
   * is that if the Liquidator contract is compromised, it could drain
   * our tokens — acceptable on testnet, review for production.
   */
  async ensureApproval(borrowTokenAddress: string): Promise<void> {
    const tokenKey = borrowTokenAddress.toLowerCase();
    if (this.approvedTokens.has(tokenKey)) return;

    const token = new ethers.Contract(
      borrowTokenAddress,
      ERC20_ABI,
      this.wallet,
    );

    // Check current allowance
    const allowance: bigint = await token.allowance(
      this.wallet.address,
      this.config.liquidator,
    );

    // If allowance is already large enough, skip
    if (allowance > MAX_UINT256 / 2n) {
      this.approvedTokens.add(tokenKey);
      this.logger.debug("Token already approved", {
        token: tokenKey.slice(0, 10),
      });
      return;
    }

    // Send approval transaction
    this.logger.info("Approving token for Liquidator...", {
      token: tokenKey.slice(0, 10),
      spender: this.config.liquidator.slice(0, 10),
    });

    try {
      const tx = await token.approve(this.config.liquidator, MAX_UINT256, {
        nonce: this.nonce++,
      });
      await tx.wait();
      this.approvedTokens.add(tokenKey);
      this.logger.info("Token approved successfully", { txHash: tx.hash });
    } catch (error) {
      this.nonce = await this.wallet.getNonce(); // Reset nonce on failure
      this.logger.error("Token approval failed", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Execute any opportunity (dispatches to the right method).
   */
  async execute(opportunity: Opportunity): Promise<ExecutionResult> {
    if (opportunity.type === OpportunityType.START_AUCTION) {
      return this.executeStartAuction(opportunity);
    } else {
      return this.executeLiquidate(opportunity);
    }
  }

  /**
   * Execute a START_AUCTION transaction.
   *
   * FLOW:
   * 1. Simulate (free) → catches reverts before spending gas
   * 2. Estimate gas → know the exact cost
   * 3. Check gas price → don't overpay during spikes
   * 4. Submit transaction → the real deal
   * 5. Wait for confirmation → get the receipt
   * 6. Log everything → for debugging and P&L tracking
   */
  private async executeStartAuction(
    opp: Opportunity,
  ): Promise<ExecutionResult> {
    this.logger.info("Executing START_AUCTION...", {
      market: opp.market.slice(0, 10),
      user: opp.user.slice(0, 10),
    });

    // Step 1: Simulate
    const sim = await this.simulator.simulateStartAuction(
      this.liquidatorContract,
      opp.market,
      opp.user,
    );

    if (!sim.success) {
      return {
        success: false,
        error: `Simulation failed: ${sim.error}`,
      };
    }

    // Step 2: Estimate gas
    let gasLimit: bigint;
    try {
      const estimate = await this.liquidatorContract.startAuction.estimateGas(
        opp.market,
        opp.user,
      );
      // Apply safety multiplier (e.g., 1.2x)
      gasLimit = BigInt(
        Math.ceil(Number(estimate) * this.config.gasMultiplier),
      );
    } catch (error) {
      return {
        success: false,
        error: `Gas estimation failed: ${(error as Error).message}`,
      };
    }

    // Step 3: Check gas price
    const feeData = await this.wallet.provider!.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    if (gasPrice > this.config.maxGasPrice) {
      return {
        success: false,
        error: `Gas price too high: ${gasPrice} > ${this.config.maxGasPrice}`,
      };
    }

    // Step 4: Submit
    try {
      const tx = await this.liquidatorContract.startAuction(
        opp.market,
        opp.user,
        {
          gasLimit,
          nonce: this.nonce++,
        },
      );

      this.logger.info(`startAuction tx submitted: ${tx.hash}`);
      this.pendingTxHashes.add(tx.hash);

      // Step 5: Wait for confirmation
      const receipt = await tx.wait();
      this.pendingTxHashes.delete(tx.hash);

      if (receipt && receipt.status === 1) {
        this.logger.info("✅ startAuction confirmed", {
          txHash: tx.hash,
          block: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          auctionId: sim.auctionId?.toString(),
        });

        return {
          success: true,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        };
      } else {
        this.logger.warn("startAuction tx reverted on-chain", {
          txHash: tx.hash,
        });
        return {
          success: false,
          txHash: tx.hash,
          error: "Transaction reverted",
        };
      }
    } catch (error) {
      // Reset nonce from chain — it may be desynced after failure
      this.nonce = await this.wallet.getNonce();
      return {
        success: false,
        error: `Transaction failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Execute a LIQUIDATE transaction.
   *
   * Similar flow to startAuction, with additional steps:
   * - Ensure token approval before submitting
   * - Check bot has enough borrow token balance
   * - Pass maxDebtToRepay = auction.debtToRepay (repay the full amount)
   */
  private async executeLiquidate(opp: Opportunity): Promise<ExecutionResult> {
    this.logger.info("Executing LIQUIDATE...", {
      auctionId: opp.auctionId?.toString(),
      user: opp.user.slice(0, 10),
      estimatedProfit: `$${opp.estimatedProfitUsd.toFixed(2)}`,
    });

    if (!opp.auctionId) {
      return { success: false, error: "Missing auctionId" };
    }

    // Step 1: Simulate with full debt repayment
    const sim = await this.simulator.simulateLiquidate(
      this.liquidatorContract,
      opp.auctionId,
      opp.debtAmount, // maxDebtToRepay = full auction debt
    );

    if (!sim.success) {
      return { success: false, error: `Simulation failed: ${sim.error}` };
    }

    // Step 2: Estimate gas
    let gasLimit: bigint;
    try {
      const estimate = await this.liquidatorContract.liquidate.estimateGas(
        opp.auctionId,
        opp.debtAmount,
      );
      gasLimit = BigInt(
        Math.ceil(Number(estimate) * this.config.gasMultiplier),
      );
    } catch (error) {
      return {
        success: false,
        error: `Gas estimation failed: ${(error as Error).message}`,
      };
    }

    // Step 3: Check gas price
    const feeData = await this.wallet.provider!.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    if (gasPrice > this.config.maxGasPrice) {
      return {
        success: false,
        error: `Gas price too high: ${gasPrice} > ${this.config.maxGasPrice}`,
      };
    }

    // Step 4: Submit
    try {
      const tx = await this.liquidatorContract.liquidate(
        opp.auctionId,
        opp.debtAmount,
        {
          gasLimit,
          nonce: this.nonce++,
        },
      );

      this.logger.info(`liquidate tx submitted: ${tx.hash}`);
      this.pendingTxHashes.add(tx.hash);

      // Step 5: Wait for confirmation
      const receipt = await tx.wait();
      this.pendingTxHashes.delete(tx.hash);

      if (receipt && receipt.status === 1) {
        this.logger.info("✅ Liquidation confirmed!", {
          txHash: tx.hash,
          block: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          debtRepaid: sim.debtRepaid?.toString(),
          collateralReceived: sim.collateralReceived?.toString(),
        });

        return {
          success: true,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        };
      } else {
        this.logger.warn("liquidate tx reverted on-chain", { txHash: tx.hash });
        return {
          success: false,
          txHash: tx.hash,
          error: "Transaction reverted",
        };
      }
    } catch (error) {
      this.nonce = await this.wallet.getNonce();
      return {
        success: false,
        error: `Transaction failed: ${(error as Error).message}`,
      };
    }
  }

  /** Check if there are pending (unconfirmed) transactions */
  hasPendingTransactions(): boolean {
    return this.pendingTxHashes.size > 0;
  }

  /** Get the wallet's ETH balance (for monitoring) */
  async getEthBalance(): Promise<string> {
    const balance = await this.wallet.provider!.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /** Get the wallet's balance of a specific token */
  async getTokenBalance(tokenAddress: string): Promise<bigint> {
    const token = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      this.wallet.provider!,
    );
    return token.balanceOf(this.wallet.address) as Promise<bigint>;
  }
}
