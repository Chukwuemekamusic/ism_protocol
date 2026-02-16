# Quick Start: New UI Components

> Fast reference guide for using the new ISM Protocol UI components

## 🚀 Quick Import

```typescript
// Import all at once
import {
  HealthFactorDisplay,
  HealthFactorBadge,
  TransactionPreview,
  RiskWarning,
  RiskIndicator,
  PositionOverview,
  SupplyBorrowFormEnhanced,
} from '@/components/markets';

// Import error utilities
import {
  parseContractError,
  getErrorTitle,
  isCriticalError,
} from '@/lib/utils/errorMessages';
```

## 📦 Component Cheat Sheet

### 1. Health Factor Display
```tsx
// Full display with bar
<HealthFactorDisplay
  healthFactor={2.5}
  afterHealthFactor={1.8}  // Optional preview
  size="md"                // 'sm' | 'md' | 'lg'
  showBar={true}
/>

// Compact badge
<HealthFactorBadge healthFactor={1.5} />
```

### 2. Transaction Preview
```tsx
<TransactionPreview
  mode="borrow"              // Action type
  amount="5.0"               // String amount
  currentPosition={position}
  marketData={{
    collateralPrice: 2093000000000000000000n,
    borrowPrice: 1000000000000000000n,
    collateralDecimals: 18,
    borrowDecimals: 6,
    liquidationThreshold: 8000,
  }}
  collateralSymbol="WETH"
  borrowSymbol="USDC"
/>
```

### 3. Risk Warning
```tsx
<RiskWarning
  currentHF={2.0}
  newHF={1.1}
  onProceed={() => handleTransaction()}
  onCancel={() => setShowWarning(false)}
/>

// Or inline indicator
<RiskIndicator healthFactor={1.5} />
```

### 4. Position Overview
```tsx
<PositionOverview
  userPosition={{
    supplied: 10000000n,
    collateral: 20000000000000000n,
    borrowed: 3000000n,
    healthFactor: 11.12,
    maxBorrow: 31500000n,
  }}
  marketData={{
    collateralPrice: 2093000000000000000000n,
    borrowPrice: 1000000000000000000n,
    collateralDecimals: 18,
    borrowDecimals: 6,
  }}
  collateralSymbol="WETH"
  borrowSymbol="USDC"
/>
```

### 5. Enhanced Form
```tsx
<SupplyBorrowFormEnhanced
  marketAddress="0x..."
  market={marketData}
  userPosition={userPosition}
  collateralSymbol="WETH"
  borrowSymbol="USDC"
  collateralPrice={2093000000000000000000n}
  borrowPrice={1000000000000000000n}
/>
```

## 🔧 Error Handling

```tsx
// Get the current error from hooks
const error = depositHook.error || borrowHook.error;

// Display with enhanced messages
{error && (
  <div className={`
    p-4 rounded-lg
    ${isCriticalError(error) ? 'bg-red-50' : 'bg-orange-50'}
  `}>
    <div className="font-semibold">
      {getErrorTitle(error)}
    </div>
    <div className="text-sm">
      {parseContractError(error)}
    </div>
  </div>
)}
```

## 📋 Common Patterns

### Pattern 1: Full Market Page
```tsx
export default function MarketPage() {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <PositionOverview {...props} />
      </div>
      <div className="lg:col-span-1">
        <SupplyBorrowFormEnhanced {...props} />
      </div>
    </div>
  );
}
```

### Pattern 2: Dashboard with Health Factor
```tsx
export default function Dashboard() {
  return (
    <div className="space-y-6">
      {markets.map((market) => (
        <div key={market.address} className="border rounded-lg p-4">
          <div className="flex justify-between">
            <h3>{market.name}</h3>
            <HealthFactorBadge
              healthFactor={market.userPosition.healthFactor}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 3: Transaction Flow with Preview
```tsx
const [amount, setAmount] = useState('');
const [showWarning, setShowWarning] = useState(false);

// Calculate new HF
const newHF = calculateNewHealthFactor(amount);

return (
  <>
    <input value={amount} onChange={(e) => setAmount(e.target.value)} />

    {/* Show preview */}
    {amount && (
      <TransactionPreview
        mode="borrow"
        amount={amount}
        {...otherProps}
      />
    )}

    {/* Show warning if risky */}
    {newHF < 1.5 && showWarning && (
      <RiskWarning
        currentHF={currentPosition.healthFactor}
        newHF={newHF}
        onProceed={handleTransaction}
        onCancel={() => setShowWarning(false)}
      />
    )}

    <button onClick={() => {
      if (newHF < 1.5) {
        setShowWarning(true);
      } else {
        handleTransaction();
      }
    }}>
      Submit
    </button>
  </>
);
```

## 🎨 Styling Reference

### Health Factor Colors
- 🟢 **Green**: HF ≥ 1.5 (Safe)
- 🟡 **Yellow**: 1.2 ≤ HF < 1.5 (Moderate)
- 🟠 **Orange**: 1.0 ≤ HF < 1.2 (At Risk)
- 🔴 **Red**: HF < 1.0 (Liquidatable)

### Tailwind Classes Used
```css
/* Health Factor */
.bg-green-50, .text-green-800, .border-green-300
.bg-yellow-50, .text-yellow-800, .border-yellow-300
.bg-orange-50, .text-orange-800, .border-orange-300
.bg-red-50, .text-red-800, .border-red-300

/* Buttons */
.bg-blue-500, .hover:bg-blue-600
.bg-gray-100, .hover:bg-gray-200

/* Borders */
.border-gray-100, .border-gray-200
```

## 💡 Tips

1. **Always show health factor** when user has an active position
2. **Use transaction preview** for borrow and collateral withdrawal
3. **Implement risk warnings** for actions that reduce health factor
4. **Parse all errors** using the error utility
5. **Show position overview** on market pages

## 🐛 Troubleshooting

### Issue: Health Factor shows NaN
```tsx
// Make sure debt value is not 0 when calculating
const hf = debt > 0n ? calculateHealthFactor(...) : Infinity;
```

### Issue: Transaction preview not updating
```tsx
// Ensure amount is a string and gets parsed correctly
const amountBigInt = parseUnits(amount || '0', decimals);
```

### Issue: Error messages showing raw errors
```tsx
// Always use parseContractError, never display error.message directly
{parseContractError(error)} // ✅ Good
{error.message}             // ❌ Bad
```

## 📚 Full Documentation

See `UI_IMPROVEMENTS_IMPLEMENTED.md` for complete documentation.

---

**Quick Links**:
- Error Messages: `lib/utils/errorMessages.ts`
- Components: `components/markets/`
- Types: `hooks/useMarketData.ts`, `hooks/useUserPosition.ts`
