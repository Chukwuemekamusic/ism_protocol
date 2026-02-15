# Withdraw Collateral - Issues and Future Improvements

## Current Issue (Immediate Fix Needed)
User attempting to withdraw 0.005 WETH from 0.02 WETH total with health factor of 11.12 is failing.

### Immediate Investigation Needed
1. Check exact error message from failed transaction
2. Verify amount is being sent with correct decimals (18 for WETH)
3. Check if oracle prices are working for health factor calculation during withdrawal
4. Test withdrawal with diagnostic script to see exact revert reason

## Frontend Issues Identified

### Issue 1: No Validation in withdrawCollateral Handler
**Location:** `frontend/components/markets/SupplyBorrowForm.tsx:174-176`

```typescript
case 'withdrawCollateral':
  withdrawCollateralHook.withdrawCollateral(amount, market.collateralDecimals);
  break;
```

**Problem:** No validation before calling contract (unlike depositCollateral and repay which check balances/allowances)

### Issue 2: MAX Button Doesn't Account for Borrows
**Location:** `frontend/components/markets/SupplyBorrowForm.tsx:112-114`

```typescript
case 'withdrawCollateral':
  setAmount(formatUnits(userPosition.collateral, market.collateralDecimals));
  break;
```

**Problem:** Sets amount to FULL collateral balance, ignoring:
- Active borrows requiring minimum collateral
- Health factor requirements
- Safe withdrawal limits

### Issue 3: No getMaxWithdrawCollateral in Contract
**Location:** `contracts/src/core/LendingPool.sol`

**Missing:** Function to calculate maximum safe withdrawal amount while maintaining HF >= 1.0

The contract has `getMaxBorrow()` but not an equivalent for withdrawals.

## Future Improvements (UI/UX)

### 1. Add Contract Function
```solidity
/// @notice Calculate maximum collateral that can be withdrawn
function getMaxWithdrawCollateral(address user) external view returns (uint256) {
    Position memory pos = positions[user];
    if (pos.borrowShares == 0) return pos.collateralAmount;

    // Calculate minimum collateral needed for HF >= 1.0
    uint256 debtValue = _getBorrowValueWithAccrual(pos.borrowShares);
    uint256 minCollateralValue = debtValue.divWadUp(liquidationThreshold);
    uint256 currentCollateralValue = _getCollateralValue(pos.collateralAmount);

    if (currentCollateralValue <= minCollateralValue) return 0;

    uint256 excessValue = currentCollateralValue - minCollateralValue;
    uint256 collateralPrice = _getPrice(address(collateralToken));
    uint256 maxAmount = excessValue * (10 ** collateralDecimals) / collateralPrice;

    return MathLib.min(maxAmount, pos.collateralAmount);
}
```

### 2. Update Frontend MAX Button
```typescript
case 'withdrawCollateral':
  if (userPosition.borrowed > 0n) {
    // Use contract's getMaxWithdrawCollateral
    const maxWithdraw = await contract.read.getMaxWithdrawCollateral([address]);
    setAmount(formatUnits(maxWithdraw, market.collateralDecimals));
  } else {
    setAmount(formatUnits(userPosition.collateral, market.collateralDecimals));
  }
  break;
```

### 3. Add Health Factor Display
Show user:
- Current health factor
- Health factor after withdrawal
- Warning if HF would drop below safe threshold (e.g., 1.5)

### 4. Add Withdrawal Validation
```typescript
case 'withdrawCollateral': {
  const amountBigInt = parseTokenInput(amount, market.collateralDecimals);

  // Check if user has enough collateral
  if (amountBigInt > userPosition.collateral) {
    alert('Insufficient collateral balance');
    return;
  }

  // If user has borrows, warn about health factor
  if (userPosition.borrowed > 0n) {
    // Could calculate estimated new HF here
    const confirm = window.confirm(
      'You have active borrows. Withdrawing collateral will reduce your health factor. Continue?'
    );
    if (!confirm) return;
  }

  withdrawCollateralHook.withdrawCollateral(amount, market.collateralDecimals);
  break;
}
```

### 5. Better Error Messages
```typescript
{withdrawCollateralHook.error && (
  <div className="error-message">
    {withdrawCollateralHook.error.message?.includes('WouldBeUndercollateralized')
      ? 'This withdrawal would make your position unhealthy. You need more collateral to cover your borrows.'
      : withdrawCollateralHook.error.message?.includes('InsufficientBalance')
      ? 'You don\'t have enough collateral deposited.'
      : 'Withdrawal failed. Please try again.'}
  </div>
)}
```

### 6. Add Health Factor Indicator
Visual progress bar showing:
- Green zone: HF > 2.0 (Very Safe)
- Yellow zone: 1.5 < HF < 2.0 (Safe)
- Orange zone: 1.2 < HF < 1.5 (Caution)
- Red zone: 1.0 < HF < 1.2 (Risky)
- Critical: HF < 1.0 (Liquidatable)

## Files to Modify (When Implementing)

### Contracts
- `contracts/src/interfaces/ILendingPool.sol` - Add getMaxWithdrawCollateral to interface
- `contracts/src/core/LendingPool.sol` - Implement getMaxWithdrawCollateral
- `contracts/test/unit/LendingPool.t.sol` - Add tests

### Frontend
- `frontend/hooks/useUserPosition.ts` - Fetch maxWithdrawCollateral
- `frontend/components/markets/SupplyBorrowForm.tsx` - Update MAX button and add validation
- `frontend/components/markets/HealthFactorIndicator.tsx` - New component (optional)

## Testing Checklist
- [ ] Withdraw small amount with no borrows
- [ ] Withdraw small amount with active borrows (HF stays > 1.0)
- [ ] Attempt to withdraw all collateral with borrows (should fail with clear error)
- [ ] MAX button with no borrows (should set to full amount)
- [ ] MAX button with borrows (should set to safe maximum)
- [ ] Withdrawal that would reduce HF to exactly 1.0 (boundary test)
- [ ] Withdrawal with stale oracle prices
