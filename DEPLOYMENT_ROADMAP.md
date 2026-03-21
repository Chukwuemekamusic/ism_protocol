# ISM Protocol - Deployment Roadmap

**Status**: Testnet → Production Path
**Last Updated**: March 20, 2026
**Current Phase**: Ready for Frontend Deployment

---

## Executive Summary

The ISM Protocol is **ready for testnet frontend deployment** but **NOT ready for mainnet**. The smart contracts have strong test coverage (97% pass rate) and the frontend is production-grade, but critical security gaps (no audit, disabled TWAP oracle, no pause mechanism) require 11-18 weeks of hardening before handling real user funds.

**Recommended Approach**: Deploy frontend to testnet, validate product-market fit, then invest in security audits and mainnet preparation when user demand justifies it.

---

## Current Status Assessment

### ✅ What's Ready
- **Smart Contracts**: Deployed on Base Sepolia with 154 tests (97% pass)
- **Frontend**: Next.js 16 app with modern Web3 stack (wagmi v2, RainbowKit, TanStack Query)
- **Liquidation Bot**: Production-grade TypeScript bot with 5-phase architecture
- **Documentation**: Comprehensive guides (CLAUDE.md, ARCHITECTURE.md, READMEs)
- **Subgraph**: Deployed to The Graph Studio with real-time indexing

### 🔴 What's NOT Ready for Mainnet
- **No Security Audit**: Critical for handling real funds ($50K-$100K needed)
- **TWAP Oracle Disabled**: Single point of failure (Chainlink only)
- **No Pause Mechanism**: Cannot halt operations in emergency
- **EOA Ownership**: Not secured with multisig/timelock
- **5 Failing Oracle Tests**: TWAP calculations broken
- **Unresolved TODOs**: Implementation uncertainties in production code

**Overall Mainnet Readiness**: 5.2/10 ⚠️

---

## Phase 1: IMMEDIATE - Frontend Deployment to Vercel

**Timeline**: This week (30 minutes work + 5 minutes deploy)
**Goal**: Launch testnet DApp for user validation

### Step 1: Pre-Deployment Cleanup (15 minutes)

#### 1.1 Clean up `.env.local`
**Current Problem**: Contract addresses duplicated in both `.env.local` and `deployments/84532.json`

**Action**: Remove redundant variables from `frontend/.env.local`

**Remove**:
```env
# DELETE THESE (already in deployments/84532.json):
INTEREST_RATE_MODEL=0x414219E850F9cD7352a56E763DddDE2900128ac4
ORACLE_ROUTER_ADDRESS=0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97
LIQUIDATOR_ADDRESS=0x7514D0B0883cfCb2f7Cc5AeB512D9c5ab91160E2
MARKET_REGISTRY_ADDRESS=0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4
MARKET_FACTORY=0x403276c627737cAb896BbdDEfEd4538d9a6aE5C0
LENDING_POOL_IMPL=0x72B10a8F2570776c28788652d8b575bD7236796c
```

**Keep Only**:
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=6f257d88c1e725d2ffcdcaa967fd7d32
NEXT_PUBLIC_DEFAULT_CHAIN_ID=84532
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest
```

#### 1.2 Git Branch Management
**Current Status**: On `subgraph` branch with 3 uncommitted files

**Action**: Choose one of the following:

**Option A: Merge to main** (Recommended)
```bash
git add frontend/components/liquidations/
git commit -m "feat: update liquidation components with latest changes"
git checkout main
git merge subgraph
git push origin main
```

**Option B: Deploy from subgraph branch**
```bash
git add frontend/components/liquidations/
git commit -m "feat: update liquidation components"
git push origin subgraph
# Then configure Vercel to deploy from 'subgraph' branch
```

#### 1.3 Create `vercel.json` (Optional but Recommended)

**Location**: `frontend/vercel.json`

**Content**:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

**Why?**: Explicit configuration prevents auto-detection issues in monorepo structure.

---

### Step 2: Deploy to Vercel (5-10 minutes)

#### 2.1 Connect GitHub Repository

**Via Vercel Dashboard** (Recommended for first deploy):

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub account and `ism_protocol` repo
4. **IMPORTANT**: Set Root Directory to `frontend/`
   - Vercel will auto-detect: Framework = Next.js
   - Build Command = `npm run build`
   - Output Directory = `.next`
   - Install Command = `npm install`

#### 2.2 Configure Environment Variables

In Vercel Project Settings → Environment Variables, add:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `6f257d88c1e725d2ffcdcaa967fd7d32` | Production, Preview, Development |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | `84532` | Production, Preview, Development |
| `NEXT_PUBLIC_SUBGRAPH_URL` | `https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest` | Production, Preview, Development |

**Optional** (if using custom RPC):
| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC` | `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` | All |
| `NEXT_PUBLIC_BASE_MAINNET_RPC` | `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY` | All |

