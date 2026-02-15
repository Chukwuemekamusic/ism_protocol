# ISM Protocol - UI/UX Improvements Roadmap

> **Status**: Ready for implementation
> **Priority**: High - These improvements will significantly enhance user experience and reduce transaction failures

---

## 🎯 Priority 1: Critical UX Improvements (Implement First)

### 1. **Max Safe Borrow Amount Display** ✨
**Problem**: Users don't know how much they can safely borrow without manual calculation.

**Solution**:
```typescript
// Display below borrow input
Max: 31.35 USDC (75% LTV)
Available Liquidity: 10 USDC
```

**Implementation**:
- **Contract**: Already has `getMaxBorrow(address user)` function ✅
- **Frontend**: Call this function and display result
- **File**: `frontend/components/markets/SupplyBorrowForm.tsx`
- **Location**: Below borrow input field

**Code Snippet**:
```typescript
{mode === 'borrow' && (
  <div className="text-sm text-gray-500">
    Max: {formatUnits(userPosition.maxBorrow, market.borrowDecimals)} {borrowSymbol}
    {' '}(75% LTV)
  </div>
)}
```

---

### 2. **Max Safe Withdrawable Collateral Display** ✨
**Problem**: Users with borrows can't withdraw all collateral, but don't know the safe limit.

**Solution**:
```typescript
// Display below withdraw collateral input
Max Safe Withdrawal: 0.015 WETH (maintains HF > 1.0)
Total Collateral: 0.02 WETH
```

**Implementation Needed**:

#### A. Add Contract Function
**File**: `contracts/src/core/LendingPool.sol`

```solidity
/// @notice Calculate maximum collateral that can be withdrawn while maintaining health
/// @param user Address of the user
/// @return Maximum amount of collateral that can be safely withdrawn
function getMaxWithdrawCollateral(address user) external view returns (uint256) {
    Position memory pos = positions[user];

    // If no borrows, can withdraw everything
    if (pos.borrowShares == 0) {
        return pos.collateralAmount;
    }

    // Need to maintain: (collateralValue * liquidationThreshold) / debtValue >= 1.0
    // Therefore: collateralValue >= debtValue / liquidationThreshold

    uint256 debtValue = _getBorrowValueWithAccrual(pos.borrowShares);
    uint256 minCollateralValue = debtValue.divWadUp(liquidationThreshold);

    uint256 currentCollateralValue = _getCollateralValue(pos.collateralAmount);

    // Already at or below minimum required
    if (currentCollateralValue <= minCollateralValue) {
        return 0;
    }

    // Calculate excess collateral value
    uint256 excessValue = currentCollateralValue - minCollateralValue;

    // Convert value back to collateral token amount
    uint256 collateralPrice = _getPrice(address(collateralToken));
    uint256 maxAmount = excessValue * (10 ** collateralDecimals) / collateralPrice;

    // Cap at user's actual collateral
    return MathLib.min(maxAmount, pos.collateralAmount);
}
```

#### B. Add to Interface
**File**: `contracts/src/interfaces/ILendingPool.sol`

```solidity
/// @notice Get maximum withdrawable collateral for a user
function getMaxWithdrawCollateral(address user) external view returns (uint256);
```

#### C. Update Frontend Hook
**File**: `frontend/hooks/useUserPosition.ts`

```typescript
{
  address: marketAddress,
  abi: LENDING_POOL_ABI,
  functionName: 'getMaxWithdrawCollateral',
  args: [address as `0x${string}`],
}
```

#### D. Display in UI
**File**: `frontend/components/markets/SupplyBorrowForm.tsx`

```typescript
{mode === 'withdrawCollateral' && userPosition.borrowed > 0n && (
  <div className="text-sm text-gray-500">
    Max Safe Withdrawal: {formatUnits(userPosition.maxWithdrawCollateral, market.collateralDecimals)} {collateralSymbol}
  </div>
)}
```

---

### 3. **Health Factor Visualization** ⚡ CRITICAL
**Problem**: Health factor is the most important safety metric but not prominently displayed.

**Solution**: Visual progress bar with color-coded zones

```
Current Health Factor: 11.12
[██████████░░░░░░░░░░] Very Safe

After Action: 8.45
[████████░░░░░░░░░░░░] Safe
```

