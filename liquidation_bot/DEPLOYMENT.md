# Deployment Guide

This guide walks you through deploying the ISM Protocol Liquidation Bot from scratch to production-ready operation.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Configuration](#environment-configuration)
- [Testing Procedure](#testing-procedure)
- [Security Checklist](#security-checklist)
- [Initial Deployment](#initial-deployment)
- [Validation](#validation)
- [Post-Deployment](#post-deployment)

---

## Prerequisites

### System Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Operating System**: Linux, macOS, or Windows (WSL recommended)
- **Memory**: Minimum 512MB RAM (1GB recommended)
- **Disk**: 100MB free space
- **Network**: Stable internet connection with <100ms latency to RPC provider

### External Dependencies

1. **RPC Provider** (choose one):
   - [Alchemy](https://www.alchemy.com/) (Recommended - 300M CU/month free)
   - [QuickNode](https://www.quicknode.com/) (Recommended - great WebSocket support)
   - [Infura](https://www.infura.io/) (Alternative)
   - Public Base RPC (Not recommended for production - rate limited)

2. **Wallet**:
   - Funded wallet with Base Sepolia ETH (testnet) or Base ETH (mainnet)
   - **IMPORTANT**: Use a dedicated bot wallet, NOT your personal wallet

3. **Deployed Contracts**:
   - ISM Protocol contracts deployed on target network
   - Contract addresses available in `deployments/{chainId}.json`

---

## Pre-Deployment Checklist

### 1. Contract Deployment Verification

Ensure all contracts are deployed and verified:

```bash
# From the contracts/ directory
cd ../contracts
forge script script/DeployCore.s.sol --rpc-url base-sepolia --verify
```

Check that `deployments/84532.json` (Base Sepolia) or `deployments/8453.json` (Base mainnet) exists with:
- `marketRegistry`
- `oracleRouter`
- `dutchAuctionLiquidator`
- At least one market in `markets` array

### 2. Wallet Preparation

**Create a dedicated bot wallet:**

```bash
# Generate new wallet (store securely!)
cast wallet new

# Or import existing wallet
cast wallet import bot-wallet --private-key <YOUR_KEY>
```

**Fund the wallet:**

**Base Sepolia (Testnet):**
- Get ETH from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
- Minimum: 0.01 ETH for testing
- Recommended: 0.1 ETH for extended testing

**Base Mainnet (Production):**
- Fund with real ETH (estimate: 0.01-0.05 ETH for 1 week of operations)
- Consider using a multisig wallet for mainnet (Gnosis Safe)

**Fund with borrow tokens** (for executing liquidations):
- Testnet: Get USDC/DAI from faucets or swap
- Mainnet: Bridge/swap for required tokens
- Amount: Depends on expected liquidation sizes (start with $100-500 equivalent)

### 3. RPC Provider Setup

**Get API keys:**

1. **Alchemy** (recommended):
   ```
   1. Go to https://dashboard.alchemy.com/
   2. Create new app → Base Sepolia or Base
   3. Copy HTTP RPC URL
   4. Copy WebSocket URL
   ```

2. **QuickNode**:
   ```
   1. Go to https://dashboard.quicknode.com/
   2. Create endpoint → Base Sepolia or Base
   3. Copy HTTP RPC URL
   4. Copy WebSocket URL
   ```

**Test RPC connectivity:**

```bash
# Test HTTP endpoint
curl -X POST <RPC_URL> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Should return: {"jsonrpc":"2.0","id":1,"result":"0x..."}
```

### 4. Dependencies Installation

```bash
cd liquidation_bot
npm install
```

Verify installation:
```bash
npm run build
# Should compile without errors
```

---

## Environment Configuration

### 1. Create .env File

```bash
cp .env.example .env
```

### 2. Configure Network Settings

```bash
# .env
# ============================================
# NETWORK
# ============================================
RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
WS_URL=wss://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
CHAIN_ID=84532  # 84532 = Base Sepolia, 8453 = Base Mainnet
```

**Important Notes:**
- RPC_URL: HTTP/HTTPS endpoint for read calls and transaction submission
- WS_URL: WebSocket endpoint for real-time event subscriptions
- Both URLs must point to the same network
- **Do not use public RPCs in production** (rate limits will cause issues)

### 3. Configure Wallet

```bash
# ============================================
# WALLET (NEVER COMMIT THIS FILE TO GIT!)
# ============================================
PRIVATE_KEY=your_private_key_without_0x_prefix
```

**Security:**
- Remove `0x` prefix from private key
- Ensure `.env` is in `.gitignore`
- Use environment variables in production (not `.env` file)
- Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)

### 4. Configure Contract Addresses

**Option A: Use deployment file (recommended)**

If `deployments/{chainId}.json` exists, the bot will auto-load addresses. Leave these blank:

```bash
# ============================================
# CONTRACT ADDRESSES (auto-loaded from deployments/)
# ============================================
MARKET_REGISTRY_ADDRESS=
ORACLE_ROUTER_ADDRESS=
LIQUIDATOR_ADDRESS=
```

**Option B: Manual configuration**

If deployment file is missing or you want to override:

```bash
MARKET_REGISTRY_ADDRESS=0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4
ORACLE_ROUTER_ADDRESS=0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97
LIQUIDATOR_ADDRESS=0x7514D0B0883cfCb2f7Cc5AeB512D9c5ab91160E2
```

**Verification:**

```bash
# Check if addresses are valid checksummed addresses
cast to-check-sum-address <ADDRESS>

# Check if contract exists
cast code <ADDRESS> --rpc-url $RPC_URL
# Should return non-empty bytecode (0x...)
```

### 5. Configure Bot Parameters

```bash
# ============================================
# BOT PARAMETERS
# ============================================

# Minimum profit in USD to execute liquidation (prevents spam for tiny profits)
MIN_PROFIT_USD=0.001              # Testnet: 0.001, Mainnet: 5-10

# Maximum gas price in wei (50 gwei = 50000000000)
MAX_GAS_PRICE=50000000000         # Testnet: 50 gwei, Mainnet: adjust based on network

# Gas estimate multiplier for safety (1.2 = 20% buffer)
GAS_MULTIPLIER=1.2                # 1.2 recommended

# Polling interval in milliseconds (how often to check for opportunities)
POLLING_INTERVAL_MS=2000          # Testnet: 2000 (2s), Mainnet: 1000-3000 (1-3s)

# Health factor threshold to start tracking positions (1.1e18 = 1.1)
HF_THRESHOLD=1100000000000000000  # 1.1 (positions below this are monitored closely)

# How many blocks back to scan on startup
HISTORICAL_BLOCK_RANGE=10000      # Testnet: 10000, Mainnet: 5000-20000

# Log level (debug, info, warn, error)
LOG_LEVEL=info                    # info for production, debug for troubleshooting
```

**Parameter Tuning:**

| Parameter | Testnet | Mainnet | Notes |
|-----------|---------|---------|-------|
| MIN_PROFIT_USD | 0.001 | 5-10 | Lower on testnet for testing |
| MAX_GAS_PRICE | 50 gwei | 20-50 gwei | Adjust based on Base gas prices |
| POLLING_INTERVAL_MS | 2000 | 1000-3000 | Faster = more RPC calls = higher cost |
| HISTORICAL_BLOCK_RANGE | 10000 | 5000-20000 | Larger = longer startup time |
| LOG_LEVEL | debug | info | debug for troubleshooting only |

### 6. Validate Configuration

**Run validation script:**

```bash
npm run check-positions
```

This will:
- ✓ Verify RPC connection
- ✓ Check wallet balance
- ✓ Validate contract addresses
- ✓ Discover markets
- ✓ Fetch oracle prices

**Expected output:**

```
🔍 Checking positions and bot state...

📋 Configuration:
  Network: Base Sepolia (Chain ID: 84532)
  RPC: https://base-sepolia.g.alchemy.com/v2/...
  ✓ RPC connection successful

💰 Bot Wallet:
  Address: 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38
  ETH: 0.5 ✓
  WETH: 0.05
  USDC: 50.0

🏪 Markets:
  Found 2 markets in registry ✓
```

**If validation fails**, check:
- RPC URL is correct and accessible
- Private key is valid (40 hex characters)
- Contract addresses are correct
- Wallet is funded with ETH

---

## Testing Procedure

### Phase 1: Unit Tests

```bash
npm test
```

**Expected result:**
```
✓ test/healthFactor.test.ts (12 tests)
✓ test/auctionStore.test.ts (14 tests)
✓ test/positionStore.test.ts (21 tests)
✓ test/calculator.test.ts (23 tests)

Test Files: 4 passed (4)
Tests: 70 passed (70)
```

All tests must pass before proceeding.

### Phase 2: Testnet Dry Run (No Transactions)

```bash
npm run dev
```

**Monitor for:**
- ✓ Successful startup (no errors)
- ✓ Market discovery (finds at least 1 market)
- ✓ Event indexing completes (positions loaded)
- ✓ Monitoring loop runs (checks prices and HFs)
- ✓ No RPC errors or timeouts

**Let it run for 5-10 minutes**, then stop with `Ctrl+C`.

**Check logs for:**
- "Bot running. Monitoring positions..." (healthy)
- "Indexed X positions" (state built correctly)
- "Found X opportunities" (detection working, even if 0)

### Phase 3: Create Test Scenario

```bash
npm run setup-testnet
```

This creates a position near liquidation. Monitor the bot's response:

```bash
npm run dev
```

**What to watch for:**
- Bot detects the new position after next cycle
- Health factor is calculated correctly
- If HF < 1.0, bot attempts to start auction
- Transaction simulation succeeds
- Transaction is submitted (if profitable and gas OK)

**Stop the bot after confirming detection works.**

### Phase 4: Full Liquidation Cycle Test

1. **Create underwater position** (HF < 1.0):
   - Use `setup-testnet.ts` and modify to borrow more
   - Or wait for interest to accrue
   - Or manually manipulate test oracle (if you control it)

2. **Run bot and observe full cycle**:
   ```bash
   npm run dev
   ```

3. **Expected flow**:
   ```
   [Cycle 1] Detected liquidatable position (HF < 1.0)
   [Cycle 1] Starting auction...
   [Cycle 1] ✓ Auction started (txHash: 0x...)

   [Cycle 2-10] Auction in progress, price decaying...

   [Cycle 11] Auction price profitable!
   [Cycle 11] Executing liquidation...
   [Cycle 11] ✓ Liquidation successful (profit: $X)
   ```

4. **Verify on block explorer**:
   - Check transaction succeeded
   - Verify collateral was transferred to bot
   - Check bot's borrow token balance decreased (debt paid)

### Phase 5: Stress Test (Optional)

**Create multiple positions** and run bot for 1-2 hours:

```bash
# Create 5-10 test positions
for i in {1..5}; do
  npm run setup-testnet
  sleep 10
done

# Run bot
npm run dev
```

**Monitor for:**
- ✓ No memory leaks (check with `htop` or Activity Monitor)
- ✓ RPC rate limits not exceeded
- ✓ Nonce management works correctly
- ✓ No stuck transactions

**Check stats:**
```bash
npm run check-positions
```

---

## Security Checklist

### Before Deployment

- [ ] **Private key security**:
  - [ ] Never commit `.env` to git
  - [ ] Use environment variables in production
  - [ ] Consider using a secrets manager (AWS, Vault)
  - [ ] Wallet is dedicated to bot only (not personal funds)

- [ ] **Network configuration**:
  - [ ] Using paid RPC provider (not public)
  - [ ] WebSocket URL matches HTTP URL network
  - [ ] Firewall allows outbound connections on ports 443 (HTTPS) and 443 (WSS)

- [ ] **Contract verification**:
  - [ ] All contract addresses verified on Basescan
  - [ ] Contracts match expected deployment
  - [ ] No contract upgrades since deployment (or bot updated)

- [ ] **Token approvals**:
  - [ ] Understand bot will approve Liquidator contract to spend borrow tokens
  - [ ] Only necessary approvals are granted
  - [ ] Monitor approved amounts periodically

- [ ] **Gas and profitability**:
  - [ ] `MIN_PROFIT_USD` set appropriately for network
  - [ ] `MAX_GAS_PRICE` prevents overpaying for gas
  - [ ] Bot wallet has sufficient ETH for gas (estimate: 0.01 ETH per day)

### Operational Security

- [ ] **Monitoring**:
  - [ ] Set up alerts for low ETH balance
  - [ ] Set up alerts for RPC errors
  - [ ] Monitor bot logs regularly (daily at minimum)
  - [ ] Track profitability (ensure net positive)

- [ ] **Access control**:
  - [ ] Server/VPS secured (SSH keys, not passwords)
  - [ ] Only necessary ports open (outbound HTTPS/WSS)
  - [ ] Regular OS security updates applied

- [ ] **Backup**:
  - [ ] Private key backed up securely (encrypted, offline)
  - [ ] `.env` backed up (NOT in git)
  - [ ] Runbook accessible to team

---

## Initial Deployment

### Option 1: Run Directly (Development/Testing)

**Start bot:**
```bash
npm run dev
```

**Advantages:**
- Easy to start/stop
- Logs visible in terminal
- Hot reload on code changes

**Disadvantages:**
- Stops when terminal closes
- No auto-restart on crash
- Not suitable for production

### Option 2: Run as Background Process (PM2)

**Install PM2:**
```bash
npm install -g pm2
```

**Start bot:**
```bash
pm2 start npm --name "liquidation-bot" -- start
```

**Monitor:**
```bash
pm2 logs liquidation-bot
pm2 status
```

**Advantages:**
- Auto-restart on crash
- Runs in background
- Process management built-in

**Disadvantages:**
- Slightly more complex setup

See [OPERATIONS.md](./OPERATIONS.md) for detailed PM2 configuration.

### Option 3: Run as System Service (systemd)

**Create service file** `/etc/systemd/system/liquidation-bot.service`:

```ini
[Unit]
Description=ISM Liquidation Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/liquidation_bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
EnvironmentFile=/path/to/.env

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable liquidation-bot
sudo systemctl start liquidation-bot
sudo journalctl -u liquidation-bot -f
```

**Advantages:**
- Starts on boot
- System-level process management
- Integrated with OS logging

**Disadvantages:**
- Requires root access
- More complex setup

See [PRODUCTION.md](./PRODUCTION.md) for detailed systemd configuration.

---

## Validation

### Post-Deployment Checks

**1. Verify bot is running:**
```bash
# PM2
pm2 status

# systemd
sudo systemctl status liquidation-bot

# Docker
docker ps
```

**2. Check logs for healthy startup:**
```bash
# Look for these log lines (in order):
Bot starting...
Wallet: 0x...
RPC connected
Markets discovered: X
Historical events indexed: Y positions
WebSocket connected
Bot running. Monitoring positions...
```

**3. Monitor first cycle:**

Wait for 1-2 monitoring cycles (POLLING_INTERVAL_MS × 2) and verify:
- [ ] "Monitoring cycle X" appears in logs
- [ ] Prices updated successfully
- [ ] Positions scanned (even if 0)
- [ ] No error logs

**4. Check wallet balances:**
```bash
npm run check-positions
```

Ensure:
- [ ] ETH balance > 0.01 (for gas)
- [ ] Borrow token balance sufficient (if liquidations expected)

**5. Create test position (testnet only):**
```bash
npm run setup-testnet
```

Wait 1-2 cycles and verify bot detects the new position.

### Health Monitoring

**Set up periodic checks:**

```bash
# Add to crontab (check every hour)
0 * * * * cd /path/to/liquidation_bot && npm run check-positions > /var/log/bot-health.log 2>&1
```

**Monitor these metrics:**
- Bot uptime (should be 99.9%+)
- ETH balance (alert if < 0.005)
- Opportunities detected vs executed (success rate)
- RPC error rate (should be < 1%)
- Average cycle time (should be < POLLING_INTERVAL_MS)

---

## Post-Deployment

### First 24 Hours

**Monitor closely:**
- Check logs every 2-4 hours
- Verify no RPC rate limiting
- Ensure gas prices are reasonable
- Confirm no nonce conflicts

**Expected observations:**
- Bot may find 0 opportunities (normal if no liquidatable positions)
- Occasional RPC errors are OK (bot retries)
- Cycle times may vary (2-10 seconds typical)

### First Week

**Daily tasks:**
- Review logs for errors
- Check wallet balance
- Verify profitability (revenue > gas costs)
- Monitor competitors (are you winning auctions?)

**Tune parameters if needed:**
- Adjust `MIN_PROFIT_USD` if too conservative/aggressive
- Adjust `POLLING_INTERVAL_MS` for responsiveness vs RPC cost
- Adjust `MAX_GAS_PRICE` based on Base gas market

### Ongoing Maintenance

**Weekly:**
- [ ] Review profitability (P&L spreadsheet)
- [ ] Check for contract upgrades (re-deploy if needed)
- [ ] Update bot if new version released

**Monthly:**
- [ ] Audit wallet security (key not compromised)
- [ ] Review RPC provider costs vs benefits
- [ ] Optimize parameters based on historical data

**As Needed:**
- [ ] Restart bot after upgrades
- [ ] Add funds when balance low
- [ ] Investigate anomalies in logs

---

## Rollback Procedure

If bot misbehaves or causes issues:

**1. Stop the bot immediately:**
```bash
# PM2
pm2 stop liquidation-bot

# systemd
sudo systemctl stop liquidation-bot

# Direct run
Ctrl+C
```

**2. Check for stuck transactions:**
```bash
# View pending transactions
cast tx <TX_HASH> --rpc-url $RPC_URL

# If stuck, cancel by sending 0 ETH to self with same nonce and higher gas
```

**3. Analyze logs:**
```bash
# PM2
pm2 logs liquidation-bot --lines 1000

# systemd
sudo journalctl -u liquidation-bot -n 1000
```

**4. Fix configuration or code issue**

**5. Restart with validation:**
```bash
npm run check-positions  # Validate before starting
npm run dev             # Test run first
pm2 restart liquidation-bot  # Restart production
```

---

## Next Steps

After successful deployment:

1. **Read operational guide**: [OPERATIONS.md](./OPERATIONS.md)
2. **Set up monitoring**: [MONITORING.md](./MONITORING.md)
3. **Review production best practices**: [PRODUCTION.md](./PRODUCTION.md)
4. **Understand the architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Troubleshooting

See [README.md - Troubleshooting](./README.md#troubleshooting) for common issues and solutions.

For operational issues during runtime, see [OPERATIONS.md](./OPERATIONS.md).
