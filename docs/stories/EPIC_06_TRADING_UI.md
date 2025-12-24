## Epic 6: Trading UI

**Goal:** User can buy/sell shares from the market detail page.

### TRADEUI-1: Create TradeForm Component ✅

**As a** user  
**I want** a trade form  
**So that** I can buy and sell shares

**Acceptance Criteria:**
- [x] Create `src/components/market/TradeForm.tsx`
- [x] Buy/Sell tab toggle
- [x] Render inside Card component
- [x] Use TanStack Form for state
- [x] Disabled when market not ACTIVE

**References:** FRONTEND_COMPONENTS.md Section 5.1

**Implementation Notes:**
- Created comprehensive TradeForm component with TanStack Form
- Implemented Buy/Sell tabs with proper state management
- Added YES/NO side selection buttons showing current prices
- Integrated real-time quote fetching with 300ms debounce
- Added amount input with MAX button for balance/shares
- Displays estimated output, fees, and price impact
- Proper validation for minimum amounts and sufficient balance/shares
- Error handling with user-friendly messages
- Market status checking - form disabled when not ACTIVE
- Created supporting hooks: `useTrading.ts` and `usePortfolio.ts`
- Added all necessary types to `api/types.ts`
- Implemented API methods in `api/markets.ts`
- Integrated into MarketDetailPage replacing placeholder

**Files Changed:**
- `frontend/src/components/market/TradeForm.tsx` (new)
- `frontend/src/hooks/useTrading.ts` (new)
- `frontend/src/hooks/usePortfolio.ts` (new)
- `frontend/src/api/types.ts` (updated)
- `frontend/src/api/markets.ts` (updated)
- `frontend/src/routes/markets/$marketId.tsx` (updated)
- `backend/src/infrastructure/database/seed.ts` (updated - extended market close times)

---

### TRADEUI-2: Add YES/NO Side Toggle

**As a** user  
**I want** to choose YES or NO  
**So that** I can bet on either outcome

**Acceptance Criteria:**
- [x] Two large buttons: YES (green), NO (red)
- [x] Show current price on each button
- [x] Highlight selected side
- [x] Update estimated output when changed

---

### TRADEUI-3: Implement Amount Input

**As a** user  
**I want** to enter trade amounts  
**So that** I can control my bet size

**Acceptance Criteria:**
- [x] Input field for amount
- [x] Switch between Points (buy) and Shares (sell)
- [x] MAX button to fill available balance/shares
- [x] Validate positive numbers
- [x] Validate sufficient balance/shares
- [x] Format with thousand separators

---

### TRADEUI-4: Show Estimated Output

**As a** user  
**I want** to see trade estimates  
**So that** I know what I'll receive

**Acceptance Criteria:**
- [x] Call quote endpoint on amount change (debounced)
- [x] Show estimated shares out (buy) or points out (sell)
- [x] Show average price
- [x] Show fee amount
- [x] Show price impact percentage
- [x] Update on amount/side change

---

### TRADEUI-5: Create Trading Mutations

**As a** frontend developer  
**I want** trade mutations  
**So that** I can execute trades

**Acceptance Criteria:**
- [x] Create `src/hooks/useTrading.ts`
- [x] `useBuyShares()` mutation
- [x] `useSellShares()` mutation
- [x] Invalidate queries on success: auth/me, portfolio, market detail
- [x] Generate idempotency key per request
- [x] Handle retry logic for network errors

**References:** FRONTEND_STATE.md Section 4.1

---

### TRADEUI-6: Handle Trade Errors

**As a** user  
**I want** clear error messages  
**So that** I understand why trades fail

**Acceptance Criteria:**
- [x] Map error codes to user-friendly messages
- [x] INSUFFICIENT_BALANCE: "You don't have enough points"
- [x] SLIPPAGE_EXCEEDED: "Price moved too much. Try again with higher slippage"
- [x] MARKET_NOT_ACTIVE: "This market is not open for trading"
- [x] Display error in form
- [x] Clear error on new submission

---

### TRADEUI-7: Show Trade Confirmation

**As a** user  
**I want** confirmation feedback  
**So that** I know my trade succeeded

**Acceptance Criteria:**
- [x] Show success message/toast
- [x] Display shares received
- [x] Display new balance
- [x] Reset form after success
- [x] Update UI with new prices

---

### TRADEUI-8: Show Price Impact Warning

**As a** user  
**I want** to be warned about high price impact  
**So that** I don't accidentally make unfavorable trades

**Acceptance Criteria:**
- [x] Calculate price impact from quote
- [x] Show warning when impact > 1%
- [x] Show strong warning when impact > 5%
- [x] Block or require confirmation when impact > 10%
- [x] Explain price impact in tooltip
- [x] Suggest smaller trade size

**References:** ENGINE_LOGIC.md Section 5, EDGE_CASES.md Section 3.2

---

### TRADEUI-9: Add Slippage Tolerance Settings

**As a** user  
**I want** to configure my slippage tolerance  
**So that** I can control trade execution parameters

**Acceptance Criteria:**
- [x] Slippage tolerance setting (0.5%, 1%, 2%, custom)
- [x] Store preference in localStorage
- [x] Use setting to calculate minSharesOut/minAmountOut
- [x] Show estimated slippage in trade preview
- [x] Warning if slippage setting is very high

**References:** API_SPECIFICATION.md Section 4.4.1

---

### TRADEUI-10: Add Trade Confirmation Modal

**As a** user  
**I want** to confirm large trades before execution  
**So that** I don't accidentally make significant trades

**Acceptance Criteria:**
- [x] Show confirmation modal for trades > threshold (e.g., 100 Points)
- [x] Display full trade details
- [x] Show price impact and fees
- [x] Require explicit confirmation
- [x] Optional "Don't show again" checkbox for session

---