**Color Zones**:
- 🟢 **Green (Very Safe)**: HF > 2.0
- 🟡 **Yellow (Safe)**: 1.5 < HF < 2.0
- 🟠 **Orange (Caution)**: 1.2 < HF < 1.5
- 🔴 **Red (At Risk)**: 1.0 < HF < 1.2
- ⚠️ **Critical (Liquidatable)**: HF < 1.0

**Implementation**:
**File**: `frontend/components/markets/HealthFactorDisplay.tsx` (new file)

```typescript
interface HealthFactorDisplayProps {
  healthFactor: number;
  afterHealthFactor?: number; // For previews
  size?: 'sm' | 'md' | 'lg';
}

export function HealthFactorDisplay({
  healthFactor,
  afterHealthFactor,
  size = 'md'
}: HealthFactorDisplayProps) {
  const getStatus = (hf: number) => {
    if (hf >= 2.0) return { label: 'Very Safe', color: 'green', emoji: '🟢' };
    if (hf >= 1.5) return { label: 'Safe', color: 'yellow', emoji: '🟡' };
    if (hf >= 1.2) return { label: 'Caution', color: 'orange', emoji: '🟠' };
    if (hf >= 1.0) return { label: 'At Risk', color: 'red', emoji: '🔴' };
    return { label: 'Liquidatable', color: 'critical', emoji: '⚠️' };
  };

  const status = getStatus(healthFactor);
  const percentage = Math.min((healthFactor / 3.0) * 100, 100); // Cap at 3.0 for display

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">
          Health Factor: {healthFactor.toFixed(2)}
        </span>
        <span className={`text-xs px-2 py-1 rounded bg-${status.color}-100 text-${status.color}-800`}>
          {status.emoji} {status.label}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`bg-${status.color}-500 h-2 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {afterHealthFactor && (
        <div className="text-xs text-gray-600">
          After action: {afterHealthFactor.toFixed(2)} {getStatus(afterHealthFactor).emoji}
        </div>
      )}
    </div>
  );
}
```

---

### 4. **Smart MAX Button Logic** 💡
**Problem**: MAX button doesn't account for actual limits (liquidity, health factor, etc.)

**Current Behavior** ❌:
- Deposit: Wallet balance ✅ (correct)
- Withdraw: Total deposited ❌ (should check liquidity)
- Borrow: Total deposited ❌ (completely wrong!)
- Deposit Collateral: Wallet balance ✅ (correct)
- Withdraw Collateral: Total collateral ❌ (dangerous with borrows!)
- Repay: Total deposited ❌ (should be min of debt and balance)

**Improved Behavior** ✅:

**File**: `frontend/components/markets/SupplyBorrowForm.tsx`

```typescript
const handleMaxClick = async () => {
  switch (mode) {
    case 'deposit':
      // Use wallet balance
      if (borrowTokenBalance) {
        setAmount(formatUnits(borrowTokenBalance.value, borrowTokenBalance.decimals));
      }
      break;

    case 'withdraw':
      // Use minimum of deposited amount and available liquidity
      const deposited = await contract.read.balanceOfUnderlying([address]);
      const availableLiquidity = totalSupplyAssets - totalBorrowAssets;
      const maxWithdraw = min(deposited, availableLiquidity);
      setAmount(formatUnits(maxWithdraw, market.borrowDecimals));
      break;

    case 'depositCollateral':
      // Use wallet balance
      if (collateralTokenBalance) {
        setAmount(formatUnits(collateralTokenBalance.value, collateralTokenBalance.decimals));
      }
      break;

    case 'withdrawCollateral':
      // Use contract's getMaxWithdrawCollateral
      if (userPosition.borrowed > 0n) {
        // Has borrows - use safe maximum
        const maxWithdraw = await contract.read.getMaxWithdrawCollateral([address]);
        setAmount(formatUnits(maxWithdraw, market.collateralDecimals));
      } else {
        // No borrows - can withdraw all
        setAmount(formatUnits(userPosition.collateral, market.collateralDecimals));
      }
      break;

    case 'borrow':
      // Use contract's getMaxBorrow
      const maxBorrow = await contract.read.getMaxBorrow([address]);
      // Also check available liquidity
      const availableToBorrow = min(maxBorrow, availableLiquidity);
      setAmount(formatUnits(availableToBorrow, market.borrowDecimals));
      break;

    case 'repay':
      // Use minimum of debt and wallet balance
      if (borrowTokenBalance) {
        const debt = userPosition.borrowed;
        const maxRepay = min(debt, borrowTokenBalance.value);
        setAmount(formatUnits(maxRepay, market.borrowDecimals));
      }
      break;
  }
};
```

---

### 5. **Action Preview (Before Confirmation)** 🔮
**Problem**: Users don't see impact until after transaction completes.

**Solution**: Show predicted outcome before transaction

**Implementation**:
**File**: `frontend/components/markets/TransactionPreview.tsx` (new file)

```typescript
interface TransactionPreviewProps {
  mode: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'depositCollateral' | 'withdrawCollateral';
  amount: string;
  currentPosition: UserPosition;
  marketData: MarketData;
}

