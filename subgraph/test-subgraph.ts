/**
 * TypeScript version of subgraph tests
 * Can be run with: npx tsx test-subgraph.ts
 */

import { request, gql } from 'graphql-request';

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/122239/ism-protocol/version/latest';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

// Test 1: Basic connectivity and markets
async function testMarkets(): Promise<TestResult> {
  const query = gql`
    {
      markets(first: 10) {
        id
        collateralToken {
          symbol
          decimals
        }
        borrowToken {
          symbol
          decimals
        }
        totalSupplyAssets
        totalBorrowAssets
        utilizationRate
      }
    }
  `;

  try {
    const data = await request(SUBGRAPH_URL, query);

    if (!data.markets) {
      throw new Error('No markets field in response');
    }

    log(colors.cyan, `   Found ${data.markets.length} markets`);

    if (data.markets.length > 0) {
      const market = data.markets[0];
      log(
        colors.blue,
        `   Sample: ${market.collateralToken.symbol}/${market.borrowToken.symbol}`
      );
    }

    return { name: 'Query Markets', passed: true, data };
  } catch (error: any) {
    return { name: 'Query Markets', passed: false, error: error.message };
  }
}

// Test 2: Liquidatable positions
async function testLiquidatablePositions(): Promise<TestResult> {
  const query = gql`
    {
      positions(
        where: { healthFactor_lt: "1.0", borrowedAmount_gt: "0" }
        orderBy: healthFactor
        first: 20
      ) {
        id
        user {
          id
        }
        healthFactor
        isLiquidatable
        borrowedAmount
        collateralAmount
      }
    }
  `;

  try {
    const data = await request(SUBGRAPH_URL, query);

    if (!data.positions) {
      throw new Error('No positions field in response');
    }

    log(colors.cyan, `   Found ${data.positions.length} liquidatable positions`);

    // Verify all have HF < 1.0
    for (const pos of data.positions) {
      const hf = parseFloat(pos.healthFactor);
      if (hf >= 1.0) {
        throw new Error(`Invalid HF: ${hf} (should be < 1.0)`);
      }
    }

    if (data.positions.length > 0) {
      log(colors.yellow, `   ⚠️  Liquidatable positions exist`);
    } else {
      log(colors.green, `   ✓ No liquidatable positions (healthy)`);
    }

    return { name: 'Liquidatable Positions', passed: true, data };
  } catch (error: any) {
    return { name: 'Liquidatable Positions', passed: false, error: error.message };
  }
}

// Test 3: Active auctions
async function testActiveAuctions(): Promise<TestResult> {
  const query = gql`
    {
      auctions(where: { isActive: true }, first: 10) {
        id
        borrower {
          id
        }
        collateralAmount
        debtAmount
        isActive
        startTime
        endTime
      }
    }
  `;

  try {
    const data = await request(SUBGRAPH_URL, query);

    if (!data.auctions) {
      throw new Error('No auctions field in response');
    }

    log(colors.cyan, `   Found ${data.auctions.length} active auctions`);

    // Verify all are active
    for (const auction of data.auctions) {
      if (!auction.isActive) {
        throw new Error(`Auction ${auction.id} not active`);
      }
    }

    return { name: 'Active Auctions', passed: true, data };
  } catch (error: any) {
    return { name: 'Active Auctions', passed: false, error: error.message };
  }
}

// Test 4: Liquidation history
async function testLiquidationHistory(): Promise<TestResult> {
  const query = gql`
    {
      liquidations(orderBy: timestamp, orderDirection: desc, first: 10) {
        id
        liquidator {
          id
        }
        borrower {
          id
        }
        debtRepaid
        collateralReceived
        timestamp
      }
    }
  `;

  try {
    const data = await request(SUBGRAPH_URL, query);

    if (!data.liquidations) {
      throw new Error('No liquidations field in response');
    }

    log(colors.cyan, `   Found ${data.liquidations.length} historical liquidations`);

    return { name: 'Liquidation History', passed: true, data };
  } catch (error: any) {
    return { name: 'Liquidation History', passed: false, error: error.message };
  }
}

