## Epic 6: Trading UI

**Goal:** User can buy/sell shares from the market detail page.

### TRADEUI-1: Create TradeForm Component

**As a** user  
**I want** a trade form  
**So that** I can buy and sell shares

**Acceptance Criteria:**
- [ ] Create `src/components/market/TradeForm.tsx`
- [ ] Buy/Sell tab toggle
- [ ] Render inside Card component
- [ ] Use TanStack Form for state
- [ ] Disabled when market not ACTIVE

**References:** FRONTEND_COMPONENTS.md Section 5.1

---

### TRADEUI-2: Add YES/NO Side Toggle

**As a** user  
**I want** to choose YES or NO  
**So that** I can bet on either outcome

**Acceptance Criteria:**
- [ ] Two large buttons: YES (green), NO (red)
- [ ] Show current price on each button
- [ ] Highlight selected side
- [ ] Update estimated output when changed

---

### TRADEUI-3: Implement Amount Input

**As a** user  
**I want** to enter trade amounts  
**So that** I can control my bet size

**Acceptance Criteria:**
- [ ] Input field for amount
- [ ] Switch between Points (buy) and Shares (sell)
- [ ] MAX button to fill available balance/shares
- [ ] Validate positive numbers
- [ ] Validate sufficient balance/shares
- [ ] Format with thousand separators

---

### TRADEUI-4: Show Estimated Output

**As a** user  
**I want** to see trade estimates  
**So that** I know what I'll receive

**Acceptance Criteria:**
- [ ] Call quote endpoint on amount change (debounced)
- [ ] Show estimated shares out (buy) or points out (sell)
- [ ] Show average price
- [ ] Show fee amount
- [ ] Show price impact percentage
- [ ] Update on amount/side change

---

### TRADEUI-5: Create Trading Mutations

**As a** frontend developer  
**I want** trade mutations  
**So that** I can execute trades

**Acceptance Criteria:**
- [ ] Create `src/hooks/useTrading.ts`
- [ ] `useBuyShares()` mutation
- [ ] `useSellShares()` mutation
- [ ] Invalidate queries on success: auth/me, portfolio, market detail
- [ ] Generate idempotency key per request
- [ ] Handle retry logic for network errors

**References:** FRONTEND_STATE.md Section 4.1

---

### TRADEUI-6: Handle Trade Errors

**As a** user  
**I want** clear error messages  
**So that** I understand why trades fail

**Acceptance Criteria:**
- [ ] Map error codes to user-friendly messages
- [ ] INSUFFICIENT_BALANCE: "You don't have enough points"
- [ ] SLIPPAGE_EXCEEDED: "Price moved too much. Try again with higher slippage"
- [ ] MARKET_NOT_ACTIVE: "This market is not open for trading"
- [ ] Display error in form
- [ ] Clear error on new submission

---

### TRADEUI-7: Show Trade Confirmation

**As a** user  
**I want** confirmation feedback  
**So that** I know my trade succeeded

**Acceptance Criteria:**
- [ ] Show success message/toast
- [ ] Display shares received
- [ ] Display new balance
- [ ] Reset form after success
- [ ] Update UI with new prices

---

### TRADEUI-8: Show Price Impact Warning

**As a** user  
**I want** to be warned about high price impact  
**So that** I don't accidentally make unfavorable trades

**Acceptance Criteria:**
- [ ] Calculate price impact from quote
- [ ] Show warning when impact > 1%
- [ ] Show strong warning when impact > 5%
- [ ] Block or require confirmation when impact > 10%
- [ ] Explain price impact in tooltip
- [ ] Suggest smaller trade size

**References:** ENGINE_LOGIC.md Section 5, EDGE_CASES.md Section 3.2

---

### TRADEUI-9: Add Slippage Tolerance Settings

**As a** user  
**I want** to configure my slippage tolerance  
**So that** I can control trade execution parameters

**Acceptance Criteria:**
- [ ] Slippage tolerance setting (0.5%, 1%, 2%, custom)
- [ ] Store preference in localStorage
- [ ] Use setting to calculate minSharesOut/minAmountOut
- [ ] Show estimated slippage in trade preview
- [ ] Warning if slippage setting is very high

**References:** API_SPECIFICATION.md Section 4.4.1

---

### TRADEUI-10: Add Trade Confirmation Modal

**As a** user  
**I want** to confirm large trades before execution  
**So that** I don't accidentally make significant trades

**Acceptance Criteria:**
- [ ] Show confirmation modal for trades > threshold (e.g., 100 Points)
- [ ] Display full trade details
- [ ] Show price impact and fees
- [ ] Require explicit confirmation
- [ ] Optional "Don't show again" checkbox for session

---