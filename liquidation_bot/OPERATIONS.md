# Operations Runbook

This guide provides operational procedures for running and maintaining the ISM Protocol Liquidation Bot.

## Table of Contents

- [Starting the Bot](#starting-the-bot)
- [Stopping the Bot](#stopping-the-bot)
- [Health Checks](#health-checks)
- [Common Operational Scenarios](#common-operational-scenarios)
- [Performance Tuning](#performance-tuning)
- [Emergency Procedures](#emergency-procedures)
- [Routine Maintenance](#routine-maintenance)

---

## Starting the Bot

### Development Mode (Hot Reload)

**Use for:** Local development, testing, debugging

```bash
npm run dev
```

**Features:**
- Auto-reloads on code changes
- Logs to console with colors
- Easy to stop (Ctrl+C)

**Limitations:**
- Stops when terminal closes
- Not suitable for production
- No auto-restart on crash

---

### Production Mode: PM2 (Recommended)

**Use for:** Production deployment, long-running operation

#### Initial Setup

```bash
# Install PM2 globally
npm install -g pm2

# Build the bot
npm run build
```

#### Start Bot

```bash
# Start with PM2
pm2 start npm --name "liquidation-bot" -- start

# Or use ecosystem config (see below)
pm2 start ecosystem.config.js
```

#### PM2 Ecosystem Config

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'liquidation-bot',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/liquidation_bot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
  }]
};
```

Start with config:
```bash
pm2 start ecosystem.config.js
```

#### PM2 Commands

```bash
# View status
pm2 status

# View logs (real-time)
pm2 logs liquidation-bot

# View logs (last 100 lines)
pm2 logs liquidation-bot --lines 100

# Restart bot
pm2 restart liquidation-bot

# Stop bot
pm2 stop liquidation-bot

# Delete from PM2
pm2 delete liquidation-bot

# Save PM2 config (persist across reboots)
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it prints
```

#### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web dashboard (port 9615)
pm2 install pm2-server-monit
```

---

### Production Mode: systemd (Linux)

**Use for:** System-level process management, auto-start on boot

#### Create Service File

```bash
sudo nano /etc/systemd/system/liquidation-bot.service
```

**Service file content:**

```ini
[Unit]
Description=ISM Protocol Liquidation Bot
Documentation=https://github.com/your-org/ism_protocol
After=network.target

[Service]
Type=simple
User=your-username
Group=your-username
WorkingDirectory=/path/to/liquidation_bot
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/liquidation_bot/.env
ExecStart=/usr/bin/node /path/to/liquidation_bot/dist/index.js
Restart=always
RestartSec=10s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=liquidation-bot

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/path/to/liquidation_bot/logs

[Install]
WantedBy=multi-user.target
```

#### systemd Commands

```bash
# Reload systemd after creating/editing service file
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable liquidation-bot

# Start service
sudo systemctl start liquidation-bot

# Check status
sudo systemctl status liquidation-bot

# View logs (real-time)
sudo journalctl -u liquidation-bot -f

# View logs (last 100 lines)
sudo journalctl -u liquidation-bot -n 100

# Restart service
sudo systemctl restart liquidation-bot

# Stop service
sudo systemctl stop liquidation-bot

# Disable auto-start
sudo systemctl disable liquidation-bot
```

---

### Production Mode: Docker (Optional)

**Use for:** Containerized deployment, easy migration between environments

#### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

# Install security updates
RUN apk update && apk upgrade

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose monitoring port (if added)
EXPOSE 3000

# Start bot
CMD ["npm", "start"]
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  liquidation-bot:
    build: .
    container_name: liquidation-bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    networks:
      - bot-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  bot-network:
    driver: bridge
```

#### Docker Commands

```bash
# Build image
docker-compose build

# Start container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop container
docker-compose down

# Restart container
docker-compose restart

# View status
docker-compose ps
```

---

## Stopping the Bot

### Graceful Shutdown

The bot handles `SIGINT` and `SIGTERM` signals gracefully:

1. **Development mode:**
   ```bash
   Ctrl+C
   ```
   Bot will:
   - Unsubscribe from WebSocket events
   - Save state (if applicable)
   - Exit cleanly

2. **PM2:**
   ```bash
   pm2 stop liquidation-bot
   ```

3. **systemd:**
   ```bash
   sudo systemctl stop liquidation-bot
   ```

4. **Docker:**
   ```bash
   docker-compose down
   ```

### Emergency Stop

If bot is unresponsive:

```bash
# Find process ID
ps aux | grep "node.*index.js"

# Kill process
kill -9 <PID>
```

**Note:** Emergency stop may leave transactions pending. Check with:
```bash
# View wallet's pending transactions
cast nonce <WALLET_ADDRESS> --rpc-url $RPC_URL
```

---

## Health Checks

### Quick Health Check

```bash
npm run check-positions
```

**Expected output:**
```
✓ RPC connection successful
✓ Wallet funded (ETH > 0.01)
✓ Markets discovered
✓ Oracle prices available
✓ Bot wallet balances OK
```

### Detailed Health Check

**1. Check bot is running:**

```bash
# PM2
pm2 status | grep liquidation-bot
# Should show: online

# systemd
sudo systemctl is-active liquidation-bot
# Should show: active

# Docker
docker ps | grep liquidation-bot
# Should show: Up X minutes
```

**2. Check recent logs:**

```bash
# PM2
pm2 logs liquidation-bot --lines 50

# systemd
sudo journalctl -u liquidation-bot -n 50

# Docker
docker-compose logs --tail 50
```

**Look for:**
- ✓ No error logs in last 10 minutes
- ✓ "Monitoring cycle" messages appearing regularly
- ✓ Prices updated successfully
- ✓ No WebSocket disconnections

**3. Check wallet balance:**

```bash
# ETH balance
cast balance <WALLET_ADDRESS> --rpc-url $RPC_URL --ether

# Should be > 0.01 ETH
```

**4. Check RPC connectivity:**

```bash
# Test RPC
curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Should return block number (not error)
```

**5. Check for pending transactions:**

```bash
# Get nonce from chain
cast nonce <WALLET_ADDRESS> --rpc-url $RPC_URL

# Compare with bot's internal nonce (check logs)
# If different, bot may have stuck transaction
```

### Automated Health Check Script

Create `scripts/health-check.sh`:

```bash
#!/bin/bash

echo "=== Liquidation Bot Health Check ==="

# Check if bot is running
if pm2 list | grep -q "liquidation-bot.*online"; then
    echo "✓ Bot is running"
else
    echo "✗ Bot is NOT running"
    exit 1
fi

# Check ETH balance
BALANCE=$(cast balance $WALLET_ADDRESS --rpc-url $RPC_URL --ether | cut -d'.' -f1)
if [ "$BALANCE" -gt 0 ]; then
    echo "✓ Wallet funded ($BALANCE ETH)"
else
    echo "✗ Wallet balance low ($BALANCE ETH)"
    exit 1
fi

# Check for recent errors in logs
ERRORS=$(pm2 logs liquidation-bot --lines 100 --nostream | grep -i "error" | wc -l)
if [ "$ERRORS" -lt 5 ]; then
    echo "✓ No critical errors ($ERRORS errors in last 100 lines)"
else
    echo "⚠ High error rate ($ERRORS errors in last 100 lines)"
fi

echo "=== Health check complete ==="
```

Run periodically via cron:
```bash
# Add to crontab (every 15 minutes)
*/15 * * * * /path/to/scripts/health-check.sh >> /var/log/bot-health.log 2>&1
```

---

## Common Operational Scenarios

### Scenario 1: RPC Rate Limit Exceeded

**Symptoms:**
- Logs show: "Rate limit exceeded" or "429 Too Many Requests"
- Bot slows down or stops responding
- Opportunities missed

**Solution:**

1. **Immediate:** Reduce polling frequency
   ```bash
   # Edit .env
   POLLING_INTERVAL_MS=5000  # Increase from 2000 to 5000
   ```

2. **Restart bot:**
   ```bash
   pm2 restart liquidation-bot
   ```

3. **Long-term:** Upgrade RPC plan or switch provider

4. **Monitor RPC usage:**
   - Alchemy: https://dashboard.alchemy.com/
   - QuickNode: https://dashboard.quicknode.com/

---

### Scenario 2: WebSocket Disconnection

**Symptoms:**
- Logs show: "WebSocket connection closed"
- Bot continues running but misses new events
- Position state becomes stale

**Solution:**

1. **Check WebSocket URL:**
   ```bash
   # Ensure WS_URL is set correctly
   echo $WS_URL
   ```

2. **Restart bot (reconnects automatically):**
   ```bash
   pm2 restart liquidation-bot
   ```

3. **If persists:** Switch to HTTP-only mode (less efficient):
   - Comment out WebSocket subscription in code
   - Rely on historical event scanning only

---

### Scenario 3: Nonce Conflict (Transaction Stuck)

**Symptoms:**
- Logs show: "Nonce too low" or "Transaction underpriced"
- Bot can't submit new transactions
- Opportunities missed

**Solution:**

1. **Check current nonce:**
   ```bash
   cast nonce <WALLET_ADDRESS> --rpc-url $RPC_URL
   ```

2. **Cancel stuck transaction:**
   ```bash
   # Send 0 ETH to self with same nonce but higher gas
   cast send <WALLET_ADDRESS> \
     --value 0 \
     --nonce <STUCK_NONCE> \
     --gas-price 50gwei \
     --private-key $PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

3. **Restart bot** (resets nonce tracking):
   ```bash
   pm2 restart liquidation-bot
   ```

---

### Scenario 4: Low ETH Balance

**Symptoms:**
- Logs show: "Insufficient funds for gas"
- Bot can't submit transactions
- Opportunities missed

**Solution:**

1. **Check balance:**
   ```bash
   cast balance <WALLET_ADDRESS> --rpc-url $RPC_URL --ether
   ```

2. **Fund wallet immediately:**
   ```bash
   # From another wallet
   cast send <BOT_WALLET> --value 0.05ether --private-key <FUNDING_KEY> --rpc-url $RPC_URL
   ```

3. **Set up balance alerts** (see Monitoring section)

4. **Resume bot** (will retry automatically)

---

### Scenario 5: Oracle Price Stale/Failed

**Symptoms:**
- Logs show: "Failed to fetch price" or "Missing price data"
- Bot can't calculate profitability
- No liquidations executed

**Solution:**

1. **Check oracle manually:**
   ```bash
   cast call $ORACLE_ROUTER_ADDRESS "getPrice(address)(uint256)" $WETH_ADDRESS --rpc-url $RPC_URL
   ```

2. **If oracle is working:**
   - RPC provider may be blocking oracle calls
   - Try different RPC provider

3. **If oracle is broken:**
   - Check if Chainlink feed is active
   - Check if TWAP fallback is working
   - Contact protocol team

4. **Temporary workaround:**
   - Wait for oracle to recover
   - Bot will resume automatically when prices available

---

### Scenario 6: Gas Price Spike

**Symptoms:**
- Logs show: "Gas price too high: X gwei > Y gwei max"
- Bot skips opportunities
- No liquidations executed

**Solution:**

1. **Check current Base gas price:**
   ```bash
   cast gas-price --rpc-url $RPC_URL
   ```

2. **If spike is temporary (< 1 hour):**
   - Wait for gas to normalize
   - Bot will execute when gas drops

3. **If spike is sustained:**
   - Increase `MAX_GAS_PRICE` in `.env`:
     ```bash
     MAX_GAS_PRICE=100000000000  # 100 gwei
     ```
   - Restart bot:
     ```bash
     pm2 restart liquidation-bot
     ```

4. **Monitor profitability:**
   - Ensure higher gas doesn't eat into profits
   - Adjust `MIN_PROFIT_USD` accordingly

---

### Scenario 7: Auction Competition (Losing to Other Bots)

**Symptoms:**
- Logs show: "Transaction reverted: Auction already liquidated"
- Bot starts auctions but other bots liquidate first
- Profitability low or negative

**Solution:**

1. **Reduce polling interval (faster detection):**
   ```bash
   POLLING_INTERVAL_MS=1000  # 1 second
   ```

2. **Optimize gas strategy:**
   - Increase `GAS_MULTIPLIER` to 1.3-1.5 (faster inclusion)
   - Increase `MAX_GAS_PRICE` slightly

3. **Consider flashbots/private RPC:**
   - MEV protection services
   - Direct submission to block builders

4. **Adjust profit threshold:**
   - Lower `MIN_PROFIT_USD` to compete on smaller opportunities
   - Balance risk vs reward

---

### Scenario 8: Memory Leak

**Symptoms:**
- Bot memory usage grows over time (check with `htop`)
- Performance degrades
- Eventually crashes with OOM error

**Solution:**

1. **Immediate:** Restart bot
   ```bash
   pm2 restart liquidation-bot
   ```

2. **Set memory limit in PM2:**
   ```javascript
   // ecosystem.config.js
   max_memory_restart: '500M'  // Auto-restart if exceeds 500MB
   ```

3. **Enable position pruning** (already implemented):
   - Bot auto-prunes zero-balance positions every 100 cycles
   - Check logs for "Pruned X empty positions"

4. **If persists:**
   - Report issue to development team
   - Temporary: Schedule daily restart via cron

---

## Performance Tuning

### Optimize for Speed (Competitive Environment)

**Goal:** Detect and execute liquidations as fast as possible

```bash
# .env tuning
POLLING_INTERVAL_MS=1000        # Check every 1 second
HISTORICAL_BLOCK_RANGE=5000     # Faster startup
MIN_PROFIT_USD=0.1              # Compete on smaller opportunities
MAX_GAS_PRICE=100000000000      # Willing to pay higher gas
GAS_MULTIPLIER=1.3              # Faster transaction inclusion
LOG_LEVEL=warn                  # Less logging overhead
```

**Trade-offs:**
- Higher RPC costs (more frequent calls)
- Higher gas costs
- More aggressive on opportunities
- May execute unprofitable liquidations in extreme cases

---

### Optimize for Cost (Solo Operator)

**Goal:** Minimize operational costs while still catching opportunities

```bash
# .env tuning
POLLING_INTERVAL_MS=3000        # Check every 3 seconds
HISTORICAL_BLOCK_RANGE=10000    # Full historical coverage
MIN_PROFIT_USD=10               # Only execute highly profitable
MAX_GAS_PRICE=30000000000       # Cap gas at 30 gwei
GAS_MULTIPLIER=1.2              # Standard buffer
LOG_LEVEL=info                  # Balanced logging
```

**Trade-offs:**
- May miss some opportunities (other bots faster)
- Lower RPC costs
- Lower gas costs
- Higher profit per liquidation

---

### Optimize for Coverage (Multiple Markets)

**Goal:** Monitor many markets efficiently

```bash
# .env tuning
POLLING_INTERVAL_MS=2000        # Balanced frequency
HISTORICAL_BLOCK_RANGE=10000    # Full coverage
MIN_PROFIT_USD=5                # Reasonable threshold
HF_THRESHOLD=1150000000000000000  # Monitor positions at 1.15 HF
LOG_LEVEL=info
```

**Additional:**
- Use WebSocket subscriptions (already enabled)
- Ensure sufficient RPC rate limits for multiple markets
- Monitor memory usage as position count grows

---

## Emergency Procedures

### Emergency Stop (Critical Issue)

**When to use:**
- Bot is behaving erratically
- Executing unprofitable liquidations
- RPC provider completely down
- Security incident detected

**Procedure:**

1. **Stop bot immediately:**
   ```bash
   pm2 stop liquidation-bot
   # Or
   sudo systemctl stop liquidation-bot
   ```

2. **Check for pending transactions:**
   ```bash
   # List recent transactions
   cast tx --from <WALLET_ADDRESS> --rpc-url $RPC_URL

   # Cancel pending if needed (see Nonce Conflict section)
   ```

3. **Secure wallet:**
   - Change `.env` PRIVATE_KEY to a safe key (empty wallet)
   - Move funds from bot wallet if compromise suspected

4. **Analyze issue:**
   ```bash
   # Review last 500 log lines
   pm2 logs liquidation-bot --lines 500 > emergency-logs.txt
   ```

5. **Document incident:**
   - What triggered the stop?
   - What was bot doing when stopped?
   - Any losses incurred?

6. **Fix and validate:**
   - Fix configuration or code issue
   - Test thoroughly before restart
   - Use `npm run dev` for validation first

---

### Wallet Compromise Response

**If you suspect private key is compromised:**

1. **Stop bot immediately** (see above)

2. **Transfer all funds out:**
   ```bash
   # Transfer ETH
   cast send <SAFE_ADDRESS> --value $(cast balance <BOT_WALLET> --rpc-url $RPC_URL) --private-key $OLD_KEY --rpc-url $RPC_URL

   # Transfer tokens (USDC example)
   cast send $USDC_ADDRESS "transfer(address,uint256)" <SAFE_ADDRESS> $(cast call $USDC_ADDRESS "balanceOf(address)(uint256)" <BOT_WALLET> --rpc-url $RPC_URL) --private-key $OLD_KEY --rpc-url $RPC_URL
   ```

3. **Rotate keys:**
   - Generate new wallet: `cast wallet new`
   - Update `.env` with new PRIVATE_KEY
   - Fund new wallet
   - Restart bot

4. **Audit:**
   - Review transaction history for unauthorized activity
   - Determine how compromise occurred
   - Implement additional security measures

---

## Routine Maintenance

### Daily

- [ ] **Check bot status** (1 minute)
  ```bash
  pm2 status && npm run check-positions
  ```

- [ ] **Review logs for errors** (2 minutes)
  ```bash
  pm2 logs liquidation-bot --lines 100 | grep -i error
  ```

- [ ] **Check wallet balance** (1 minute)
  ```bash
  cast balance <WALLET_ADDRESS> --rpc-url $RPC_URL --ether
  ```

### Weekly

- [ ] **Review profitability** (10 minutes)
  - Calculate: Total liquidation profit - Gas costs - RPC costs
  - Ensure net positive
  - Adjust parameters if needed

- [ ] **Check for contract upgrades** (5 minutes)
  - Review protocol announcements
  - Check if contract addresses changed
  - Update deployment addresses if needed

- [ ] **Review logs for patterns** (10 minutes)
  - Are certain errors recurring?
  - Is bot missing opportunities?
  - Any performance degradation?

- [ ] **Update dependencies** (5 minutes)
  ```bash
  npm outdated
  npm update
  npm audit fix
  npm run build
  pm2 restart liquidation-bot
  ```

### Monthly

- [ ] **Security audit** (30 minutes)
  - Review wallet security (key still secure?)
  - Check server security updates
  - Review access logs

- [ ] **Performance review** (30 minutes)
  - Compare metrics month-over-month
  - Opportunities detected vs executed
  - Average profit per liquidation
  - Success rate

- [ ] **Cost analysis** (30 minutes)
  - RPC provider costs
  - Gas costs
  - Infrastructure costs (VPS, etc.)
  - Calculate ROI

- [ ] **Backup verification** (10 minutes)
  - Ensure `.env` is backed up securely
  - Test that backup can be restored

### Quarterly

- [ ] **Full security audit**
- [ ] **Performance optimization review**
- [ ] **Infrastructure review** (consider upgrades)
- [ ] **Disaster recovery test** (simulate failure, recovery)

---

## Monitoring Tools Integration

### Grafana Dashboard (Optional)

**Export metrics from bot:**

1. Add prometheus endpoint to bot (custom implementation)
2. Configure Prometheus to scrape metrics
3. Create Grafana dashboard with panels:
   - Bot uptime
   - Opportunities detected
   - Liquidations executed
   - Success rate
   - ETH balance
   - Gas costs
   - Profit/loss

### Discord/Slack Alerts (Optional)

**Send notifications on critical events:**

```javascript
// Add to src/index.ts
import axios from 'axios';

async function sendAlert(message: string) {
  await axios.post(DISCORD_WEBHOOK_URL, {
    content: `🚨 Liquidation Bot Alert: ${message}`
  });
}

// Call on critical events:
// - Low balance
// - Repeated errors
// - Successful liquidation
// - Bot startup/shutdown
```

### Log Aggregation (Optional)

**Forward logs to centralized logging:**

- **Datadog**: pm2 install pm2-datadog
- **Loggly**: Configure winston transport
- **ELK Stack**: Use filebeat to ship logs

---

## Troubleshooting Quick Reference

| Issue | Quick Fix | Full Solution |
|-------|-----------|---------------|
| Bot not starting | Check .env, RPC URL | See DEPLOYMENT.md |
| RPC rate limit | Increase POLLING_INTERVAL_MS | Upgrade RPC plan |
| WebSocket disconnect | Restart bot | Check WS_URL, network |
| Nonce conflict | Restart bot | Cancel stuck tx, see above |
| Low ETH balance | Send more ETH | Set up balance alerts |
| Oracle price fail | Wait, restart bot | Check Chainlink feed |
| High gas price | Wait or increase MAX_GAS_PRICE | Adjust parameters |
| Memory leak | Restart bot | Report bug, daily restart |
| Lost auction | Reduce POLLING_INTERVAL_MS | Optimize gas strategy |

---

## Support

For issues not covered in this runbook:

1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
2. Check [MONITORING.md](./MONITORING.md) for log interpretation
3. Check [README.md](./README.md) for troubleshooting
4. Review bot logs thoroughly
5. Contact development team

---

**Next Steps:**
- Set up monitoring: [MONITORING.md](./MONITORING.md)
- Understand architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Review production practices: [PRODUCTION.md](./PRODUCTION.md)
