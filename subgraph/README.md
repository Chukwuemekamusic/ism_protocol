# ISM Protocol Subgraph

This subgraph indexes ISM Protocol lending pools, positions, auctions, and liquidations on Base Sepolia.

## Status

🚧 **IN PROGRESS** - Core infrastructure complete, fixing ABI compatibility issues

### Completed ✅
- GraphQL schema with all entities (Protocol, Market, Token, Position, User, Auction, Liquidation, MarketSnapshot, Transaction)
- Event handler structure for all contract events
- ABIs extracted from compiled contracts
- subgraph.yaml manifest configuration
- Package.json with dependencies
- Event signature corrections (MarketRegistered, MarketCreated, AuctionStarted, AuctionExecuted)

### In Progress 🔧
- Fixing ABI compatibility issues in `lending-pool.ts`:
  - Function names (borrowRate, supplyRate, balanceOf, userCollateral, userBorrow need verification)
  - Event parameter mapping for Borrow/Repay events

## Next Steps

1. **Fix Remaining ABI Issues**:
   - Verify LendingPool contract function names in ABI
   - Check Borrow/Repay event parameter structures
   - Update `lending-pool.ts` handlers to match actual ABI

2. **Build Verification**:
   ```bash
   npm run codegen
   npm run build
   ```

3. **Deploy to The Graph Studio**:
   ```bash
   graph auth --studio <DEPLOY_KEY>
   graph deploy --studio ism-protocol
   ```

## Deployment Configuration

**Network**: Base Sepolia (Chain ID: 84532)

**Contract Addresses**:
- MarketRegistry: `0xB7fC139046a2d976060e2dB969b6Dd63ACeEA3f4`
- MarketFactory: `0x403276c627737cAb896BbdDEfEd4538d9a6aE5C0`
- DutchAuctionLiquidator: `0x7514D0B0883cfCb2f7Cc5AeB512D9c5ab91160E2`
- OracleRouter: `0xD8f530eB3B624c6D4E89d504E48F8b0d00BF0a97`

**Start Block**: 18500000 (to be updated with actual deployment block)

## Key Features

- **Real-time Position Tracking**: Monitors all user positions with health factors
- **Liquidation Discovery**: Tracks liquidatable positions (HF < 1.0) with time underwater
- **Auction Indexing**: Complete auction lifecycle from start to execution
- **Historical Analytics**: Daily snapshots for charts and historical data
- **Transaction History**: Complete transaction log for all user actions

## GraphQL Queries

### Get Liquidatable Positions
```graphql
query LiquidatablePositions {
  positions(
    where: { healthFactor_lt: "1.0", borrowedAmount_gt: "0" }
    orderBy: healthFactor
    orderDirection: asc
  ) {
    id
    user { id }
    market { id collateralToken borrowToken }
    collateralAmount
    borrowedAmount
    healthFactor
    timeUnderwater
    underwaterSince
  }
}
```

### Get Active Auctions
```graphql
query ActiveAuctions {
  auctions(where: { isActive: true }) {
    id
    borrower { id }
    market { id }
    collateralAmount
    debtAmount
    startTime
    endTime
    currentPriceMultiplier
  }
}
```

### Get Liquidation History
```graphql
query LiquidationHistory($user: String!) {
  liquidations(
    where: { liquidator: $user }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    borrower { id }
    market { id }
    debtRepaid
    collateralReceived
    profitUSD
    timestamp
  }
}
```

## Development

### Install Dependencies
```bash
npm install
```

### Generate Types
```bash
npm run codegen
```

### Build
```bash
npm run build
```

### Deploy Locally (optional)
```bash
npm run create-local
npm run deploy-local
```

### Deploy to Studio
```bash
graph deploy --studio ism-protocol
```

## Files Structure

```
subgraph/
├── schema.graphql              # GraphQL schema
├── subgraph.yaml              # Manifest configuration
├── package.json               # Dependencies
├── abis/                      # Contract ABIs
│   ├── LendingPool.json
│   ├── MarketRegistry.json
│   ├── MarketFactory.json
│   ├── DutchAuctionLiquidator.json
│   ├── OracleRouter.json
│   └── ERC20.json
└── src/                       # Event handlers
    ├── market-registry.ts
    ├── market-factory.ts
    ├── dutch-auction-liquidator.ts
    └── lending-pool.ts
```

## Known Issues

1. **LendingPool ABI Compatibility**: Some function names may not match generated types
   - Need to verify actual function names in deployed contract
   - May need to adjust handler code to match ABI

2. **Price Data**: USD values currently set to 0
   - Will need OracleRouter integration for accurate price data
   - Consider adding price feed calls in handlers

3. **Risk Parameters**: Using hardcoded defaults (75% LTV, 80% liquidation threshold, 5% penalty)
   - These values match protocol defaults
   - Not exposed in contract ABI as public variables

## Resources

- [The Graph Documentation](https://thegraph.com/docs/)
- [AssemblyScript Documentation](https://www.assemblyscript.org/)
- [ISM Protocol Contracts](../contracts/)
- [Frontend Enhancement Plan](../FRONTEND_ENHANCEMENT_PLAN.md)
