# ISM Protocol - Frequently Asked Questions

Common questions about using and integrating with ISM Protocol.

---

## Table of Contents

- [General Questions](#general-questions)
- [Using the Protocol](#using-the-protocol)
- [Technical Questions](#technical-questions)
- [Troubleshooting](#troubleshooting)
- [Safety & Security](#safety--security)

---

## General Questions

### What is ISM Protocol?

ISM Protocol is a decentralized lending protocol on Base that uses **isolated markets**. Each lending pair (like WETH/USDC) operates independently, meaning problems in one market don't affect others.

### What does "Isolated Markets" mean?

Unlike pooled lending protocols (Aave, Compound), ISM creates separate markets for each collateral/borrow pair. Your WETH collateral in the WETH/USDC market can only be used to borrow USDC from that market—it cannot back loans in other markets. This prevents contagion if one asset collapses.

### What blockchain is ISM Protocol on?

ISM Protocol is deployed on **Base** (Coinbase's Layer 2) for:
- Low gas fees (~$0.01 per transaction)
- Fast confirmations (~2 seconds)
- Ethereum security

Currently live on **Base Sepolia testnet**. Mainnet launch pending security audit.

### Is ISM Protocol audited?

**Testnet**: Not yet audited (testnet funds have no real value)

**Mainnet**: Professional audit required before launch ($50K-$100K budget allocated). See [DEPLOYMENT_ROADMAP.md](../DEPLOYMENT_ROADMAP.md) for timeline.

### How does ISM compare to Aave or Compound?

| Feature | ISM Protocol | Aave/Compound |
|---------|--------------|---------------|
| Market Structure | Isolated pairs | Pooled |
| Contagion Risk | None | Medium |
| Capital Efficiency | Lower | Higher |
| Liquidations | Dutch Auction | Instant |
| Gas Costs | ~$0.01 (Base) | ~$2-10 (Ethereum) |

**Use ISM when**: You want isolated risk, MEV-resistant liquidations, or low fees on Base

**Use Aave when**: You need cross-collateral borrowing or maximum capital efficiency

---

## Using the Protocol

### How do I get started?

1. **Testnet**:
   - Get Base Sepolia ETH from [faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
   - Get test tokens (see [TESTNET.md](./TESTNET.md))
   - Visit the app (link in README.md)
   - Connect wallet and try supplying/borrowing

2. **Read the guides**:
   - [USER_GUIDE.md](./USER_GUIDE.md) - How to lend/borrow
   - [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - How to integrate

### What tokens can I use?

**Testnet (Base Sepolia)**:
- WETH (Wrapped ETH)
- USDC (test version)
- More tokens coming soon

**Mainnet** (future):
- WETH, USDC, DAI, WBTC
- Blue-chip tokens only (security first)

### Can I supply and borrow the same token?

No. ISM uses isolated pairs:
- In WETH/USDC market: Supply WETH → Borrow USDC
- In USDC/WETH market: Supply USDC → Borrow WETH

You cannot supply and borrow the same asset in one market.

### How much can I borrow?

**Maximum**: 75% of your collateral value (LTV = 75%)

**Example**:
- Deposit: 1 WETH ($2,000)
- Max Borrow: 0.75 × $2,000 = $1,500 USDC

**Recommendation**: Borrow 60-70% of max to maintain safe health factor.

### What is Health Factor?

A number indicating your position's safety:

```
Health Factor = (Collateral Value × 0.80) / Debt Value
```

- **> 1.5**: Very safe ✅
- **1.0-1.5**: Safe but monitor ⚠️
- **< 1.0**: Liquidation risk ❌

### How do liquidations work?

ISM uses **Dutch Auctions** for fair liquidations:

1. Your Health Factor drops below 1.0
2. Auction starts at 105% of fair price (premium)
3. Price descends over 20 minutes to 95% (discount)
4. First liquidator to buy gets your collateral at current price
5. You lose only the current discount (not a fixed 5%)

**Better than instant liquidations**: Gives you time to self-liquidate and reduces MEV extraction.

### Can I lose money supplying assets?

**Normal operation**: No. Suppliers earn interest and can withdraw anytime (subject to liquidity).

**Risks**:
- Smart contract bugs (audit reduces this)
- Oracle failures (dual oracle mitigates this)
- Extreme market conditions (bad debt if liquidations fail)

**Testnet**: No real money at risk!

### What fees does ISM charge?

- **Suppliers**: No fees (earn full interest minus reserve factor)
- **Borrowers**: Interest rate (varies by utilization)
- **Reserve Factor**: 10% of borrower interest goes to protocol
- **Liquidation Penalty**: 5% bonus for liquidators

**Example**:
- Borrow APY: 10%
- Protocol takes: 1% (10% of 10%)
- Suppliers earn: 9% (weighted by utilization)

---

## Technical Questions

### Where are the smart contracts?

**GitHub**: [ism_protocol/contracts/src](https://github.com/Chukwuemekamusic/ism_protocol/tree/main/contracts/src)

**Deployed Addresses**: See [TESTNET.md](./TESTNET.md) or `deployments/84532.json`

### Are the contracts upgradeable?

**No.** ISM uses the **minimal proxy pattern** (ERC-1167):
- One LendingPool implementation deployed
- Each market is a non-upgradeable proxy
- Prevents rug pulls but means no bug fixes after deployment

**For emergencies**: Pause mechanism (planned for mainnet)

### What oracle does ISM use?

**Primary**: Chainlink Price Feeds
**Fallback**: Uniswap V3 TWAP (currently disabled on testnet, will be re-enabled)

**Safety**:
- 5% deviation threshold between sources
- Staleness checks (1 hour max)
- L2 sequencer uptime verification

### How are interest rates calculated?

**Kinked rate model**:

```
Utilization = Total Borrowed / (Total Supplied + Total Borrowed)

If Utilization < 80%:
  Rate = Base + (Slope1 × Utilization)

If Utilization ≥ 80%:
  Rate = Base + (Slope1 × 80%) + (Slope2 × (Utilization - 80%))
```

**Example rates**:
- 0% utilization: 0% APY
- 50% utilization: 4% APY
- 80% utilization: 10% APY
- 95% utilization: 50% APY

High rates at high utilization encourage repayment and new supply.

### Is there a subgraph?

**Yes!** Query historical data and user positions:

**Endpoint**:
```
https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest
```

**Example queries**: See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md#subgraph-integration)

### Can I integrate ISM into my dApp?

**Absolutely!** See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for:
- Contract ABIs and addresses
- Code examples (ethers.js, wagmi)
- React hooks
- Event listening patterns
- Error handling

---

## Troubleshooting

### "Transaction failed" - Why?

Common reasons:

1. **Insufficient balance**: Don't have enough tokens
   - **Fix**: Get more tokens from faucet

2. **Insufficient gas**: Not enough ETH for fees
   - **Fix**: Get more Base Sepolia ETH

3. **WouldBeUndercollateralized**: Borrow too large
   - **Fix**: Reduce borrow amount or add collateral

4. **InsufficientLiquidity**: Pool doesn't have tokens
   - **Fix**: Try smaller amount or wait for suppliers

5. **Token not approved**: Need to approve first
   - **Fix**: Click "Approve" before "Supply" or "Borrow"

### Wallet won't connect

1. **Check network**: Switch to Base Sepolia (Chain ID: 84532)
2. **Check wallet**: MetaMask, Coinbase Wallet, or WalletConnect supported
3. **Try incognito**: Disable browser extensions that may interfere
4. **Clear cache**: Hard refresh (Ctrl+Shift+R)

### "Network error" in app

1. **Check RPC**: Base Sepolia RPC may be down
   - Try alternative: `https://base-sepolia.blockpi.network/v1/rpc/public`
2. **Check internet**: Connection stable?
3. **Check firewall**: VPN or firewall blocking?

### Markets not loading

1. **Verify contracts**: Check [TESTNET.md](./TESTNET.md) for correct addresses
2. **Check subgraph**: May be catching up to latest blocks
3. **Wait**: Give it 30 seconds to load

### My health factor dropped suddenly

**Causes**:
- **Collateral price fell**: WETH price decreased
- **Borrow asset price rose**: USDC (shouldn't happen but check)
- **Interest accrued**: Debt grew over time

**Actions**:
1. **Repay debt** to reduce debt value
2. **Add collateral** to increase collateral value
3. **Monitor closely** if Health Factor < 1.25

### I was liquidated - what happened?

If your Health Factor dropped below 1.0:

1. **Auction started**: Your position entered 20-minute Dutch auction
2. **Liquidator bought**: Someone repaid your debt and got your collateral
3. **Penalty applied**: You lost ~5% of collateral value

**Next time**:
- Set price alerts for your collateral
- Keep Health Factor > 1.25
- Repay debt before liquidation

### Subgraph data is outdated

The Graph indexer may lag 1-2 minutes behind the blockchain:

- **Wait**: Refresh after 2-3 minutes
- **Use RPC**: Read directly from contracts for real-time data
- **Check status**: Visit The Graph Studio dashboard

---

## Safety & Security

### Is my money safe?

**Testnet**: No real money - experiment freely!

**Mainnet** (future):
- ✅ Professional audit before launch
- ✅ Dual oracle system
- ✅ Multisig governance
- ✅ Pause mechanism
- ⚠️ Smart contract risk remains (no code is 100% safe)

**Recommendations**:
- Start with small amounts
- Understand the risks
- Never invest more than you can afford to lose

### What are the main risks?

1. **Smart Contract Risk**
   - Bugs in code could lead to loss of funds
   - **Mitigation**: Professional audit, extensive testing

2. **Oracle Risk**
   - Wrong prices could trigger unfair liquidations
   - **Mitigation**: Dual oracle (Chainlink + TWAP), deviation checks

3. **Liquidation Risk**
   - Collateral value drops → liquidation
   - **Mitigation**: Maintain high health factor, monitor position

4. **Market Risk**
   - Asset prices volatile
   - **Mitigation**: Use stablecoins, diversify

5. **Liquidity Risk**
   - Can't withdraw if all assets borrowed
   - **Mitigation**: Check utilization before supplying

### Has the code been audited?

**Testnet**: Not audited (acceptable for testnet)

**Mainnet**: Audit planned before launch:
- Estimated cost: $50K-$100K
- Firms considered: Trail of Bits, OpenZeppelin, Consensys
- Timeline: 4-6 weeks
- See [DEPLOYMENT_ROADMAP.md](../DEPLOYMENT_ROADMAP.md)

### Who controls the protocol?

**Testnet**: EOA (single wallet) for fast iteration

**Mainnet** (planned):
- Gnosis Safe multisig (3-of-5)
- 24-48 hour timelock on changes
- Emergency pause requires 3 signatures

### Can the team rug pull?

**Testnet**: Technically yes (single owner)

**Mainnet**:
- Multisig prevents single person control
- Timelock gives 24-48 hour warning
- Contracts non-upgradeable (can't change code)
- No admin functions to drain user funds

### What if I find a bug?

**Report immediately**:

1. **Critical bugs** (funds at risk):
   - Email: [Your security email]
   - Keep confidential until fixed

2. **Non-critical bugs**:
   - [GitHub Issues](https://github.com/Chukwuemekamusic/ism_protocol/issues)
   - Public discussion ok

**Bug bounty**: Planned for mainnet launch

---

## Still Have Questions?

- **User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)
- **Developer Guide**: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **Testnet Info**: [TESTNET.md](./TESTNET.md)
- **GitHub Issues**: [Report a problem](https://github.com/Chukwuemekamusic/ism_protocol/issues)
- **GitHub Discussions**: [Ask the community](https://github.com/Chukwuemekamusic/ism_protocol/discussions)

---

**Last Updated**: March 21, 2026

Built with ❤️ on Base
