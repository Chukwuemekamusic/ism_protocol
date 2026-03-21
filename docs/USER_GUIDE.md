# ISM Protocol - User Guide

**Welcome to ISM Protocol!** This guide will help you understand how to lend, borrow, and manage your positions on the protocol.

---

## Table of Contents

1. [What is ISM Protocol?](#what-is-ism-protocol)
2. [Getting Started on Testnet](#getting-started-on-testnet)
3. [How to Supply Assets](#how-to-supply-assets)
4. [How to Borrow](#how-to-borrow)
5. [Managing Your Position](#managing-your-position)
6. [Understanding Liquidations](#understanding-liquidations)
7. [Key Concepts Explained](#key-concepts-explained)

---

## What is ISM Protocol?

ISM Protocol is a decentralized lending protocol on Base that allows you to:
- **Supply assets** to earn interest
- **Borrow assets** using your crypto as collateral
- **Participate in liquidations** to earn rewards

### What Makes ISM Different?

**Isolated Markets**: Each lending pair (e.g., WETH/USDC) is completely separate. If one market has problems, it doesn't affect others. This means safer lending and borrowing.

**Dutch Auction Liquidations**: Instead of instant liquidations, we use a descending price auction that gives borrowers time to self-liquidate and ensures fair prices.

**Built on Base**: Low gas fees and fast transactions on Coinbase's L2 network.

---

## Getting Started on Testnet

Before using real funds, try ISM Protocol on testnet!

### Step 1: Connect to Base Sepolia

1. **Open MetaMask** (or your preferred wallet)
2. **Add Base Sepolia Network**:
   - Network Name: `Base Sepolia`
   - RPC URL: `https://sepolia.base.org`
   - Chain ID: `84532`
   - Currency Symbol: `ETH`
   - Block Explorer: `https://sepolia.basescan.org`

3. **Switch to Base Sepolia** in your wallet

### Step 2: Get Testnet ETH

You need testnet ETH for transaction fees:

1. Visit [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Enter your wallet address
3. Complete verification (if required)
4. Wait for ETH to arrive (~30 seconds)

### Step 3: Get Test Tokens

You'll need test USDC and WETH to try the protocol. See [TESTNET.md](./TESTNET.md) for token addresses and faucet links.

### Step 4: Access the App

Visit the testnet deployment: **[Insert Your Vercel URL Here]**

---

## How to Supply Assets

Supplying assets earns you interest from borrowers.

### Step-by-Step Guide

1. **Visit the Markets Page**
   - You'll see available markets (e.g., WETH/USDC, USDC/WETH)

2. **Choose a Market**
   - Click on a market to view details
   - Check the **Supply APY** (annual percentage yield)

3. **Click "Supply"**
   - Enter the amount you want to supply
   - Example: Supply 100 USDC

4. **Approve the Token** (first time only)
   - Click "Approve USDC"
   - Confirm in your wallet
   - Wait for confirmation

5. **Confirm Supply**
   - Click "Supply"
   - Confirm transaction in your wallet
   - Wait for confirmation (~2 seconds on Base)

6. **Done!**
   - You'll receive **pool tokens** representing your share
   - Your balance will grow as interest accrues
   - View your position on the Dashboard

### Understanding Pool Tokens

When you supply, you receive pool tokens (e.g., "pUSDC" for USDC market). These tokens:
- Represent your share of the pool
- Automatically increase in value as interest accrues
- Can be redeemed anytime for your supplied assets + interest

---

## How to Borrow

Borrow assets by depositing collateral. Your collateral stays safe as long as you maintain a healthy position.

### Step-by-Step Guide

1. **Supply Collateral First**
   - Go to a market where you want to use your asset as collateral
   - Example: Supply WETH to borrow USDC
   - Click "Supply" and deposit your collateral

2. **Deposit Collateral**
   - After supplying, click "Deposit Collateral"
   - Enter amount to use as collateral
   - Confirm transaction

3. **Borrow Assets**
   - Navigate to the borrow side of the market
   - You'll see your **Max Borrow Amount**
   - Enter amount (less than max for safety!)
   - Click "Borrow"
   - Confirm transaction

4. **Monitor Your Position**
   - Check your **Health Factor** on the Dashboard
   - Health Factor > 1.0 = Safe
   - Health Factor < 1.0 = Risk of liquidation

### Example Scenario

**You have**: 1 WETH (worth $2,000)

**You want**: USDC to use elsewhere

**Steps**:
1. Supply 1 WETH to WETH/USDC market
2. Deposit 1 WETH as collateral
3. Borrow up to $1,500 USDC (75% LTV)
4. Keep Health Factor above 1.25 for safety

---

## Managing Your Position

### Viewing Your Positions

1. Go to **Dashboard**
2. See all your active positions:
   - Supplied amount + interest earned
   - Collateral deposited
   - Amount borrowed
   - Health Factor

### Withdrawing Supplied Assets

1. Go to the market
2. Click "Withdraw"
3. Enter amount (up to your balance minus what's used as collateral)
4. Confirm transaction

### Repaying Debt

1. Go to the market where you borrowed
2. Click "Repay"
3. Enter amount to repay
4. Approve token (if needed)
5. Confirm transaction

### Withdrawing Collateral

You can only withdraw collateral if:
- You've repaid all debt, OR
- Withdrawing won't drop Health Factor below 1.0

1. Click "Withdraw Collateral"
2. Enter amount
3. Confirm transaction

---

## Understanding Liquidations

Liquidations happen when your borrowed amount becomes too large relative to your collateral value.

### When Are You Liquidated?

You're at risk when your **Health Factor drops below 1.0**.

**Health Factor Formula**:
```
Health Factor = (Collateral Value × Liquidation Threshold) / Debt Value
```

**Example**:
- Collateral: $2,000 worth of WETH
- Liquidation Threshold: 80%
- Debt: $1,800 USDC borrowed

Health Factor = ($2,000 × 0.80) / $1,800 = 0.89 → **LIQUIDATION RISK!**

### What Triggers Liquidation?

- **Collateral price drops**: WETH price falls → collateral worth less
- **Borrow asset price rises**: USDC becomes more expensive
- **Interest accrual**: Debt grows over time

### How Dutch Auction Works

ISM Protocol uses a **Dutch Auction** for fair liquidations:

1. **Auction Starts**: Your position enters auction when Health Factor < 1.0
2. **Price Descends**: Collateral offered at premium (105%), price drops over 20 minutes to discount (95%)
3. **Liquidator Buys**: Anyone can repay your debt and claim collateral at current price
4. **You Keep Extra**: If liquidated at 98%, you only lose 2% of collateral value

### How to Avoid Liquidation

1. **Keep Health Factor > 1.25** for safety buffer
2. **Monitor your position daily**
3. **Repay debt** if Health Factor drops
4. **Add more collateral** to increase Health Factor
5. **Set price alerts** for your collateral asset

### Self-Liquidation

If your Health Factor is dropping, you can close your position yourself:

1. **Repay all debt** (or most of it)
2. **Withdraw collateral**
3. **Avoid liquidation penalty**

This is always better than being liquidated!

---

## Key Concepts Explained

### LTV (Loan-to-Value)

**Maximum amount you can borrow** relative to your collateral.

- ISM Protocol LTV: **75%**
- If you deposit $1,000 collateral → can borrow up to $750

### Liquidation Threshold

**The point where liquidation becomes possible**.

- ISM Protocol Threshold: **80%**
- If your debt reaches 80% of collateral value → liquidation risk

### Example:
- Deposit: $1,000 WETH
- Max Borrow (75% LTV): $750 USDC ✅
- Liquidation Triggers (80% threshold): When debt value = $800

### Liquidation Penalty

**Fee charged during liquidation** to incentivize liquidators.

- ISM Protocol Penalty: **5%**
- Liquidator pays your debt, gets collateral + 5% bonus
- You lose 5% of your collateral value

### Reserve Factor

**Protocol fee** taken from interest paid by borrowers.

- ISM Protocol Reserve: **10%**
- 90% of interest goes to suppliers
- 10% goes to protocol reserves

### Interest Rate

**Cost of borrowing** changes based on utilization.

**Formula**: Kinked interest rate model
- Low utilization (0-80%): Low rates
- High utilization (80-100%): Steep rate increases
- Encourages repayment when liquidity is low

**Example**:
- 50% utilization → 4% APY
- 90% utilization → 30% APY

### Supply APY vs Borrow APY

- **Supply APY**: Interest you earn for lending
- **Borrow APY**: Interest you pay for borrowing
- Supply APY < Borrow APY (difference = protocol revenue)

### Health Factor

**Safety indicator** for your borrowed position.

**Calculation**:
```
Health Factor = (Collateral Value × Liquidation Threshold) / Debt Value
```

**Status**:
- Health Factor > 1.5: **Very Safe** ✅
- Health Factor 1.25-1.5: **Safe** ✅
- Health Factor 1.0-1.25: **Caution** ⚠️
- Health Factor < 1.0: **Liquidation** ❌

---

## Tips for Safe Lending & Borrowing

### For Suppliers (Lenders)

1. **Diversify across markets**: Don't put all funds in one market
2. **Check utilization**: High utilization = higher yield but lower liquidity
3. **Monitor APY changes**: Rates adjust based on demand
4. **Understand risks**: Smart contract risk, oracle risk, market risk

### For Borrowers

1. **Never borrow max amount**: Leave 20-30% buffer
2. **Use stable collateral**: Price volatility = liquidation risk
3. **Set alerts**: Monitor Health Factor daily
4. **Have repayment plan**: Know when/how you'll repay
5. **Understand costs**: Calculate total interest before borrowing

### For Everyone

1. **Start small on testnet**: Learn without risk
2. **Read all transaction details**: Before confirming
3. **Keep some ETH**: For gas fees when managing positions
4. **Ask questions**: Use Discord/GitHub for support

---

## Need Help?

- **FAQ**: Check [FAQ.md](./FAQ.md) for common questions
- **Technical Docs**: See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for integration details
- **Testnet Info**: See [TESTNET.md](./TESTNET.md) for addresses and faucets
- **Issues**: Report bugs on [GitHub Issues](https://github.com/Chukwuemekamusic/ism_protocol/issues)

---

**Happy Lending & Borrowing!** 🚀

Built with ❤️ on Base
