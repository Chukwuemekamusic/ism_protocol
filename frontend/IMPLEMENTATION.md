Build Market Detail Page + SupplyBorrowForm

Overview

Create a comprehensive market detail page where users can view market information and interact with the protocol (supply, borrow, repay,
withdraw).

Components to Build

1.  Market Detail Page (app/markets/[id]/page.tsx)

Features:

- Dynamic route using market address as [id]
- Market information display (APY, TVL, utilization, LTV, liquidation threshold)
- Token information (collateral and borrow tokens with symbols)
- User's current position in this market
- SupplyBorrowForm component integration

Layout:

- Left side: Market stats and information
- Right side: Interactive SupplyBorrowForm

2.  SupplyBorrowForm Component (components/markets/SupplyBorrowForm.tsx)

Features:

- 4 tabs: Supply, Borrow, Repay, Withdraw
- Token input with balance display
- "MAX" button to fill user's balance
- Transaction approval flow (for ERC20 tokens)
- Loading states during transactions
- Success/error messages
- Real-time validation (insufficient balance, exceeds borrow limit, etc.)

Supply Tab:

- Input amount of borrow token to supply
- Shows projected APY earnings
- Approve + Deposit flow

Borrow Tab:

- Input amount to borrow
- Shows max borrowable amount based on collateral
- Health factor preview
- Collateral deposit if needed

Repay Tab:

- Input amount to repay
- Show current debt
- Approve + Repay flow

Withdraw Tab:

- Input amount to withdraw
- Show current supply balance
- Validate withdrawal doesn't break positions

3.  Supporting Components

MarketStats Component (components/markets/MarketStats.tsx)

- Clean display of market metrics
- Visual indicators for utilization rate
- Collapsible details section

TokenDisplay Component (components/ui/TokenDisplay.tsx)

- Show token symbol with icon
- Formatted amounts
- Reusable across forms

TransactionButton Component (components/ui/TransactionButton.tsx)

- Handles approval + transaction flow
- Loading states
- Error handling
- Reusable for all transaction types

Implementation Steps

Phase 1: Market Detail Page Structure

1.  Create /app/markets/[id]/page.tsx
2.  Fetch market data using useMarketData hook
3.  Fetch user position using useUserMarketPosition hook
4.  Layout the page with market info on left

Phase 2: SupplyBorrowForm Core

1.  Create tabbed interface (Supply/Borrow/Repay/Withdraw)
2.  Add input field with validation
3.  Show user balances
4.  Add MAX button functionality

Phase 3: Supply Flow

1.  Integrate useApprove and useDeposit hooks
2.  Check allowance before deposit
3.  Show approval button if needed
4.  Handle transaction lifecycle
5.  Show success/error states

Phase 4: Borrow Flow

1.  Integrate useDepositCollateral and useBorrow hooks
2.  Calculate max borrow amount
3.  Show health factor preview
4.  Handle collateral deposit if needed
5.  Execute borrow transaction

Phase 5: Repay Flow

1.  Integrate useApprove and useRepay hooks
2.  Show current debt
3.  Handle approval + repay
4.  Update UI on success

Phase 6: Withdraw Flow

1.  Integrate useWithdraw hook
2.  Validate withdrawal amount
3.  Check health factor impact
4.  Execute withdrawal

UI/UX Considerations

Error Handling:

- Insufficient balance
- Insufficient allowance
- Transaction rejected
- Network errors
- Health factor too low

Loading States:

- Fetching market data
- Checking allowance
- Approving tokens
- Transaction pending
- Waiting for confirmation

Success States:

- Transaction confirmed
- Link to block explorer
- Updated balances

Validation:

- Amount > 0
- Amount ≤ available balance
- Borrow amount ≤ max borrow
- Withdrawal doesn't liquidate position

Key Features

✅ Real-time balance updates✅ Approval flow for ERC20 tokens✅ Health factor preview before borrow✅ Transaction confirmation links✅
Responsive design (mobile-friendly)✅ Clear error messages✅ Loading indicators✅ Success animations

Testing Checklist

After implementation, verify:

- Market detail page loads correctly
- All 4 tabs display properly
- Token balances show correctly
- MAX button fills correct amount
- Approval flow works for supply/repay
- Deposit transaction succeeds
- Borrow transaction succeeds
- Repay transaction succeeds
- Withdraw transaction succeeds
- Error states display properly
- Health factor updates after transactions
- Mobile responsive
