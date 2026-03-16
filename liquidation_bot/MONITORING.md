# Monitoring & Logging Guide

Comprehensive guide to monitoring the ISM Protocol Liquidation Bot, interpreting logs, and tracking key metrics.

## Table of Contents

- [Log Format](#log-format)
- [Key Metrics](#key-metrics)
- [Log Interpretation](#log-interpretation)
- [Alert Recommendations](#alert-recommendations)
- [Dashboard Setup](#dashboard-setup)
- [Performance Monitoring](#performance-monitoring)

---

## Log Format

The bot uses **Winston** for structured JSON logging.

### Log Levels

```
error > warn > info > debug
```

**Production:** Use `info` level
**Debugging:** Use `debug` level
**Silent mode:** Use `warn` or `error` only

### Log Structure

```json
{
  "timestamp": "2024-03-03T14:23:45.123Z",
  "level": "info",
  "message": "Opportunity detected",
  "type": "START_AUCTION",
  "market": "0x2C20...",
  "user": "0x1804...",
  "healthFactor": "0.95",
  "estimatedProfitUsd": 12.5
}
```

**Fields:**
- `timestamp`: ISO 8601 format
- `level`: error | warn | info | debug
- `message`: Human-readable description
- Additional context fields (varies by log type)

---

## Key Metrics

### 1. Bot Health Metrics

| Metric | How to Track | Healthy Range | Alert If |
|--------|--------------|---------------|----------|
| **Uptime** | `pm2 status` | 99.9%+ | < 99% |
| **ETH Balance** | `cast balance` | > 0.01 ETH | < 0.005 ETH |
| **Memory Usage** | `pm2 monit` | < 300MB | > 500MB |
| **CPU Usage** | `pm2 monit` | < 50% | > 80% |
| **Restart Count** | `pm2 status` | 0-1/day | > 5/day |

### 2. RPC Metrics

| Metric | How to Track | Healthy Range | Alert If |
|--------|--------------|---------------|----------|
| **RPC Errors** | Count "RPC" errors in logs | < 1% | > 5% |
| **Request Latency** | Log analysis | < 500ms | > 2s |
| **Rate Limit Hits** | Count "429" or "rate limit" | 0/hour | > 10/hour |
| **WebSocket Uptime** | Count disconnects | 99%+ | < 95% |

### 3. Opportunity Metrics

| Metric | How to Track | Target | Notes |
|--------|--------------|--------|-------|
| **Opportunities Found** | Count "Opportunity detected" logs | Varies | Depends on market conditions |
| **Liquidations Executed** | Count "Liquidation successful" | Varies | Should be > 0 if opportunities exist |
| **Success Rate** | Executed / Found | > 80% | Lower means competition or config issues |
| **Average Profit** | Sum profits / Count | > $10 | Adjust MIN_PROFIT_USD if too low |

### 4. Financial Metrics

| Metric | Calculation | Target | Notes |
|--------|-------------|--------|-------|
| **Total Profit** | Sum all liquidation profits | Positive | In USD |
| **Total Gas Costs** | Sum all tx gas costs | < 50% of profit | In USD |
| **Net Profit** | Profit - Gas - RPC | Positive | ROI metric |
| **Profit per Liquidation** | Total Profit / Count | > $10 | Efficiency metric |

---

## Log Interpretation

### Startup Logs

**Example:**
```
[info] Bot starting...
[info] Wallet: 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38
[info] RPC connected: https://base-sepolia.g.alchemy.com/v2/...
[info] Markets discovered: 2
[info] Indexing historical events from block 18224567 to 18234567...
[info] Indexed 42 positions with active borrows
[info] WebSocket connected for live events
[info] Bot running. Monitoring positions...
```

**What to check:**
- ✓ No errors during startup
- ✓ Market count matches expected
- ✓ Positions indexed (0 is OK if no activity)
- ✓ WebSocket connected

**Red flags:**
- ❌ "Failed to load deployment addresses"
- ❌ "RPC connection failed"
- ❌ "No markets found"
- ❌ "WebSocket connection failed"

### Normal Operation Logs

**Example monitoring cycle:**
```
[debug] Monitoring cycle 42
[debug] Prices updated: 4 tokens, 0 failed
[debug] Evaluating 12 positions with borrows
[debug] Health factors calculated locally (0.5ms)
[debug] Found 0 liquidatable positions
[debug] Checking 1 active auctions
[debug] Auction #3: 45% progress, price not yet profitable
[debug] Found 0 opportunities
```

**What this tells you:**
- Bot is running and responsive
- Prices are fresh (all succeeded)
- 12 positions being monitored
- Health calculations are fast
- 1 auction in progress but waiting for better price
- No immediate actions needed

### Opportunity Detection Logs

**START_AUCTION opportunity:**
```
[info] Opportunity detected {
  "type": "START_AUCTION",
  "market": "0x2C20...A0E",
  "user": "0x9ABC...9ABC",
  "healthFactor": "0.969",
  "collateral": "2.0 WETH",
  "debt": "3300 USDC",
  "estimatedProfitUsd": 0  // Starting auction doesn't earn directly
}
```

**LIQUIDATE opportunity:**
```
[info] Opportunity detected {
  "type": "LIQUIDATE",
  "auctionId": 3,
  "market": "0x2C20...A0E",
  "user": "0x9ABC...9ABC",
  "currentPrice": "1937500000",
  "estimatedProfitUsd": 12.5
}
```

**What to check:**
- Health factor < 1.0 for START_AUCTION
- Estimated profit > MIN_PROFIT_USD for LIQUIDATE
- Collateral and debt amounts seem reasonable

### Execution Logs

**Successful START_AUCTION:**
```
[info] Executing START_AUCTION for user 0x9ABC... in market 0x2C20...
[debug] Simulation successful, auctionId: 3
[debug] Gas estimate: 245000, with multiplier: 294000
[debug] Gas price: 15.2 gwei, within limit (50 gwei)
[info] Transaction submitted: 0x7f3e...
[info] ✓ Auction started successfully {
  "txHash": "0x7f3e...",
  "gasUsed": 247123,
  "blockNumber": 18234890,
  "auctionId": 3
}
```

**Successful LIQUIDATE:**
```
[info] Executing LIQUIDATE for auctionId 3
[debug] Simulation successful, debtRepaid: 3300, collateralReceived: 2.015
[debug] Gas estimate: 342000, with multiplier: 410400
[info] Transaction submitted: 0x9a2b...
[info] ✓ Liquidation successful {
  "txHash": "0x9a2b...",
  "gasUsed": 345890,
  "blockNumber": 18234950,
  "debtRepaid": "3300 USDC",
  "collateralReceived": "2.015 WETH",
  "profit": "$14.23"
}
```

**What this tells you:**
- Simulation passed (no revert)
- Gas usage as expected (~250k for start, ~350k for liquidate)
- Transaction confirmed on-chain
- Profit realized (for liquidate)

### Error Logs

**RPC Error:**
```
[error] RPC call failed {
  "method": "getLogs",
  "error": "timeout of 10000ms exceeded",
  "attempt": 1,
  "willRetry": true
}
```

**Action:** Usually transient, bot will retry. If frequent, check RPC provider status.

**WebSocket Disconnection:**
```
[warn] WebSocket connection closed {
  "code": 1006,
  "reason": "connection dropped"
}
[info] Reconnecting WebSocket in 5s...
[info] WebSocket reconnected
```

**Action:** Normal, bot handles automatically. If constant, check WS_URL or network.

**Transaction Simulation Failed:**
```
[warn] Simulation failed for START_AUCTION {
  "market": "0x2C20...",
  "user": "0x9ABC...",
  "error": "AuctionAlreadyExists"
}
```

**Action:** Expected when another bot acts first. Not an error, just missed opportunity.

**Transaction Reverted:**
```
[error] Transaction reverted {
  "type": "LIQUIDATE",
  "txHash": "0x3d5f...",
  "error": "Auction already liquidated",
  "gasUsed": 23000
}
```

**Action:** Another bot liquidated first. Paid gas but no profit. Normal in competitive environment.

**Nonce Too Low:**
```
[error] Transaction failed: nonce too low {
  "expectedNonce": 42,
  "usedNonce": 40
}
[info] Resetting nonce from chain...
[info] Nonce reset to 43
```

**Action:** Bot auto-recovers. If frequent, may have nonce conflict issue (see OPERATIONS.md).

### Warning Logs

**Low Balance:**
```
[warn] Low ETH balance {
  "address": "0x1804...",
  "balance": "0.008 ETH",
  "threshold": "0.01 ETH"
}
```

**Action:** Fund wallet soon to avoid missed opportunities.

**High Gas Price:**
```
[warn] Gas price too high: 75.5 gwei > 50 gwei max {
  "opportunity": "LIQUIDATE",
  "skipped": true
}
```

**Action:** Normal during gas spikes. Opportunity will be reconsidered when gas drops.

**Stale Price:**
```
[warn] Oracle price may be stale {
  "token": "0x4200...",
  "age": "3600 seconds"
}
```

**Action:** Check if Chainlink feed is active. Bot may skip opportunities until fresh.

---

## Alert Recommendations

### Critical Alerts (Immediate Action Required)

**Send to:** Phone, SMS, Pagerduty

1. **Bot Down**
   - Trigger: Bot not running (pm2 status shows "stopped")
   - Check: Every 5 minutes
   - Action: Restart immediately

2. **ETH Balance Critical**
   - Trigger: < 0.001 ETH
   - Check: Every 15 minutes
   - Action: Fund wallet immediately

3. **Repeated Transaction Failures**
   - Trigger: > 5 transaction failures in 10 minutes
   - Check: Log analysis
   - Action: Stop bot, investigate

4. **Wallet Compromise Detected**
   - Trigger: Unauthorized transaction from bot wallet
   - Check: Transaction monitoring
   - Action: Emergency stop, transfer funds (see OPERATIONS.md)

### High Priority Alerts (Action Within 1 Hour)

**Send to:** Email, Slack, Discord

1. **Low ETH Balance**
   - Trigger: < 0.005 ETH
   - Check: Every 30 minutes
   - Action: Fund wallet

2. **High RPC Error Rate**
   - Trigger: > 10% of requests failing
   - Check: Every 30 minutes
   - Action: Check RPC provider status, switch if needed

3. **WebSocket Disconnected for > 10 Minutes**
   - Trigger: Multiple reconnection failures
   - Check: Log monitoring
   - Action: Check network, WS_URL, restart bot

4. **Memory Usage High**
   - Trigger: > 400MB
   - Check: Every hour
   - Action: Restart bot, investigate memory leak

### Medium Priority Alerts (Action Within 24 Hours)

**Send to:** Email, Slack

1. **Low Success Rate**
   - Trigger: < 50% opportunities executed successfully
   - Check: Daily
   - Action: Review competition, optimize parameters

2. **Negative Profitability**
   - Trigger: Net profit < 0 over 24 hours
   - Check: Daily
   - Action: Review gas strategy, MIN_PROFIT_USD

3. **Contract Upgrade Detected**
   - Trigger: Deployment addresses changed
   - Check: Daily (manual or automated check)
   - Action: Update bot configuration

4. **High Restart Count**
   - Trigger: > 5 restarts in 24 hours
   - Check: Daily
   - Action: Investigate cause (crashes, OOM, etc.)

### Alert Implementation Examples

**Bash script (for cron):**
```bash
#!/bin/bash
# Check ETH balance and alert if low

BALANCE=$(cast balance $WALLET --rpc-url $RPC --ether | cut -d'.' -f1)
THRESHOLD=0.005

if (( $(echo "$BALANCE < $THRESHOLD" | bc -l) )); then
    curl -X POST $DISCORD_WEBHOOK \
      -H "Content-Type: application/json" \
      -d "{\"content\": \"🚨 Bot ETH balance low: ${BALANCE} ETH\"}"
fi
```

**Node.js script (integrated in bot):**
```typescript
import axios from 'axios';

async function sendAlert(level: 'critical' | 'high' | 'medium', message: string) {
  if (level === 'critical') {
    // Send to multiple channels
    await axios.post(DISCORD_WEBHOOK, { content: `🚨 ${message}` });
    await axios.post(SLACK_WEBHOOK, { text: message });
    // SMS via Twilio, etc.
  } else if (level === 'high') {
    await axios.post(DISCORD_WEBHOOK, { content: `⚠️ ${message}` });
  } else {
    await axios.post(DISCORD_WEBHOOK, { content: `ℹ️ ${message}` });
  }
}

// Usage:
if (ethBalance < 0.005n) {
  await sendAlert('high', `ETH balance low: ${ethers.formatEther(ethBalance)}`);
}
```

---

## Dashboard Setup

### Simple Monitoring Dashboard (Bash Script)

Create `scripts/dashboard.sh`:

```bash
#!/bin/bash

while true; do
  clear
  echo "=== ISM Liquidation Bot Dashboard ==="
  echo "Time: $(date)"
  echo ""

  # Bot Status
  echo "📊 Bot Status:"
  pm2 list | grep liquidation-bot
  echo ""

  # Wallet Balance
  echo "💰 Wallet Balance:"
  echo "  ETH: $(cast balance $WALLET --rpc-url $RPC --ether)"
  echo "  USDC: $(cast call $USDC \"balanceOf(address)(uint256)\" $WALLET --rpc-url $RPC | cast to-dec | awk '{print $1/1000000}')"
  echo ""

  # Recent Activity (last 10 log lines)
  echo "📝 Recent Logs:"
  pm2 logs liquidation-bot --lines 10 --nostream | tail -10
  echo ""

  echo "Refreshing in 10 seconds... (Ctrl+C to exit)"
  sleep 10
done
```

Run: `./scripts/dashboard.sh`

### Grafana Dashboard (Advanced)

**1. Export metrics from bot** (add to src/index.ts):

```typescript
import express from 'express';
import { register, Counter, Gauge, Histogram } from 'prom-client';

const app = express();
const port = 3000;

// Define metrics
const opportunitiesFound = new Counter({
  name: 'bot_opportunities_found_total',
  help: 'Total opportunities detected'
});

const liquidationsExecuted = new Counter({
  name: 'bot_liquidations_executed_total',
  help: 'Total liquidations executed'
});

const ethBalance = new Gauge({
  name: 'bot_eth_balance',
  help: 'Current ETH balance'
});

const cycleTime = new Histogram({
  name: 'bot_cycle_duration_seconds',
  help: 'Time taken for monitoring cycle'
});

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});

app.listen(port, () => {
  logger.info(`Metrics server listening on port ${port}`);
});

// Update metrics in main loop
opportunitiesFound.inc(opportunities.length);
if (result.success) liquidationsExecuted.inc();
ethBalance.set(Number(await provider.getBalance(wallet.address)));
```

**2. Configure Prometheus** (`prometheus.yml`):

```yaml
scrape_configs:
  - job_name: 'liquidation-bot'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
```

**3. Create Grafana dashboard** with panels:
- Bot uptime (from `up` metric)
- Opportunities found (rate)
- Liquidations executed (rate)
- Success rate (executed / found)
- ETH balance over time
- Cycle time (p50, p95, p99)

---

## Performance Monitoring

### Track Key Performance Indicators

**1. Cycle Time**

```bash
# Extract cycle times from logs
pm2 logs liquidation-bot --lines 1000 | grep "Monitoring cycle" | \
  awk '{print $NF}' | \
  awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'
```

**Target:** < POLLING_INTERVAL_MS
**Alert:** > 2x POLLING_INTERVAL_MS

**2. RPC Request Rate**

```bash
# Count RPC calls per minute
pm2 logs liquidation-bot --lines 1000 | grep "RPC" | wc -l
```

**Typical:** 10-50 calls/minute (depends on markets and config)
**Alert:** Sudden spike (> 200/minute) may indicate issue

**3. Success Rate**

```bash
# Calculate execution success rate
TOTAL=$(pm2 logs liquidation-bot --lines 10000 | grep "Executing" | wc -l)
SUCCESS=$(pm2 logs liquidation-bot --lines 10000 | grep "successful" | wc -l)
echo "Success rate: $(( SUCCESS * 100 / TOTAL ))%"
```

**Target:** > 80%
**Alert:** < 50%

**4. Profitability Tracking**

Create `scripts/calculate-profit.sh`:

```bash
#!/bin/bash

# Extract profit from logs
PROFITS=$(pm2 logs liquidation-bot --lines 10000 | grep "profit" | \
  grep -oP '\$\K[0-9.]+' | \
  awk '{sum+=$1} END {print sum}')

# Extract gas costs
GAS_COSTS=$(pm2 logs liquidation-bot --lines 10000 | grep "gasUsed" | \
  # ... calculate total gas cost in USD ...)

echo "Total Profit: \$$PROFITS"
echo "Total Gas: \$$GAS_COSTS"
echo "Net Profit: \$$((PROFITS - GAS_COSTS))"
```

---

## Log Rotation

**PM2 log rotation:**

```bash
pm2 install pm2-logrotate

pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

**Systemd log rotation:**

journald handles automatically, but you can configure:

```bash
# /etc/systemd/journald.conf
SystemMaxUse=1G
MaxRetentionSec=7day
```

---

## Troubleshooting via Logs

**Common log patterns and what they mean:**

| Log Pattern | Meaning | Action |
|-------------|---------|--------|
| "RPC.*timeout" | RPC provider slow | Check provider status |
| "WebSocket.*closed" | WebSocket disconnected | Normal, reconnects auto |
| "nonce too low" | Nonce conflict | Bot handles, if repeats see OPERATIONS.md |
| "Simulation failed" | Tx would revert | Expected, opportunity no longer valid |
| "Gas price too high" | Gas exceeds MAX | Wait or increase MAX_GAS_PRICE |
| "Insufficient funds" | Low ETH balance | Fund wallet |
| "Missing price data" | Oracle issue | Check Chainlink feeds |
| "Auction already liquidated" | Lost competition | Normal, optimize if frequent |

---

**Next Steps:**
- Set up operations procedures: [OPERATIONS.md](./OPERATIONS.md)
- Understand architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Prepare for production: [PRODUCTION.md](./PRODUCTION.md)