// Test 5: Users and positions
async function testUsersAndPositions(): Promise<TestResult> {
  const query = gql`
    {
      users(first: 10) {
        id
        totalLiquidations
        totalLiquidationsExecuted
      }
      positions(first: 10) {
        id
        healthFactor
        isLiquidatable
      }
    }
  `;

  try {
    const data = await request(SUBGRAPH_URL, query);

    if (!data.users || !data.positions) {
      throw new Error('Missing users or positions in response');
    }

    log(colors.cyan, `   Found ${data.users.length} users, ${data.positions.length} positions`);

    return { name: 'Users & Positions', passed: true, data };
  } catch (error: any) {
    return { name: 'Users & Positions', passed: false, error: error.message };
  }
}

// Test 6: GraphQL variables
async function testVariables(): Promise<TestResult> {
  const query = gql`
    query TestVariables($first: Int!) {
      markets(first: $first) {
        id
      }
    }
  `;

  try {
    const data = await request(SUBGRAPH_URL, query, { first: 3 });

    if (!data.markets) {
      throw new Error('No markets in response');
    }

    log(colors.cyan, `   Variables work, got ${data.markets.length} markets`);

    return { name: 'GraphQL Variables', passed: true, data };
  } catch (error: any) {
    return { name: 'GraphQL Variables', passed: false, error: error.message };
  }
}

// Test 7: Complex filtering
async function testComplexFiltering(): Promise<TestResult> {
  const query = gql`
    {
      positions(
        where: { borrowedAmount_gt: "0" }
        orderBy: healthFactor
        orderDirection: asc
        first: 5
      ) {
        id
        healthFactor
        borrowedAmount
      }
    }
  `;

  try {
    const data = await request(SUBGRAPH_URL, query);

    if (!data.positions) {
      throw new Error('No positions in response');
    }

    // Verify sorting
    for (let i = 1; i < data.positions.length; i++) {
      const prevHF = parseFloat(data.positions[i - 1].healthFactor);
      const currHF = parseFloat(data.positions[i].healthFactor);
      if (currHF < prevHF) {
        throw new Error('Positions not sorted correctly');
      }
    }

    log(colors.cyan, `   Filtering & sorting work correctly`);

    return { name: 'Complex Filtering', passed: true, data };
  } catch (error: any) {
    return { name: 'Complex Filtering', passed: false, error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  log(colors.blue, '\n╔════════════════════════════════════════════════════════╗');
  log(colors.blue, '║        ISM Protocol Subgraph Tests (TypeScript)        ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════╝\n');

  log(colors.cyan, `Endpoint: ${SUBGRAPH_URL}\n`);

  const tests = [
    testMarkets,
    testLiquidatablePositions,
    testActiveAuctions,
    testLiquidationHistory,
    testUsersAndPositions,
    testVariables,
    testComplexFiltering,
  ];

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const test of tests) {
    log(colors.yellow, `\n▶ Running: ${test.name}...`);
    const result = await test();
    results.push(result);

    if (result.passed) {
      log(colors.green, `  ✓ PASSED`);
    } else {
      log(colors.red, `  ✗ FAILED: ${result.error}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  log(colors.blue, '\n╔════════════════════════════════════════════════════════╗');
  log(colors.blue, '║                    Test Summary                        ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════╝\n');

  log(colors.green, `  ✓ Passed: ${passed}/${tests.length}`);
  if (failed > 0) {
    log(colors.red, `  ✗ Failed: ${failed}/${tests.length}`);
  }
  log(colors.cyan, `  ⏱  Duration: ${duration}s`);

  if (failed === 0) {
    log(colors.green, '\n🎉 All tests passed! Subgraph is working correctly.\n');
  } else {
    log(colors.red, `\n⚠️  ${failed} test(s) failed. Check errors above.\n`);
    process.exit(1);
  }
}

// Run
runAllTests().catch((error) => {
  log(colors.red, `\n❌ Fatal error: ${error.message}\n`);
  process.exit(1);
});
