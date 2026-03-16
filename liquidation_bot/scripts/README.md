# Liquidation Bot Scripts

This directory contains utility scripts for testing and debugging the liquidation bot.

## Available Scripts

### 1. `setup-testnet.ts` - Create Test Scenarios

Creates underwater positions on Base Sepolia testnet for the bot to liquidate.

**Purpose:**
- Sets up realistic test scenarios
- Creates positions near liquidation
- Verifies the bot can detect liquidation opportunities

**Usage:**
```bash
npm run setup-testnet
```

**What it does:**
1. Supplies USDC to the lending pool (creates liquidity)
2. Deposits WETH as collateral
3. Borrows USDC against the collateral (near max LTV)
4. Checks the resulting health factor
5. Reports whether the position is liquidatable

**Requirements:**
- `.env` file with `PRIVATE_KEY` configured
- Testnet ETH for gas (get from [Base Sepolia faucet](https://www.alchemy.com/faucets/base-sepolia))
- Test WETH and USDC tokens
  - WETH: Wrap ETH using the WETH contract
  - USDC: Get from Base Sepolia faucet or swap

**Example Output:**
```
🚀 Setting up testnet scenario for liquidation bot...

📋 Configuration:
  Network: Base Sepolia (Chain ID: 84532)
  Deployer: 0x1804...1f38
  Pool: 0x2C20...A0E
  WETH: 0x4200...0006
  USDC: 0x036C...CF7e

💰 Checking balances...
  ETH: 0.5
  WETH: 1.0
  USDC: 1000.0

📊 Fetching oracle prices...
  WETH: $2000.0
  USDC: $1.0

🎯 Test scenario:
  Collateral: 0.1 WETH
  Borrow: 150 USDC
  Expected HF: ~1.06 (slightly above liquidation)

📥 Step 1: Supplying USDC to pool...
  ✓ Supplied 300 USDC

🔒 Step 2: Depositing WETH collateral...
  ✓ Deposited 0.1 WETH

💸 Step 3: Borrowing USDC...
  ✓ Borrowed 150 USDC

🏥 Step 4: Checking health factor...
  Health Factor: 1.066666666666666667

📊 Position Details:
  Collateral: 0.1 WETH
  Borrow Shares: 150.0
  Debt Amount: 150.0 USDC
  Health Factor: 1.066666666666666667

💵 USD Values:
  Collateral: $200
  Debt: $150
  Effective Collateral (80%): $160

🎯 Next Steps:
  To make this position liquidatable:
  1. Wait for interest to accrue (increases debt)
  2. Wait for WETH price to drop (decreases collateral value)
  3. Or borrow slightly more USDC to push HF below 1.0

  The liquidation bot will detect when HF < 1.0 and act.

✅ Testnet setup complete!
```

**Making Positions Underwater:**

The script creates positions that are *near* liquidation but still healthy. To make them liquidatable:

1. **Wait for interest** (passive)
   - Interest accrues every block
   - Debt grows over time → HF decreases
   - May take hours/days depending on utilization

2. **Borrow more** (active)
   ```bash
   # In Foundry console or via cast
   cast send <POOL_ADDRESS> "borrow(uint256)" <AMOUNT> --private-key <KEY>
   ```

3. **Simulate price drop** (requires mock oracle)
   - Only works if you control the oracle
   - Update price feed to lower WETH price
   - HF drops immediately

---

### 2. `check-positions.ts` - Debug Bot State

Inspects current positions, prices, and opportunities without running the bot.

**Purpose:**
- Debug what the bot sees
- Monitor position health
- Check for liquidation opportunities
- Verify oracle prices

**Usage:**
```bash
npm run check-positions
```

**What it shows:**
1. Bot wallet balances (ETH, WETH, USDC)
2. Current oracle prices
3. All markets and their positions
4. Health factors for each borrower
5. Active auctions
6. Summary statistics

**Example Output:**
```
🔍 Checking positions and bot state...

📋 Configuration:
  Network: Base Sepolia (Chain ID: 84532)
  RPC: https://sepolia.base.org
  Registry: 0xB7fC...A3f4
  Oracle: 0xD8f5...0a97
  Liquidator: 0x7514...60E2

💰 Bot Wallet:
  Address: 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38
  ETH: 0.5
  WETH: 0.05
  USDC: 50.0

📊 Blockchain State:
  Current Block: 18234567
  Scanning from: 18224567

🏪 Markets:
  Found 2 markets in registry

  Market 1: WETH/USDC - 0x2C20...A0E
  Market 2: USDC/WETH - 0xcACC...c905

💵 Oracle Prices:
  WETH: $2000.0
  USDC: $1.0

👥 Positions:
  Market: 0x2C20...A0E
  Found 3 users with activity:

    User: 0x1804...1f38
    Collateral: 0.1
    Debt: 150.0
    Health Factor: 1.066666666666666667 ⚠️  (at risk)

    User: 0x5678...5678
    Collateral: 5.0
    Debt: 7000.0
    Health Factor: 1.142857142857142857 ⚠️  (at risk)

    User: 0x9ABC...9ABC
    Collateral: 2.0
    Debt: 3300.0
    Health Factor: 0.969696969696969697 🔴 (LIQUIDATABLE)

  Total positions with debt: 3
  Liquidatable positions: 1

🔨 Active Auctions:
  Found 1 active auctions:

  Auction #1
    User: 0x9ABC...9ABC
    Pool: 0x2C20...A0E
    Progress: 25.5%
    Time remaining: 895s
    Current Price: 1037500000

📈 Summary:
  Markets: 2
  Positions: 3
  Liquidatable: 1
  Active Auctions: 1

✅ Bot has opportunities to act!
   Run: npm run dev
```

**Use Cases:**

1. **Before starting the bot:**
   ```bash
   npm run check-positions
   ```
   Verify there are liquidation opportunities

2. **Debugging why bot isn't acting:**
   - Check if positions are actually underwater
   - Verify oracle prices are correct
   - Confirm auctions haven't expired

3. **Monitoring without running the bot:**
   - Track position health over time
   - Watch for new liquidation opportunities
   - See when auctions are created

---

### 3. `extract-abis.ts` - Extract Contract ABIs

Extracts ABIs from Foundry build artifacts.

**Purpose:**
- Keep bot ABIs in sync with deployed contracts
- Auto-generate TypeScript-friendly ABI exports

**Usage:**
```bash
npm run extract-abis
```

**When to run:**
- After deploying new contracts
- After modifying contract interfaces
- Before building the bot (`prebuild` script runs this automatically)

---

## Workflow for Testing

### Initial Setup

1. **Deploy contracts** (from `contracts/` directory):
   ```bash
   cd ../contracts
   forge script script/DeployCore.s.sol --rpc-url base-sepolia --broadcast
   ```

2. **Configure bot** (in `liquidation_bot/`):
   ```bash
   cp .env.example .env
   # Edit .env with your PRIVATE_KEY and contract addresses
   ```

3. **Extract ABIs**:
   ```bash
   npm run extract-abis
   ```

### Create Test Scenario

4. **Setup testnet positions**:
   ```bash
   npm run setup-testnet
   ```

5. **Check positions**:
   ```bash
   npm run check-positions
   ```

### Run the Bot

6. **Start monitoring**:
   ```bash
   npm run dev
   ```

7. **Watch for liquidations** in the logs

### Debug Issues

If the bot isn't acting:

```bash
# 1. Check positions
npm run check-positions

# 2. Verify health factors < 1.0
# 3. Check oracle prices are reasonable
# 4. Confirm bot wallet has funds
# 5. Look at bot logs for errors
```

---

## Troubleshooting

### "Insufficient ETH for gas"

Get testnet ETH from:
- [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
- [Coinbase Wallet Faucet](https://portal.cdp.coinbase.com/products/faucet)

### "Need USDC to supply"

Options:
1. Use a Base Sepolia faucet that provides USDC
2. Swap ETH → USDC on a testnet DEX
3. Deploy your own mock USDC (from contracts repo)

### "Need WETH for collateral"

Wrap ETH to WETH:
```bash
cast send 0x4200000000000000000000000000000000000006 \
  "deposit()" \
  --value 1ether \
  --private-key <YOUR_KEY> \
  --rpc-url https://sepolia.base.org
```

### "Failed to load deployment"

1. Check `deployments/84532.json` exists
2. Verify contracts are deployed
3. Run `extract-abis` to regenerate ABIs

### Scripts fail with TypeScript errors

```bash
# Rebuild
npm run build

# Or run directly with tsx
npx tsx scripts/setup-testnet.ts
```

---

## Advanced Usage

### Custom Test Amounts

Edit `setup-testnet.ts` to adjust:
- Collateral amount (line ~90)
- Borrow amount (line ~91)
- Test with different LTV ratios

### Scan Different Block Ranges

Edit `check-positions.ts`:
```typescript
const fromBlock = Math.max(0, currentBlock - 50000); // Scan last 50k blocks
```

### Monitor Specific Users

Add filtering in `check-positions.ts`:
```typescript
const targetUsers = ['0x1234...', '0x5678...'];
if (!targetUsers.includes(user)) continue;
```

---

## Next Steps

After testing:

1. **Run full unit tests**: `npm test`
2. **Start the bot**: `npm run dev`
3. **Monitor logs**: Watch for liquidation opportunities
4. **Check profitability**: Ensure gas costs < profit

For production deployment, see the main [README.md](../README.md).