#### 2.3 Deploy

**First Deployment**:
1. Click "Deploy" in Vercel dashboard
2. Wait ~2-3 minutes for build
3. Access your DApp at: `https://yourproject.vercel.app`

**Subsequent Deployments**:
- Auto-deploy on every push to configured branch (main or subgraph)
- Preview deployments for PRs

#### 2.4 Custom Domain (Optional - Future)

If you want `app.ismlending.com` instead of `yourproject.vercel.app`:

1. Purchase domain ($10-15/year from Namecheap, Google Domains, etc.)
2. Add domain in Vercel: Project Settings → Domains
3. Configure DNS records (Vercel provides instructions)
4. Wait 24-48 hours for DNS propagation

---

### Step 3: Post-Deployment Validation (10 minutes)

#### Critical Tests After Deployment

**3.1 Wallet Connection** ✅
- [ ] Connect MetaMask
- [ ] Connect Coinbase Wallet
- [ ] Connect WalletConnect
- [ ] Switch to Base Sepolia network
- [ ] Verify wallet address displays correctly

**3.2 Contract Integration** ✅
- [ ] Navigate to Markets page
- [ ] Verify 2 markets load (WETH/USDC, USDC/WETH)
- [ ] Click market detail → verify prices load from oracle
- [ ] Check that contract addresses match `deployments/84532.json`

**3.3 Subgraph Integration** ✅
- [ ] Navigate to Dashboard
- [ ] Verify user positions display (if wallet has testnet positions)
- [ ] Navigate to Liquidations page
- [ ] Verify liquidatable positions list loads
- [ ] Check active auctions display

**3.4 Transaction Testing** ✅
- [ ] Attempt deposit (should trigger wallet popup)
- [ ] Check transaction status updates in UI
- [ ] Verify position updates after transaction confirms
- [ ] Test error handling (insufficient balance, etc.)

**3.5 Performance** ✅
- [ ] Run Lighthouse audit (expect >90 score)
- [ ] Check Time to First Byte <600ms
- [ ] Verify Core Web Vitals pass (LCP, FID, CLS)
- [ ] Test on 3G network connection

**3.6 Mobile Responsiveness** ✅
- [ ] Test on mobile device or DevTools mobile view
- [ ] Verify touch interactions work
- [ ] Test wallet connection on mobile (MetaMask app, Coinbase app)
- [ ] Check typography and layout on small screens

#### Debugging Common Issues

**Issue**: "Network error" or "Cannot read properties of undefined"
- **Fix**: Check Vercel environment variables are set
- **Check**: Browser console for RPC errors
- **Verify**: WalletConnect Project ID is valid

**Issue**: Markets don't load
- **Fix**: Verify `deployments/84532.json` is in correct location
- **Check**: Network request to RPC in browser DevTools
- **Verify**: Base Sepolia RPC is responsive

**Issue**: Subgraph data missing
- **Fix**: Check The Graph endpoint is accessible
- **Check**: Subgraph URL in environment variables
- **Verify**: Indexing is caught up (check The Graph Studio)

**Issue**: Slow page loads
- **Fix**: Enable Vercel Analytics to identify bottleneck
- **Check**: RPC rate limits (consider upgrading to Alchemy/Infura)
- **Optimize**: React Query stale time settings

