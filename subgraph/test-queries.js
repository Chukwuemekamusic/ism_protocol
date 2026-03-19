#!/usr/bin/env node

/**
 * Subgraph Integration Tests
 * Tests all major queries against the deployed subgraph
 *
 * Usage: node test-queries.js
 */

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function query(queryString, variables = {}) {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: queryString,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Test cases
const tests = [
  {
    name: 'Test 1: Query Markets',
    query: `
      query {
        markets(first: 10) {
          id
          collateralToken { symbol decimals }
          borrowToken { symbol decimals }
          totalSupplyAssets
          totalBorrowAssets
          totalCollateral
          utilizationRate
          createdAt
        }
      }
    `,
    validate: (data) => {
      if (!data.markets) throw new Error('No markets field in response');
      if (!Array.isArray(data.markets)) throw new Error('markets is not an array');

      log(colors.cyan, `   Found ${data.markets.length} markets`);

      if (data.markets.length > 0) {
        const market = data.markets[0];
        log(colors.blue, `   Sample: ${market.collateralToken.symbol}/${market.borrowToken.symbol}`);
        log(colors.blue, `   Supply: ${market.totalSupplyAssets}, Borrow: ${market.totalBorrowAssets}`);

        // Validate structure
        if (!market.id) throw new Error('Market missing id');
        if (!market.collateralToken) throw new Error('Market missing collateralToken');
        if (!market.borrowToken) throw new Error('Market missing borrowToken');
      }

      return true;
    },
  },

  {
    name: 'Test 2: Query Liquidatable Positions',
    query: `
      query {
        positions(
          where: { healthFactor_lt: "1.0", borrowedAmount_gt: "0" }
          orderBy: healthFactor
          first: 20
        ) {
          id
          user { id }
          market {
            collateralToken { symbol }
            borrowToken { symbol }
          }
          collateralAmount
          borrowedAmount
          healthFactor
          isLiquidatable
          timeUnderwater
        }
      }
    `,
    validate: (data) => {
      if (!data.positions) throw new Error('No positions field in response');
      if (!Array.isArray(data.positions)) throw new Error('positions is not an array');

      log(colors.cyan, `   Found ${data.positions.length} liquidatable positions`);

      if (data.positions.length > 0) {
        const position = data.positions[0];
        log(colors.yellow, `   ⚠️  Liquidatable: HF=${position.healthFactor}, Debt=${position.borrowedAmount}`);

        // Validate all have HF < 1.0
        for (const pos of data.positions) {
          const hf = parseFloat(pos.healthFactor);
          if (hf >= 1.0) {
            throw new Error(`Position ${pos.id} has HF >= 1.0: ${hf}`);
          }
        }
      } else {
        log(colors.green, `   ✓ No liquidatable positions (healthy protocol)`);
      }

      return true;
    },
  },

  {
    name: 'Test 3: Query Active Auctions',
    query: `
      query {
        auctions(where: { isActive: true }, first: 10) {
          id
          borrower { id }
          market {
            collateralToken { symbol }
            borrowToken { symbol }
          }
          collateralAmount
          debtAmount
          startTime
          endTime
          isActive
        }
      }
    `,
    validate: (data) => {
      if (!data.auctions) throw new Error('No auctions field in response');
      if (!Array.isArray(data.auctions)) throw new Error('auctions is not an array');

      log(colors.cyan, `   Found ${data.auctions.length} active auctions`);

      if (data.auctions.length > 0) {
        const auction = data.auctions[0];
        log(colors.yellow, `   ⚡ Active: ID=${auction.id}, Debt=${auction.debtAmount}`);

        // Validate all are active
        for (const auction of data.auctions) {
          if (!auction.isActive) {
            throw new Error(`Auction ${auction.id} marked as inactive but in active query`);
          }
        }
      } else {
        log(colors.green, `   ✓ No active auctions`);
      }

      return true;
    },
  },

  {
    name: 'Test 4: Query Liquidation History',
    query: `
      query {
        liquidations(orderBy: timestamp, orderDirection: desc, first: 20) {
          id
          liquidator { id }
          borrower { id }
          market {
            collateralToken { symbol }
            borrowToken { symbol }
          }
          debtRepaid
          collateralReceived
          timestamp
          transactionHash
          blockNumber
        }
      }
    `,
    validate: (data) => {
      if (!data.liquidations) throw new Error('No liquidations field in response');
      if (!Array.isArray(data.liquidations)) throw new Error('liquidations is not an array');

      log(colors.cyan, `   Found ${data.liquidations.length} historical liquidations`);

      if (data.liquidations.length > 0) {
        const liq = data.liquidations[0];
        const date = new Date(parseInt(liq.timestamp) * 1000).toLocaleDateString();
        log(colors.blue, `   Latest: ${date}, Debt=${liq.debtRepaid}, Collateral=${liq.collateralReceived}`);

        // Validate timestamps are in descending order
        for (let i = 1; i < data.liquidations.length; i++) {
          const prev = parseInt(data.liquidations[i - 1].timestamp);
          const curr = parseInt(data.liquidations[i].timestamp);
          if (curr > prev) {
            throw new Error('Liquidations not sorted by timestamp descending');
          }
        }
      } else {
        log(colors.green, `   ✓ No liquidation history (new deployment or no activity)`);
      }

      return true;
    },
  },

  {
    name: 'Test 5: Query Protocol Statistics',
    query: `
      query {
        protocol(id: "protocol") {
          totalMarkets
          totalValueLockedUSD
          totalBorrowedUSD
          totalLiquidationsUSD
          lastUpdate
        }
      }
    `,
    validate: (data) => {
      if (!data.protocol) {
        log(colors.yellow, `   ⚠️  Protocol entity not initialized yet (will be created on first market)`);
        return true;
      }

      log(colors.cyan, `   Protocol Stats:`);
      log(colors.blue, `   - Total Markets: ${data.protocol.totalMarkets}`);
      log(colors.blue, `   - TVL: $${data.protocol.totalValueLockedUSD}`);
      log(colors.blue, `   - Total Borrowed: $${data.protocol.totalBorrowedUSD}`);

      return true;
    },
  },

  {
    name: 'Test 6: Query All Positions (User Activity)',
    query: `
      query {
        positions(first: 50) {
          id
          user { id }
          market { id }
          collateralAmount
          borrowedAmount
          healthFactor
          isLiquidatable
          lastUpdate
        }
      }
    `,
    validate: (data) => {
      if (!data.positions) throw new Error('No positions field in response');
      if (!Array.isArray(data.positions)) throw new Error('positions is not an array');

      log(colors.cyan, `   Found ${data.positions.length} total positions`);

      let healthyCount = 0;
      let unhealthyCount = 0;

      for (const pos of data.positions) {
        if (pos.isLiquidatable) {
          unhealthyCount++;
        } else {
          healthyCount++;
        }
      }

      log(colors.green, `   - Healthy: ${healthyCount}`);
      if (unhealthyCount > 0) {
        log(colors.yellow, `   - Liquidatable: ${unhealthyCount}`);
      }

      return true;
    },
  },

  {
    name: 'Test 7: Query Transactions',
    query: `
      query {
        transactions(orderBy: timestamp, orderDirection: desc, first: 20) {
          id
          type
          user { id }
          market {
            collateralToken { symbol }
            borrowToken { symbol }
          }
          amount
          timestamp
          blockNumber
        }
      }
    `,
    validate: (data) => {
      if (!data.transactions) throw new Error('No transactions field in response');
      if (!Array.isArray(data.transactions)) throw new Error('transactions is not an array');

      log(colors.cyan, `   Found ${data.transactions.length} recent transactions`);

      if (data.transactions.length > 0) {
        const txTypes = {};
        for (const tx of data.transactions) {
          txTypes[tx.type] = (txTypes[tx.type] || 0) + 1;
        }

        log(colors.blue, `   Transaction Types:`);
        for (const [type, count] of Object.entries(txTypes)) {
          log(colors.blue, `   - ${type}: ${count}`);
        }
      }

      return true;
    },
  },

  {
    name: 'Test 8: Query Market Snapshots (Analytics)',
    query: `
      query {
        marketSnapshots(first: 30, orderBy: day, orderDirection: desc) {
          id
          market { id }
          day
          totalSupplyAssets
          totalBorrowAssets
          utilizationRate
          borrowRate
          supplyRate
          timestamp
        }
      }
    `,
    validate: (data) => {
      if (!data.marketSnapshots) throw new Error('No marketSnapshots field in response');
      if (!Array.isArray(data.marketSnapshots)) throw new Error('marketSnapshots is not an array');

      log(colors.cyan, `   Found ${data.marketSnapshots.length} daily snapshots`);

      if (data.marketSnapshots.length > 0) {
        const latest = data.marketSnapshots[0];
        log(colors.blue, `   Latest snapshot: Day ${latest.day}, Utilization=${latest.utilizationRate}`);
      } else {
        log(colors.yellow, `   ⚠️  No snapshots yet (created daily by event handlers)`);
      }

      return true;
    },
  },

  {
    name: 'Test 9: Query Users',
    query: `
      query {
        users(first: 20) {
          id
          totalSuppliedUSD
          totalBorrowedUSD
          totalLiquidations
          totalLiquidationsExecuted
          firstInteraction
          lastInteraction
        }
      }
    `,
    validate: (data) => {
      if (!data.users) throw new Error('No users field in response');
      if (!Array.isArray(data.users)) throw new Error('users is not an array');

      log(colors.cyan, `   Found ${data.users.length} unique users`);

      if (data.users.length > 0) {
        let totalLiquidations = 0;
        for (const user of data.users) {
          totalLiquidations += parseInt(user.totalLiquidations || '0');
        }
        log(colors.blue, `   Total liquidations across all users: ${totalLiquidations}`);
      }

      return true;
    },
  },

  {
    name: 'Test 10: Test GraphQL Variables',
    query: `
      query TestVariables($first: Int!, $skip: Int!) {
        markets(first: $first, skip: $skip) {
          id
        }
      }
    `,
    variables: { first: 5, skip: 0 },
    validate: (data) => {
      if (!data.markets) throw new Error('No markets field in response');
      log(colors.cyan, `   Variables work correctly, got ${data.markets.length} markets`);
      return true;
    },
  },
];

// Run all tests
async function runTests() {
  log(colors.blue, '\n╔════════════════════════════════════════════════════════╗');
  log(colors.blue, '║     ISM Protocol Subgraph Integration Tests           ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════╝\n');

  log(colors.cyan, `Endpoint: ${SUBGRAPH_URL}\n`);

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const test of tests) {
    try {
      log(colors.yellow, `\n▶ ${test.name}`);

      const data = await query(test.query, test.variables);

      if (test.validate(data)) {
        log(colors.green, `  ✓ PASSED\n`);
        passed++;
      }
    } catch (error) {
      log(colors.red, `  ✗ FAILED: ${error.message}\n`);
      failed++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  log(colors.blue, '\n╔════════════════════════════════════════════════════════╗');
  log(colors.blue, '║                    Test Summary                        ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════╝\n');

  log(colors.green, `  ✓ Passed: ${passed}`);
  if (failed > 0) {
    log(colors.red, `  ✗ Failed: ${failed}`);
  }
  log(colors.cyan, `  ⏱  Duration: ${duration}s`);

  if (failed === 0) {
    log(colors.green, '\n🎉 All tests passed! Subgraph is working correctly.\n');
  } else {
    log(colors.red, `\n⚠️  ${failed} test(s) failed. Please check the errors above.\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  log(colors.red, `\n❌ Fatal error: ${error.message}\n`);
  process.exit(1);
});