export function TransactionPreview({ mode, amount, currentPosition, marketData }: TransactionPreviewProps) {
  const amountBigInt = parseUnits(amount || '0', getDecimals(mode));

  // Calculate new position
  const newPosition = calculateNewPosition(currentPosition, mode, amountBigInt);
  const currentHF = calculateHealthFactor(currentPosition);
  const newHF = calculateHealthFactor(newPosition);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="font-medium mb-3">Transaction Preview</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Current State */}
        <div>
          <div className="text-xs text-gray-500 mb-2">Current</div>
          <div className="space-y-1 text-sm">
            <div>Collateral: {formatUnits(currentPosition.collateral, 18)} WETH</div>
            <div>Debt: {formatUnits(currentPosition.borrowed, 6)} USDC</div>
            <div>HF: {currentHF.toFixed(2)}</div>
          </div>
        </div>

        {/* New State */}
        <div>
          <div className="text-xs text-gray-500 mb-2">After</div>
          <div className="space-y-1 text-sm">
            <div>
              Collateral: {formatUnits(newPosition.collateral, 18)} WETH
              {newPosition.collateral !== currentPosition.collateral && (
                <span className="text-xs text-gray-500 ml-1">
                  ({newPosition.collateral > currentPosition.collateral ? '+' : ''}
                  {formatUnits(newPosition.collateral - currentPosition.collateral, 18)})
                </span>
              )}
            </div>
            <div>
              Debt: {formatUnits(newPosition.borrowed, 6)} USDC
              {newPosition.borrowed !== currentPosition.borrowed && (
                <span className="text-xs text-gray-500 ml-1">
                  ({newPosition.borrowed > currentPosition.borrowed ? '+' : ''}
                  {formatUnits(newPosition.borrowed - currentPosition.borrowed, 6)})
                </span>
              )}
            </div>
            <div>HF: {newHF.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Safety Check */}
      {newHF < 1.0 ? (
        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
          ⚠️ This action would make your position liquidatable!
        </div>
      ) : newHF < 1.5 ? (
        <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded text-sm text-orange-800">
          ⚠️ Warning: Your health factor will be low. Position is at higher risk.
        </div>
      ) : (
        <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-sm text-green-800">
          ✓ Safe to proceed
        </div>
      )}
    </div>
  );
}
```

**Usage in Form**:
```typescript
{amount && parseFloat(amount) > 0 && (
  <TransactionPreview
    mode={mode}
    amount={amount}
    currentPosition={userPosition}
    marketData={marketData}
  />
)}
```

---

## 🎨 Priority 2: Enhanced UX (Next Phase)

### 6. **Better Error Messages** 📝
**Problem**: Generic error messages don't help users understand what went wrong.

**Implementation**:
**File**: `frontend/lib/utils/errorMessages.ts` (new file)

```typescript
export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  // Validation Errors
  'ZeroAmount': 'Amount cannot be zero. Please enter a valid amount.',
  'ZeroAddress': 'Invalid address provided.',

  // Balance Errors
  'InsufficientBalance': 'You don\'t have enough balance for this transaction.',
  'InsufficientCollateral': 'You don\'t have enough collateral deposited.',

  // Liquidity Errors
  'InsufficientLiquidity': 'Not enough liquidity in the pool. Try a smaller amount or wait for more suppliers.',

  // Health Factor Errors
  'WouldBeUndercollateralized': 'This action would make your position unhealthy. You need more collateral or less debt to maintain a safe health factor.',

  // Debt Errors
  'NoDebt': 'You don\'t have any debt to repay.',

  // Oracle Errors
  'BothOraclesFailed': 'Price oracle temporarily unavailable. Please refresh and try again in a moment.',
  'OracleNotConfigured': 'Price feed not configured for this asset.',
  'StalePrice': 'Price data is outdated. Please refresh and try again.',
  'PriceDeviationTooHigh': 'Price sources disagree significantly. Please try again later.',

  // Permission Errors
  'OnlyLiquidator': 'This function can only be called by the liquidator contract.',
  'OnlyFactory': 'This function can only be called by the factory contract.',

  // Initialization Errors
  'AlreadyInitialized': 'This contract has already been initialized.',

  // Default
  'default': 'Transaction failed. Please try again or contact support if the issue persists.',
};

