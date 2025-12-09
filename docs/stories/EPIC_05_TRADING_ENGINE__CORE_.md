## Epic 5: Trading Engine (Core)

**Goal:** The CPMM swap logic - buy and sell shares.

### TRADE-1: Implement CPMM Engine (Domain Layer)

**As a** backend developer  
**I want** pure CPMM math functions  
**So that** trading logic is testable and framework-agnostic

**Acceptance Criteria:**
- [ ] Create `src/domain/services/cpmm-engine.ts`
- [ ] All calculations use BigInt (no floating point)
- [ ] `calculateBuyShares(pool, side, pointsIn)` - returns shares out
- [ ] `calculateSellPoints(pool, side, sharesIn)` - returns points out
- [ ] `getPrices(pool)` - returns { yes, no } prices
- [ ] `validatePool(pool)` - validates pool state
- [ ] Floor rounding on user outputs
- [ ] Ceiling division for pool calculations
- [ ] Verify k never decreases after operation
- [ ] Throw `InvariantViolatedError` if k decreases

**CPMM Formulas:**
```
k = YES_qty × NO_qty (constant)

Buying YES with Δy points:
- New y' = y + Δy
- New x' = k / y' (ceiling division)
- Shares received = x - x'

Selling Δx YES shares:
- New x' = x + Δx
- New y' = k / x' (ceiling division)
- Points received = y - y'
```

**References:** ENGINE_LOGIC.md Sections 2, 5

---

### TRADE-2: Implement Fee Calculator

**As a** backend developer  
**I want** correct fee calculations  
**So that** fees are properly deducted

**Acceptance Criteria:**
- [ ] Create `src/domain/services/fee-calculator.ts`
- [ ] Fee rate: 2.0% (200 basis points)
- [ ] Fee split: 50% vault, 50% LP injection
- [ ] `calculateFee(amount)` - ceiling rounding
- [ ] `splitFee(totalFee)` - returns { vaultFee, lpFee }
- [ ] `calculateNetAfterFee(grossAmount)` - for buying (fee from input)
- [ ] `calculateNetPayout(grossPayout)` - for selling (fee from output)
- [ ] No fee on mint, merge, or netting exit

**Fee Application:**
| Operation | Fee Timing |
|-----------|------------|
| Buy | Deduct from input BEFORE swap |
| Sell | Deduct from output AFTER swap |
| Mint | No fee |
| Merge | No fee |

**References:** ENGINE_LOGIC.md Section 4, SYSTEM_DESIGN.md Section 3.2

---

### TRADE-3: Implement POST /markets/:id/buy

**As a** user  
**I want** to buy shares  
**So that** I can bet on outcomes

**Endpoint:** `POST /v1/markets/:id/buy`

**Request:**
```json
{
  "side": "YES",
  "amount": "100000",
  "minSharesOut": "95000",
  "idempotencyKey": "buy_abc123_1702123456"
}
```

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Validate minimum trade size (1000 MicroPoints)
- [ ] Check market is ACTIVE
- [ ] Check market not past closesAt
- [ ] Check user has sufficient balance
- [ ] Check idempotency key not already used
- [ ] Apply fees to input
- [ ] Calculate shares via CPMM
- [ ] Check slippage (shares >= minSharesOut)
- [ ] Inject LP fee into pool
- [ ] Update pool with optimistic lock
- [ ] Deduct user balance
- [ ] Update/create portfolio
- [ ] Log to trade_ledger
- [ ] Return transaction details

**Errors:**
- INSUFFICIENT_BALANCE (400)
- SLIPPAGE_EXCEEDED (400)
- MARKET_NOT_ACTIVE (400)
- MINIMUM_TRADE_SIZE (400)
- IDEMPOTENCY_CONFLICT (409)
- OPTIMISTIC_LOCK_FAIL (409) - retry

**References:** API_SPECIFICATION.md Section 4.4.1, ENGINE_LOGIC.md Section 6.1

---

### TRADE-4: Implement POST /markets/:id/sell

**As a** user  
**I want** to sell shares  
**So that** I can exit positions

**Endpoint:** `POST /v1/markets/:id/sell`

**Request:**
```json
{
  "side": "YES",
  "shares": "50000",
  "minAmountOut": "48000",
  "idempotencyKey": "sell_abc123_1702123456"
}
```

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Check market is ACTIVE
- [ ] Check user has sufficient shares
- [ ] Calculate points via CPMM
- [ ] Apply fees to output
- [ ] Check slippage (points >= minAmountOut)
- [ ] Inject LP fee into pool
- [ ] Update pool with optimistic lock
- [ ] Credit user balance
- [ ] Reduce portfolio (proportional cost basis)
- [ ] Log to trade_ledger
- [ ] Return transaction details

**References:** API_SPECIFICATION.md Section 4.4.2, ENGINE_LOGIC.md Section 6.2

---

### TRADE-5: Implement GET /markets/:id/quote

**As a** user  
**I want** price quotes  
**So that** I can preview trades without executing

**Endpoint:** `GET /v1/markets/:id/quote`

**Query Params:**
- `side`: YES or NO
- `action`: BUY or SELL
- `amount`: MicroPoints (buy) or shares (sell)

**Acceptance Criteria:**
- [ ] Public endpoint
- [ ] Calculate estimated output
- [ ] Calculate fee
- [ ] Calculate price impact
- [ ] Calculate average execution price
- [ ] Calculate recommended minimum (5% slippage)
- [ ] Include quote expiry time (30 seconds)

**Response:**
```json
{
  "side": "YES",
  "action": "BUY",
  "amountIn": "100000",
  "estimatedSharesOut": "98500",
  "estimatedFee": "2000",
  "priceImpact": "0.0099",
  "spotPrice": "0.50",
  "avgExecutionPrice": "0.5076",
  "minimumRecommended": "93575",
  "expiresAt": "2024-12-09T10:30:30Z"
}
```

**References:** API_SPECIFICATION.md Section 4.4.5

---

### TRADE-6: Add Optimistic Locking

**As a** backend developer  
**I want** optimistic locking on pool updates  
**So that** concurrent trades don't corrupt state

**Acceptance Criteria:**
- [ ] Add version_id check in UPDATE WHERE clause
- [ ] Increment version_id on successful update
- [ ] Return OPTIMISTIC_LOCK_FAIL if no rows updated
- [ ] Client should retry on this error

**Implementation:**
```sql
UPDATE liquidity_pools
SET yes_qty = ?, no_qty = ?, version_id = version_id + 1
WHERE id = ? AND version_id = ?
-- rowCount === 0 means concurrent modification
```

**References:** EDGE_CASES.md Section 4.1

---

### TRADE-7: Add Idempotency Key Support

**As a** backend developer  
**I want** idempotency keys  
**So that** duplicate requests are safe

**Acceptance Criteria:**
- [ ] Accept optional `idempotencyKey` in trade requests
- [ ] Check trade_ledger for existing key before processing
- [ ] Return IDEMPOTENCY_CONFLICT if already used
- [ ] Store key in trade_ledger entry

**References:** EDGE_CASES.md Section 4.2

---