---

### Expected Result

**Live Testnet DApp** 🚀

- **URL**: `https://yourproject.vercel.app`
- **Network**: Base Sepolia (testnet)
- **Features**:
  - ✅ Wallet connection (RainbowKit)
  - ✅ Market explorer (2 markets)
  - ✅ Portfolio dashboard
  - ✅ Liquidation monitoring
  - ✅ Real-time contract data
  - ✅ Subgraph-powered analytics
  - ✅ Mobile responsive

**What Users Can Do**:
- Connect wallet to Base Sepolia
- View available lending markets
- Deposit testnet assets (WETH, USDC)
- Borrow against collateral
- Monitor position health
- View liquidation opportunities
- Track portfolio performance

---

## Phase 2: SHORT-TERM - Testnet Improvements (1-4 weeks)

**Timeline**: 1-4 weeks after frontend launch
**Goal**: Polish UX, gather user feedback, iterate

### Week 1: User Experience Enhancements

#### 1.1 Complete Error Handling
**Current Issue**: "WouldBeUndercollateralized" error not displayed to user

**Tasks**:
- [ ] Map all contract error codes to user-friendly messages
- [ ] Add toast notifications for transaction states (pending, success, error)
- [ ] Implement error boundaries for graceful failure handling
- [ ] Add retry mechanisms for failed transactions

**Example Error Messages**:
```typescript
const ERROR_MESSAGES = {
  WouldBeUndercollateralized: "Insufficient collateral. Add more collateral or reduce borrow amount.",
  InsufficientLiquidity: "Not enough liquidity in the pool. Try a smaller amount.",
  OracleNotConfigured: "Price feed temporarily unavailable. Try again in a few minutes.",
  // ... etc
}
```

#### 1.2 Add Analytics Tracking
**Goal**: Understand user behavior

**Tasks**:
- [ ] Enable Vercel Analytics (1 click in dashboard)
- [ ] Add custom events for key actions:
  - Wallet connections
  - Deposits/withdrawals
  - Borrows/repayments
  - Liquidation attempts
- [ ] Set up Mixpanel/Amplitude (optional, for deeper funnel analysis)
- [ ] Create analytics dashboard to monitor KPIs:
  - Daily Active Users (DAU)
  - TVL growth
  - Borrow utilization
  - Liquidation frequency

#### 1.3 Documentation & Help
**Goal**: Reduce user confusion

**Tasks**:
- [ ] Add tooltips explaining DeFi terms:
  - LTV (Loan-to-Value)
  - Health Factor
  - APY (Annual Percentage Yield)
  - Liquidation
- [ ] Create "How It Works" guide page
- [ ] Add testnet faucet links:
  - Base Sepolia ETH faucet
  - Bridge testnet tokens
- [ ] Embed demo video showing how to use protocol
- [ ] Add FAQ section for common questions

---

### Week 2: Performance & Reliability

#### 2.1 Optimize RPC Calls
**Current Issue**: Using public Base RPC (may hit rate limits)

**Tasks**:
- [ ] Sign up for Alchemy or Infura (free tier: 300M compute units/month)
- [ ] Add API key to Vercel environment variables
- [ ] Configure wagmi with custom RPC:
```typescript
const baseSepoliaRpc = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'
```
- [ ] Implement RPC request batching (wagmi supports this)
- [ ] Add fallback RPC providers (primary: Alchemy, fallback: public)

#### 2.2 Subgraph Optimization
**Current Issue**: The Graph free tier limited to ~1000 requests/day

**Tasks**:
- [ ] Monitor subgraph usage in The Graph Studio
- [ ] Upgrade to paid tier if hitting rate limits ($10-50/month)
- [ ] Implement caching layer:
  - Option A: Vercel KV (Redis) for caching subgraph responses
  - Option B: Increase React Query stale time (currently 4 minutes)
- [ ] Add polling fallback if subgraph is down (query contracts directly)
- [ ] Set up alerts for subgraph indexing delays