export function parseContractError(error: Error): string {
  const errorMessage = error.message;

  // Try to extract custom error name
  for (const [errorName, message] of Object.entries(CONTRACT_ERROR_MESSAGES)) {
    if (errorMessage.includes(errorName)) {
      return message;
    }
  }

  // Check for common Web3 errors
  if (errorMessage.includes('user rejected')) {
    return 'Transaction was cancelled.';
  }
  if (errorMessage.includes('insufficient funds')) {
    return 'Insufficient ETH for gas fees.';
  }

  return CONTRACT_ERROR_MESSAGES.default;
}
```

**Usage**:
```typescript
{error && (
  <div className="error-message">
    {parseContractError(error)}
  </div>
)}
```

---

### 7. **Position Overview Card** 📊
**Problem**: Users have to navigate between tabs to see their full position.

**Solution**: Persistent overview card

**Implementation**:
**File**: `frontend/components/markets/PositionOverview.tsx` (new file)

```typescript
export function PositionOverview({ userPosition, marketData }: Props) {
  const collateralValue = userPosition.collateral * marketData.collateralPrice;
  const debtValue = userPosition.borrowed * marketData.borrowPrice;
  const healthFactor = calculateHealthFactor(userPosition);
  const maxBorrow = userPosition.maxBorrow * marketData.borrowPrice;
  const borrowCapacityUsed = (debtValue / maxBorrow) * 100;
  const liquidationPrice = calculateLiquidationPrice(userPosition, marketData);

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold mb-4">Your Position</h3>

      <div className="space-y-3">
        {/* Collateral */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Collateral</span>
          <span className="font-medium">
            {formatUnits(userPosition.collateral, 18)} WETH
            <span className="text-xs text-gray-500 ml-2">
              (${collateralValue.toFixed(2)})
            </span>
          </span>
        </div>

        {/* Debt */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Borrowed</span>
          <span className="font-medium">
            {formatUnits(userPosition.borrowed, 6)} USDC
            <span className="text-xs text-gray-500 ml-2">
              (${debtValue.toFixed(2)})
            </span>
          </span>
        </div>

        {/* Health Factor */}
        <div className="pt-2 border-t">
          <HealthFactorDisplay healthFactor={healthFactor} size="sm" />
        </div>

        {/* Liquidation Price */}
        {userPosition.borrowed > 0n && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Liquidation Price</span>
            <span className="font-medium text-orange-600">
              ${liquidationPrice.toFixed(2)} / ETH
            </span>
          </div>
        )}

        {/* Borrow Capacity */}
        <div>
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-gray-600">Borrow Capacity</span>
            <span className="text-xs text-gray-500">
              ${debtValue.toFixed(2)} / ${maxBorrow.toFixed(2)} ({borrowCapacityUsed.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                borrowCapacityUsed > 80 ? 'bg-red-500' :
                borrowCapacityUsed > 60 ? 'bg-orange-500' :
                borrowCapacityUsed > 40 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${borrowCapacityUsed}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 8. **Warnings & Confirmations** ⚠️
**Problem**: No warnings for risky actions.

**Solution**: Show warnings and require extra confirmation for dangerous operations

**Implementation**:
**File**: `frontend/components/markets/RiskWarning.tsx` (new file)

```typescript
interface RiskWarningProps {
  currentHF: number;
  newHF: number;
  onProceed: () => void;
  onCancel: () => void;
}

export function RiskWarning({ currentHF, newHF, onProceed, onCancel }: RiskWarningProps) {
  const getRiskLevel = (hf: number) => {
    if (hf < 1.0) return 'critical';
    if (hf < 1.2) return 'high';
    if (hf < 1.5) return 'moderate';
    return 'low';
  };

  const riskLevel = getRiskLevel(newHF);

  if (riskLevel === 'low') return null; // No warning needed

  return (
    <div className={`border rounded-lg p-4 ${
      riskLevel === 'critical' ? 'bg-red-50 border-red-300' :
      riskLevel === 'high' ? 'bg-orange-50 border-orange-300' :
      'bg-yellow-50 border-yellow-300'
    }`}>
      <div className="flex items-start space-x-3">
        <span className="text-2xl">
          {riskLevel === 'critical' ? '⛔' : '⚠️'}
        </span>
        <div className="flex-1">
          <h4 className="font-semibold mb-2">
            {riskLevel === 'critical' ? 'Critical Risk!' :
             riskLevel === 'high' ? 'High Risk Warning' :
             'Caution'}
          </h4>
          <p className="text-sm mb-3">
            {riskLevel === 'critical' ? (
              <>This action would make your position <strong>liquidatable</strong> (Health Factor &lt; 1.0).
              Your collateral will be at immediate risk of seizure.</>
            ) : riskLevel === 'high' ? (
              <>This action will reduce your health factor to <strong>{newHF.toFixed(2)}</strong>,
              putting your position at high risk of liquidation.</>
            ) : (
              <>This action will reduce your health factor to <strong>{newHF.toFixed(2)}</strong>.
              Consider maintaining a higher health factor for safety.</>
            )}
          </p>
          <div className="flex space-x-2">
            {riskLevel === 'critical' ? (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel (Recommended)
              </button>
            ) : (
              <>
                <button
                  onClick={onProceed}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  I Understand the Risk
                </button>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 💎 Priority 3: Advanced Features (Future)

### 9. **Liquidation Price Calculator** 🎯
**Problem**: Users don't know at what price they'll be liquidated.

**Formula**:
```typescript
function calculateLiquidationPrice(position: UserPosition, market: MarketData): number {
  // At liquidation: (collateral * price * liquidationThreshold) / debt = 1.0
  // Therefore: price = debt / (collateral * liquidationThreshold)

  const debtValue = position.borrowed * market.borrowPrice;
  const liquidationThreshold = 0.80; // 80%

  const liquidationPrice = debtValue / (position.collateral * liquidationThreshold);

  return liquidationPrice;
}
```

**Display**:
```
Liquidation Price: $112.50 per ETH
Current Price: $2,093.00 per ETH
Safety Margin: 94.6% ↓ (price must drop 94.6% to reach liquidation)

Price Alert: 🔔 Get notified when ETH < $150
```

---

### 10. **APY Display** 💰
**Problem**: Users don't see the interest rates they're earning/paying.

**Implementation**:
```typescript
// Calculate from interest rate model
const supplyAPY = calculateSupplyAPY(utilization, interestRateModel);
const borrowAPY = calculateBorrowAPY(utilization, interestRateModel);

// For users with positions
const userSupplyAPY = (deposited * supplyAPY) / deposited;
const userBorrowAPY = (borrowed * borrowAPY) / borrowed;
const netAPY = userSupplyAPY - userBorrowAPY;
```

**Display**:
```
Supply APY: 4.2% 📈
Borrow APY: 6.8% 📉

Your Position:
• Earning: $0.42/year on deposits
• Paying: $0.52/year on borrows
• Net: -$0.10/year (-0.52% APY)
```

---

### 11. **Gas Estimation Display** ⛽
**Problem**: Users don't know transaction costs before submitting.

**Implementation**:
```typescript
const estimatedGas = await contract.estimateGas.borrow([amount]);
const gasPrice = await provider.getGasPrice();
const gasCost = estimatedGas * gasPrice;

// Display
Estimated Gas: ~0.0001 ETH ($0.21)
```

---

### 12. **Transaction History** 📜
**Problem**: No record of past transactions.

**Implementation**:
- Index events (Deposit, Withdraw, Borrow, Repay, etc.)
- Store in local storage or backend
- Display in a table with filters

```
Recent Activity
───────────────────────────────────────
✓ Borrowed 3 USDC         2 hours ago
✓ Deposited 0.02 WETH     1 day ago
✓ Supplied 10 USDC        3 days ago
```

---

### 13. **Mobile Responsive Design** 📱
**Current Status**: Desktop-focused
**Needed**: Mobile-first responsive design

**Key Changes**:
- Stack form elements vertically on mobile
- Larger touch targets for buttons
- Simplified navigation
- Swipeable tabs instead of buttons

---

### 14. **Dark Mode** 🌙
**Implementation**: Use Tailwind CSS dark mode classes

```typescript
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  {/* Content */}
</div>
```

---

## 📝 Implementation Checklist

### Phase 1: Critical (Week 1)
- [ ] Add `getMaxWithdrawCollateral()` to LendingPool contract
- [ ] Update ILendingPool interface
- [ ] Write tests for new function
- [ ] Deploy updated contract (or add to next deployment)
- [ ] Update frontend to fetch max withdrawable collateral
- [ ] Display max borrow amount in borrow form
- [ ] Display max withdrawable in withdraw collateral form
- [ ] Fix MAX button logic for all operations
- [ ] Add health factor display component
- [ ] Add transaction preview component
- [ ] Test all changes thoroughly

### Phase 2: Enhanced UX (Week 2)
- [ ] Create error message parsing utility
- [ ] Update all error displays to use better messages
- [ ] Create position overview card component
- [ ] Add position overview to market page
- [ ] Create risk warning component
- [ ] Add risk warnings before risky transactions
- [ ] Test warning flows

### Phase 3: Advanced Features (Week 3-4)
- [ ] Implement liquidation price calculator
- [ ] Add APY calculations and display
- [ ] Add gas estimation
- [ ] Create transaction history component
- [ ] Improve mobile responsiveness
- [ ] Add dark mode support
- [ ] Comprehensive testing

---

## 🧪 Testing Requirements

### Contract Tests
```solidity
// Test getMaxWithdrawCollateral
function test_getMaxWithdrawCollateral_noDebt() public { ... }
function test_getMaxWithdrawCollateral_withDebt() public { ... }
function test_getMaxWithdrawCollateral_atLiquidationThreshold() public { ... }
```

### Frontend Tests
- [ ] MAX button correctly calculates for each operation
- [ ] Health factor displays correct colors for all ranges
- [ ] Transaction preview shows accurate predictions
- [ ] Error messages display correctly for each error type
- [ ] Risk warnings appear at correct thresholds
- [ ] Position overview updates in real-time

---

## 📚 Resources

### Design References
- **Aave**: Health factor display, position management
- **Compound**: Supply/borrow interface simplicity
- **Maker**: Liquidation price visualization
- **Uniswap**: Transaction preview and confirmations

### Libraries to Consider
- **recharts**: For APY charts and historical data
- **react-tooltip**: For hover explanations
- **framer-motion**: For smooth animations
- **react-hot-toast**: For better toast notifications

---

## 🎯 Success Metrics

After implementation, measure:
1. **Reduced failed transactions** - Fewer "WouldBeUndercollateralized" errors
2. **Increased user confidence** - More successful MAX button usage
3. **Better position health** - Average HF stays higher
4. **Reduced support queries** - Fewer "why did my transaction fail?" questions
5. **Higher engagement** - More transactions per user

---

## 💡 Additional Ideas (Future Considerations)

1. **Multi-collateral support**: Allow multiple collateral types in one position
2. **Automated health factor maintenance**: Auto-repay when HF drops
3. **Stop-loss orders**: Automatically close position if price drops below threshold
4. **Collateral swap**: Swap one collateral type for another without closing position
5. **Leverage trading**: Recursive borrowing for leverage (advanced users)
6. **Position templates**: Save and reuse position configurations
7. **Social features**: Share positions, leaderboards for best health factors
8. **Notifications**: Email/push notifications for liquidation risk
9. **Simulation mode**: Practice with fake money before real transactions
10. **Guided tutorials**: Interactive walkthrough for new users

---

**Last Updated**: 2026-02-15
**Status**: Ready for implementation
**Priority**: Start with Phase 1 (Critical improvements)
