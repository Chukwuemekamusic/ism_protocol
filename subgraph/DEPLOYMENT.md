# ISM Protocol Subgraph Deployment Guide

## ✅ Deployment Status: LIVE

**Deployed**: March 18, 2026
**Endpoint**: https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest
**Studio**: https://thegraph.com/studio/subgraph/ism-protocol
**Build Hash**: QmUBgRGESmhhYLm2qgZbB8BhiHv1zjzUtPBycvs1EYkqBX

## Quick Deployment

### 1. Create Subgraph on The Graph Studio

Visit https://thegraph.com/studio/ and:
- Connect wallet
- Create new subgraph named "ism-protocol"
- Note your deployment key

### 2. Authenticate

```bash
cd subgraph
graph auth --studio YOUR_DEPLOY_KEY
```

### 3. Deploy

```bash
graph deploy ism-protocol
```

## Configuration

### Network
- **Chain**: Base Sepolia (Chain ID: 84532)
- **Start Block**: 18500000 (update in `subgraph.yaml` with actual deployment block)

### Contract Addresses
All addresses are configured in `subgraph.yaml`:
- MarketRegistry: `0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4`
- MarketFactory: `0x403276c627737cAb896BbdDEfEd4538d9a6aE5C0`
- DutchAuctionLiquidator: `0x7514D0B0883cfCb2f7Cc5AeB512D9c5ab91160E2`

## What Gets Indexed

### Entities
- **Markets**: All lending pools with collateral/borrow pairs
- **Positions**: User positions with health factors and liquidatability status
- **Auctions**: Dutch auctions from start to completion
- **Liquidations**: Complete liquidation history
- **Transactions**: All user actions (deposits, borrows, repayments, etc.)
- **Snapshots**: Daily market snapshots for historical analytics

### Key Queries

#### Find Liquidatable Positions
```graphql
{
  positions(
    where: { healthFactor_lt: "1.0", borrowedAmount_gt: "0" }
    orderBy: healthFactor
    first: 10
  ) {
    id
    user { id }
    healthFactor
    collateralAmount
    borrowedAmount
    timeUnderwater
    market { id }
  }
}
```

#### Active Auctions
```graphql
{
  auctions(where: { isActive: true }) {
    id
    borrower { id }
    collateralAmount
    debtAmount
    startTime
    endTime
    currentPriceMultiplier
  }
}
```

#### User Liquidation History
```graphql
{
  liquidations(
    where: { liquidator: "0x..." }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    borrower { id }
    debtRepaid
    collateralReceived
    profitUSD
    timestamp
  }
}
```

## Automated ABI Syncing

ABIs are automatically synced from `contracts/out/` before every build:

```bash
npm run sync-abis  # Manual sync
npm run codegen    # Auto-syncs then generates types
npm run build      # Auto-syncs then builds
```

## Development Workflow

### Making Changes

1. **Update Schema** (`schema.graphql`)
2. **Update Handlers** (`src/*.ts`)
3. **Regenerate Types**: `npm run codegen`
4. **Build**: `npm run build`
5. **Deploy**: `npm run deploy`

### After Contract Updates

When contracts change:

```bash
# 1. Rebuild contracts
cd ../contracts
forge build

# 2. Subgraph will auto-sync ABIs on next build
cd ../subgraph
npm run build
```

## Monitoring

After deployment, monitor at:
- The Graph Studio: https://thegraph.com/studio/
- Subgraph endpoint will be provided after deployment

## Integration with Frontend

Once deployed, update `frontend/.env.local`:

```env
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../ism-protocol/v0.0.1
```

Then use in React:

```typescript
import { request, gql } from 'graphql-request';

const query = gql`
  {
    positions(where: { healthFactor_lt: "1.0" }) {
      id
      healthFactor
    }
  }
`;

const data = await request(SUBGRAPH_URL, query);
```

## Known Limitations

1. **USD Values**: Currently set to 0
   - Requires OracleRouter integration for accurate pricing
   - Can be added in future version

2. **Supply Shares**: Tracked via events only
   - Not queried from contract to avoid ABI complexity
   - Accurate for deposit/withdraw events

3. **Rates**: Updated via InterestAccrued events
   - Not continuously calculated
   - Reflects actual protocol state

## Troubleshooting

### Build Fails
```bash
npm run codegen  # Regenerate types
npm run build    # Try again
```

### ABI Out of Sync
```bash
cd ../contracts
forge build
cd ../subgraph
npm run sync-abis
npm run build
```

### Deployment Fails
- Check your deploy key
- Verify network in `subgraph.yaml` matches studio
- Ensure start block is correct

## Next Steps

1. Deploy to The Graph Studio
2. Test queries in GraphQL playground
3. Integrate with frontend liquidations page
4. Monitor indexing progress
5. Add USD price calculations (future enhancement)

## Resources

- [The Graph Docs](https://thegraph.com/docs/)
- [Studio Dashboard](https://thegraph.com/studio/)
- [AssemblyScript Docs](https://www.assemblyscript.org/)