#### 2.3 Loading States & UX Polish
**Tasks**:
- [ ] Add skeleton loaders for all data fetching:
  - Markets list
  - User positions
  - Transaction history
- [ ] Improve transaction pending states:
  - Show step-by-step progress (1/3: Approving, 2/3: Depositing, 3/3: Confirmed)
  - Add estimated time remaining
- [ ] Add optimistic updates (update UI before transaction confirms)
- [ ] Implement infinite scroll for transaction history (instead of pagination)

---

### Week 3-4: Feature Additions (Optional)

#### 3.1 Enhanced Dashboard
**Tasks**:
- [ ] Add portfolio history charts (TVL over time)
- [ ] Show interest earned breakdown by market
- [ ] Add position alerts:
  - Email/SMS when health factor drops below 1.2
  - Browser notifications for important events
- [ ] Create "Quick Actions" shortcuts (deposit, borrow, repay)
- [ ] Add portfolio export (CSV, PDF)

#### 3.2 Social Proof & Gamification
**Tasks**:
- [ ] Add protocol stats banner:
  - Total Value Locked (TVL)
  - Active users count
  - Total interest earned
- [ ] Show recent transactions feed (privacy-preserving, show addresses as 0x1234...5678)
- [ ] Leaderboard: Top suppliers, top borrowers (optional, may incentivize gaming)
- [ ] Achievement badges (First Deposit, Liquidation Hunter, Power User)

#### 3.3 User Testing & Iteration
**Tasks**:
- [ ] Share testnet DApp with 10-20 beta users
- [ ] Set up feedback form (Google Forms or Typeform)
- [ ] Conduct user interviews (5-10 users, 30 min each)
- [ ] Track bounce rates and conversion funnels
- [ ] Fix top 3 pain points identified by users
- [ ] A/B test key flows (deposit flow, borrow flow)

---

### Expected Result After Phase 2

**Polished Testnet DApp** 🌟

- Professional UX with clear error messages
- Fast performance (<2s page loads)
- Reliable (fallback RPC, cached subgraph)
- Well-documented (help tooltips, guides)
- User-validated (feedback from 50+ testers)
- Production-ready for mainnet (when security is addressed)

**Metrics to Track**:
- DAU: Target 20-50 daily active users
- TVL: Target $100K+ testnet TVL
- Retention: Target 30% week-over-week retention
- NPS: Target Net Promoter Score >40

**Decision Point**: If these metrics are hit, proceed to mainnet preparation. If not, iterate on product until metrics improve.

---

## Phase 3: FUTURE - Mainnet Preparation (When You Have Traction)

**Timeline**: 11-18 weeks from now (after testnet validation)
**Prerequisites**: 50+ active users, $500K+ testnet TVL, strong user demand

### When to Consider Mainnet

**Green Lights** ✅:
- 50+ daily active testnet users
- $500K+ in testnet TVL for 4+ weeks
- <10% churn rate (users keep coming back)
- User feedback shows willingness to use with real funds
- Budget secured for security work ($50K-$100K)

**Red Lights** 🚫:
- Low testnet engagement (<10 DAU)
- High churn (users try once and leave)
- No clear product-market fit
- Budget constraints (can't afford audit)

**If Red Lights**: Stay on testnet, iterate on product, reconsider mainnet in 3-6 months.

---

### Mainnet Preparation Timeline (11-18 weeks)

#### Phase 3.1: Security Hardening (4-6 weeks)

**Week 1-2: Re-enable TWAP Oracle Fallback**

**Current Issue**: TWAP intentionally disabled (commit 9162447), 5 failing tests

**Tasks**:
- [ ] Fix `OracleRouter.sol:260` TODO (decimal scaling in TWAP)
- [ ] Debug price deviation errors (currently off by 10^15)
- [ ] Implement proper TWAP calculation:
  - 30-minute time-weighted average
  - Normalize to 1e18 (match Chainlink format)
- [ ] Add deviation checks (5% max between Chainlink and TWAP)
- [ ] Test with real Uniswap V3 pools on Base mainnet fork
- [ ] Ensure all 5 failing oracle tests pass
- [ ] Fuzz test oracle with 100K+ runs

**Acceptance Criteria**:
- ✅ All oracle tests passing (100% pass rate)
- ✅ TWAP fallback activates if Chainlink fails
- ✅ Price deviation alerts work correctly
- ✅ No regressions in other tests

**Week 3: Implement Emergency Pause Mechanism**

**Current Issue**: No way to halt protocol in case of exploit

**Tasks**:
- [ ] Add OpenZeppelin `Pausable` to core contracts:
  - LendingPool: pause deposits, borrows, liquidations
  - MarketFactory: pause new market creation
  - DutchAuctionLiquidator: pause new auctions
- [ ] Create `EmergencyPause` contract with time-delay:
  - Guardian role can pause immediately (emergency)
  - Owner role can pause after 6-hour delay (non-emergency)
- [ ] Add `whenNotPaused` modifier to state-changing functions
- [ ] Test pause/unpause flow end-to-end
- [ ] Document emergency response procedures

**Acceptance Criteria**:
- ✅ All user actions halt when paused
- ✅ Withdrawals still possible when paused (users can exit)
- ✅ Pause can be triggered in <5 minutes
- ✅ Tests verify paused state prevents exploits

**Week 4: Set Up Multisig Governance**

**Current Issue**: EOA owner = single point of failure

**Tasks**:
- [ ] Deploy Gnosis Safe multisig on Base mainnet
  - Type: 3-of-5 multisig (requires 3 signatures to execute)
  - Signers: Founder(s) + 2-3 trusted advisors
- [ ] Deploy Timelock contract (24-48 hour delay on changes)
- [ ] Transfer ownership of all contracts to multisig:
  - MarketFactory
  - MarketRegistry
  - OracleRouter
  - DutchAuctionLiquidator
- [ ] Test multisig workflow:
  - Propose transaction
  - Gather signatures
  - Execute transaction
- [ ] Document key management procedures

**Acceptance Criteria**:
- ✅ No single person can change protocol parameters
- ✅ 24-48 hour timelock on all admin actions
- ✅ Emergency pause can bypass timelock (for security)
- ✅ Backup key recovery plan documented

**Week 5-6: Professional Security Audit**

**Budget**: $50K-$100K

**Recommended Audit Firms**:
1. **Trail of Bits** (top tier, $100K+)
2. **OpenZeppelin** (reputable, $75K+)
3. **Consensys Diligence** (established, $60K+)
4. **Sherlock** (community-driven, $30K+)
5. **Code4rena** (contest format, $20K+)

**Audit Scope**:
- All core contracts (LendingPool, OracleRouter, InterestRateModel, etc.)
- Libraries (MathLib, OracleLib, Validator)
- Deployment scripts
- Access control patterns
- Economic model review

**Deliverables**:
- Security audit report (PDF)
- List of findings (Critical, High, Medium, Low severity)
- Remediation recommendations
- Post-fix verification report

**Timeline**:
- Week 5: Engage auditor, submit code
- Week 6: Auditor reviews, preliminary findings
- Week 7-8: Fix critical/high issues, re-audit

**Acceptance Criteria**:
- ✅ 0 critical vulnerabilities
- ✅ 0 high severity issues
- ✅ <3 medium severity issues (with clear mitigation plan)
- ✅ Public audit report published

---

#### Phase 3.2: Testnet Stress Testing (2-3 weeks)

**Week 7-8: Deploy Updated Contracts to Testnet**

**Tasks**:
- [ ] Deploy V2 contracts to Base Sepolia with fixes:
  - TWAP enabled
  - Pause mechanism active
  - Multisig ownership
- [ ] Migrate existing markets or create new ones
- [ ] Update frontend to use V2 contracts
- [ ] Run liquidation bot 24/7 for 2 weeks

**Week 8-9: Economic Simulations & Stress Tests**

**Tasks**:
- [ ] Large deposit/withdraw cycles (test interest accrual)
- [ ] Max utilization borrowing (test rate model)
- [ ] Forced liquidations (test Dutch auction)
- [ ] Oracle failure scenarios:
  - Disable Chainlink (verify TWAP fallback activates)
  - Disable TWAP (verify Chainlink continues)
  - Introduce price manipulation attempts
- [ ] Fuzz testing with 1M+ runs (invariant tests)
- [ ] Simulate L2 sequencer downtime
- [ ] Test pause mechanism under load

**Acceptance Criteria**:
- ✅ No unexpected reverts or panics
- ✅ All invariants hold after 1M fuzz runs
- ✅ Oracle fallback works in failure scenarios
- ✅ Liquidations execute profitably
- ✅ Bot runs continuously without errors

---

#### Phase 3.3: Mainnet Deployment (1 week)

**Week 10: Deploy to Base Mainnet**

**Pre-Deployment Checklist**:
- [ ] All audit issues resolved
- [ ] All tests passing (100% pass rate)
- [ ] Multisig funded with gas (1 ETH minimum)
- [ ] Monitoring infrastructure ready (Grafana, PagerDuty)
- [ ] Incident response team on standby
- [ ] Legal review complete (terms of service, risk disclosures)

**Deployment Steps**:

1. **Deploy Infrastructure** (from `contracts/` directory):
```bash
# Set up mainnet environment
export PRIVATE_KEY="0x..."  # Multisig signer key
export BASE_MAINNET_RPC="https://mainnet.base.org"

# Deploy core contracts
forge script script/DeployCore.s.sol \
  --rpc-url $BASE_MAINNET_RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# Outputs to: ../deployments/8453.json
```

2. **Transfer Ownership to Multisig**:
```bash
cast send $MARKET_FACTORY "transferOwnership(address)" $MULTISIG_ADDRESS \
  --rpc-url $BASE_MAINNET_RPC \
  --private-key $PRIVATE_KEY
```

3. **Configure Oracles** (via multisig):
```bash
# Set Chainlink feeds for production tokens (WETH, USDC, etc.)
# Set TWAP parameters (30-min window, 5% max deviation)
```

4. **Deploy Initial Markets** (conservative parameters):
```bash
# Market 1: WETH/USDC (blue-chip, high liquidity)
# LTV: 70% (reduced from testnet's 75%)
# Liquidation Threshold: 75% (reduced from 80%)
# Reserve Factor: 15% (increased from 10%)
```

5. **Verify Deployment**:
- [ ] All contracts verified on Basescan
- [ ] Ownership transferred to multisig
- [ ] Oracles returning correct prices
- [ ] Test deposit/borrow/repay with small amounts (<$100)

**Deployment Checklist**:
- [ ] InterestRateModel deployed & verified
- [ ] OracleRouter deployed & configured
- [ ] DutchAuctionLiquidator deployed
- [ ] MarketRegistry deployed
- [ ] LendingPool implementation deployed
- [ ] MarketFactory deployed & configured
- [ ] Initial markets created
- [ ] Ownership transferred to multisig
- [ ] Frontend updated with mainnet addresses

---

#### Phase 3.4: Gradual Mainnet Launch (4-8 weeks)

**Week 11-12: Whitelist Phase**

**Parameters**:
- Invite-only (50 selected users from testnet)
- Supply cap: $100K per market
- Borrow cap: $50K per market
- Liquidation bot running 24/7

**Goals**:
- Verify mainnet contracts work correctly
- Build TVL slowly
- Monitor for issues

**Week 13-14: Public Launch (Soft Cap)**

**Parameters**:
- Open to public
- Supply cap: $500K per market
- Borrow cap: $250K per market
- Announce on Twitter, Discord, forums

**Goals**:
- Reach $1M TVL
- Attract 100+ active users
- Generate liquidation activity

**Week 15-18: Scale Gradually**

**Week 15**: Raise cap to $2M supply, $1M borrow
**Week 16**: Add 2 new markets (WBTC, DAI, etc.)
**Week 17**: Raise cap to $5M supply, $2.5M borrow
**Week 18**: Remove caps (fully open)

**Continuous Monitoring**:
- Health Factor distribution (how many users near liquidation?)
- Utilization rates (are rates attracting enough suppliers?)
- Liquidation execution (are liquidations profitable for bot?)
- Oracle prices (any anomalies or manipulations?)
- Gas costs (are transactions affordable for users?)

**Incident Response**:
- 24/7 on-call rotation
- PagerDuty alerts for critical events:
  - Oracle price deviation >10%
  - Utilization >95%
  - Liquidation backlog >10 positions
  - Contract pause triggered
- Runbook for common issues
- Communication plan (Twitter, Discord announcements)

---

### Expected Result After Phase 3

**Live Mainnet Protocol** 🎉

- **Network**: Base mainnet (Chain ID: 8453)
- **Security**: Audited, multisig-controlled, pausable
- **TVL**: $1M-$10M (depending on market conditions)
- **Users**: 100-1000 active users
- **Markets**: 3-5 high-quality pairs (WETH/USDC, WBTC/USDC, etc.)
- **Frontend**: Production app at `app.ismlending.com`
- **Bot**: Liquidation bot running 24/7
- **Monitoring**: Real-time dashboards and alerts

**What's Different from Testnet**:
- Real money at stake (user deposits)
- Security measures active (pause, multisig, dual oracle)
- Conservative risk parameters (lower LTV, higher reserve factor)
- Professional support (24/7 monitoring, incident response)
- Legal compliance (terms of service, risk disclosures)

---

## Phase 4: LONG-TERM - Growth & Scaling (6+ months)

**Not in immediate roadmap, but worth planning for:**

### Potential Future Enhancements

#### 6.1 Protocol Expansion
- Deploy to other L2s (Arbitrum, Optimism, Polygon zkEVM)
- Add more markets (LSTs, RWAs, yield-bearing tokens)
- Cross-chain liquidity (bridge between deployments)
- Governance token launch (protocol revenue sharing)

#### 6.2 Advanced Features
- Flash loans (atomic borrow/repay in same transaction)
- Leverage vaults (1-click leveraged positions)
- Automated strategies (auto-compound interest, stop-loss)
- Credit delegation (lend to trusted addresses without collateral)
- Insurance fund (cover bad debt from failed liquidations)

#### 6.3 Ecosystem Integrations
- Integrate with aggregators (1inch, Paraswap for swaps)
- Partner with wallets (in-app lending)
- DeFi ecosystem partnerships (Uniswap, Aave, Morpho)
- Fiat on-ramps (credit card deposits via Stripe, Moonpay)

#### 6.4 Protocol Decentralization
- Transition to DAO governance
- Timelock → on-chain voting
- Protocol revenue distribution to token holders
- Decentralized oracle network (Chainlink → UMA)

---

## Cost Estimates

### Testnet Phase (Phase 1-2)
- **Hosting**: $0 (Vercel free tier, 100GB bandwidth)
- **Subgraph**: $0-$50/month (The Graph free tier → paid)
- **RPC**: $0-$50/month (Alchemy free tier → growth)
- **Development**: Your time + team
- **Total**: $0-$100/month

### Mainnet Preparation (Phase 3)
- **Security Audit**: $50K-$100K (one-time)
- **Legal Review**: $5K-$15K (terms of service, compliance)
- **Deployment Gas**: $500-$1K (Base is cheap)
- **Multisig Setup**: $100 (Gnosis Safe deployment)
- **Monitoring Tools**: $100-$500/month (Grafana, PagerDuty)
- **Total**: $55K-$117K upfront + $100-$500/month

### Mainnet Operations (Phase 3.4+)
- **Infrastructure**: $200-$500/month (RPC, subgraph, hosting)
- **Monitoring**: $100-$500/month (alerting, logging)
- **Gas (bot)**: $100-$1K/month (liquidation bot transactions)
- **Team**: 1-2 full-time engineers
- **Total**: $400-$2K/month + salaries

---

## Risk Assessment

### Testnet Risks (Low)
- ✅ No real funds at risk
- ✅ Can iterate quickly without consequences
- ⚠️ Testnet outages may cause downtime
- ⚠️ Subgraph rate limits may affect UX

### Mainnet Risks (High - if deploying without preparation)
- 🔴 Loss of user funds (no audit, single oracle, no pause)
- 🔴 Exploits/hacks (smart contract vulnerabilities)
- 🔴 Oracle manipulation (price feed attacks)
- 🔴 Economic attacks (flash loan, whale manipulation)
- 🔴 Regulatory risks (SEC, CFTC scrutiny)
- 🔴 Reputation damage (hack = trust lost forever)

### Mainnet Risks (Medium - if following roadmap)
- 🟡 Audit may find critical issues (delay launch)
- 🟡 Budget constraints (audit + legal = $60K+)
- 🟡 Limited initial liquidity (chicken-egg problem)
- 🟡 Competition (Aave, Compound, Morpho well-established)
- 🟡 Market conditions (bear market = low DeFi usage)

---

## Success Metrics

### Testnet Phase (Phase 1-2)
| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Daily Active Users | 20-50 | 100+ |
| Testnet TVL | $100K | $500K |
| Week-over-week Retention | 30% | 50% |
| Net Promoter Score | 40 | 60 |
| Liquidation Bot Uptime | 95% | 99% |

### Mainnet Phase (Phase 3-4)
| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| TVL (3 months) | $1M | $10M |
| Active Users (3 months) | 100-500 | 1000+ |
| Liquidation Success Rate | 95% | 99% |
| Oracle Uptime | 99.5% | 99.9% |
| Security Incidents | 0 | 0 |

---

## Decision Framework

### Should I Deploy to Testnet Now?
**YES** ✅ - Zero downside, valuable user feedback, iterate fast

### Should I Deploy to Mainnet Now?
**NO** 🔴 - Critical security gaps, high risk of loss of funds

### When Should I Deploy to Mainnet?
**WHEN**:
1. ✅ Testnet validated (50+ DAU, $500K+ TVL, strong retention)
2. ✅ Budget secured ($60K+ for audit + legal)
3. ✅ Security hardening complete (TWAP, pause, multisig)
4. ✅ Professional audit passed (0 critical/high issues)
5. ✅ User demand justifies investment

**TIMELINE**: Earliest 3-6 months from now (if all goes well)

---

## Immediate Next Steps (After Plan Approval)

If you approve this roadmap, here's what I'll do in the next 30 minutes:

1. **Clean up `.env.local`** (remove duplicate contract addresses)
2. **Create `vercel.json`** (optimal Vercel configuration)
3. **Commit liquidation component changes** (staged files)
4. **Create Vercel deployment guide** (step-by-step with screenshots)
5. **Create post-deployment checklist** (validation tests)

**Then you'll be ready to**:
- Push to GitHub
- Connect Vercel
- Deploy in 5 minutes
- Share testnet DApp with users 🚀

---

## Resources & Links

### Documentation
- [ISM Protocol - CLAUDE.md](./CLAUDE.md) - Project guide
- [ISM Protocol - README.md](./README.md) - Monorepo overview
- [Frontend README](./frontend/README.md) - Frontend setup
- [Contracts README](./contracts/README.md) - Smart contracts guide

### External Resources
- [Vercel Deployment Docs](https://vercel.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [wagmi v2 Documentation](https://wagmi.sh)
- [The Graph Studio](https://thegraph.com/studio)
- [Base Network Docs](https://docs.base.org)

### Tools
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- [Base Sepolia Explorer](https://sepolia.basescan.org)
- [Gnosis Safe](https://safe.global) - Multisig wallet
- [WalletConnect Project ID](https://cloud.walletconnect.com) - Get API key

---

**Last Updated**: March 20, 2026
**Next Review**: After Phase 1 completion (testnet deployment)
**Status**: Ready to execute Phase 1 → awaiting approval