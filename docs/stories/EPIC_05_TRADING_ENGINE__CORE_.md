## Epic 5: Trading Engine (Core)

**Goal:** The CPMM swap logic - buy and sell shares.

### TRADE-1: Implement CPMM Engine (Domain Layer)

**As a** backend developer  
**I want** pure CPMM math functions  
**So that** trading logic is testable and framework-agnostic

**Acceptance Criteria:**
- [x] Create `src/domain/services/cpmm-engine.ts`
- [x] All calculations use BigInt (no floating point)
- [x] `calculateBuyShares(pool, side, pointsIn)` - returns shares out
- [x] `calculateSellPoints(pool, side, sharesIn)` - returns points out
- [x] `getPrices(pool)` - returns { yes, no } prices
- [x] `validatePool(pool)` - validates pool state
- [x] Floor rounding on user outputs
- [x] Ceiling division for pool calculations
- [x] Verify k never decreases after operation
- [x] Throw `InvariantViolatedError` if k decreases

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

**Implementation Notes:**
- Created `src/domain/services/constants.ts` with `PRICE_PRECISION` and `Side` type
- Created `src/domain/services/cpmm-engine.ts` with all core functions
- Comprehensive unit tests in `test/unit/domain/cpmm-engine.test.ts` (30 tests, all passing)
- Verified k-invariant preservation, proper rounding, and mathematical properties

---

### TRADE-2: Implement Fee Calculator

**As a** backend developer  
**I want** correct fee calculations  
**So that** fees are properly deducted

**Acceptance Criteria:**
- [x] Create `src/domain/services/fee-calculator.ts`
- [x] Fee rate: 2.0% (200 basis points)
- [x] Fee split: 50% vault, 50% LP injection
- [x] `calculateFee(amount)` - ceiling rounding
- [x] `splitFee(totalFee)` - returns { vaultFee, lpFee }
- [x] `calculateNetAfterFee(grossAmount)` - for buying (fee from input)
- [x] `calculateNetPayout(grossPayout)` - for selling (fee from output)
- [x] No fee on mint, merge, or netting exit

**Fee Application:**
| Operation | Fee Timing |
|-----------|------------|
| Buy | Deduct from input BEFORE swap |
| Sell | Deduct from output AFTER swap |
| Mint | No fee |
| Merge | No fee |

**References:** ENGINE_LOGIC.md Section 4, SYSTEM_DESIGN.md Section 3.2

**Implementation Notes:**
- Created `src/domain/services/fee-calculator.ts` with all core functions
- Added fee constants to `src/domain/services/constants.ts`
- Comprehensive unit tests in `test/unit/domain/fee-calculator.test.ts` (30 tests, all passing)
- Verified ceiling rounding for fees (favors house)
- Verified 50/50 vault/LP split with proper remainder handling
- All 75 backend tests passing

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
- [x] Require authentication
- [x] Validate minimum trade size (1000 MicroPoints)
- [x] Check market is ACTIVE
- [x] Check market not past closesAt
- [x] Check user has sufficient balance
- [x] Check idempotency key not already used
- [x] Apply fees to input
- [x] Calculate shares via CPMM
- [x] Check slippage (shares >= minSharesOut)
- [x] Inject LP fee into pool
- [x] Update pool with optimistic lock
- [x] Deduct user balance
- [x] Update/create portfolio
- [x] Log to trade_ledger
- [x] Return transaction details

**Errors:**
- INSUFFICIENT_BALANCE (400)
- SLIPPAGE_EXCEEDED (400)
- MARKET_NOT_ACTIVE (400)
- MINIMUM_TRADE_SIZE (400)
- IDEMPOTENCY_CONFLICT (409)
- OPTIMISTIC_LOCK_FAIL (409) - retry

**References:** API_SPECIFICATION.md Section 4.4.1, ENGINE_LOGIC.md Section 6.1

**Implementation Notes:**
- Created `BuySharesUseCase` with complete transaction logic
- Implemented `PortfolioRepository` and `TradeLedgerRepository` with PostgreSQL
- Extended `MarketRepository` with trading methods
- Created buy route handler with Zod validation
- All 75 unit tests passing
- Verified with curl: successful trades, idempotency, slippage protection, minimum trade size, insufficient balance

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
- [x] Require authentication
- [x] Check market is ACTIVE
- [x] Check user has sufficient shares
- [x] Calculate points via CPMM
- [x] Apply fees to output
- [x] Check slippage (points >= minAmountOut)
- [x] Inject LP fee into pool
- [x] Update pool with optimistic lock
- [x] Credit user balance
- [x] Reduce portfolio (proportional cost basis)
- [x] Log to trade_ledger
- [x] Return transaction details

**References:** API_SPECIFICATION.md Section 4.4.2, ENGINE_LOGIC.md Section 6.2

**Implementation Notes:**
- Created `SellSharesUseCase` with complete transaction logic
- Implemented sell route handler with Zod validation
- Comprehensive unit tests (19 test cases, all passing)
- All 110 backend tests passing
- Verified with curl: successful sell, insufficient shares, slippage protection, idempotency
- Proportional cost basis reduction: `basisReduction = (currentBasis × sharesIn) / sharesBefore`
- Fees deducted from OUTPUT (after swap) using `calculateNetPayout`
- User balance credited (not debited) with net payout

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
- [x] Public endpoint
- [x] Calculate estimated output
- [x] Calculate fee
- [x] Calculate price impact
- [x] Calculate average execution price
- [x] Calculate recommended minimum (5% slippage)
- [x] Include quote expiry time (30 seconds)

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

**Implementation Notes:**
- Created `GetQuoteUseCase` in `src/application/use-cases/trading/get-quote.use-case.ts`
- Created route handler in `src/presentation/fastify/routes/markets/quote.ts`
- Registered in DI container (`src/shared/container/index.ts` and `types.ts`)
- Comprehensive unit tests in `test/unit/use-cases/get-quote.use-case.test.ts` (17 tests, all passing)
- All 127 backend tests passing
- Verified with curl: BUY/SELL quotes for YES/NO sides
- Price impact calculated using CPMM engine's built-in calculation
- Average execution price: `(amountIn × PRICE_PRECISION) / sharesOut` for BUY, `(netPayout × PRICE_PRECISION) / sharesIn` for SELL
- Recommended minimum: 95% of estimated output (5% slippage tolerance)
- Quote expiry: 30 seconds from request time

---

### TRADE-6: Add Optimistic Locking

**As a** backend developer  
**I want** optimistic locking on pool updates  
**So that** concurrent trades don't corrupt state

**Acceptance Criteria:**
- [x] Add version_id check in UPDATE WHERE clause
- [x] Increment version_id on successful update
- [x] Return OPTIMISTIC_LOCK_FAIL if no rows updated
- [x] Client should retry on this error

**Implementation:**
```sql
UPDATE liquidity_pools
SET yes_qty = ?, no_qty = ?, version_id = version_id + 1
WHERE id = ? AND version_id = ?
-- rowCount === 0 means concurrent modification
```

**References:** EDGE_CASES.md Section 4.1

**Implementation Notes:**
- ✅ `version_id` column exists in `liquidity_pools` table (schema.ts:136)
- ✅ `updatePoolWithLock()` method implemented in `PostgresMarketRepository` (postgres-market.repository.ts:325-363)
- ✅ Version check in WHERE clause: `eq(liquidityPools.versionId, expectedVersion)`
- ✅ Version increment on success: `versionId: expectedVersion + 1`
- ✅ Returns `success: false` when version mismatch (no rows updated)
- ✅ Use cases throw `OPTIMISTIC_LOCK_FAIL` error (buy-shares.use-case.ts:169-175, sell-shares.use-case.ts:168)
- ✅ Routes return 409 status code for lock failures (buy.ts:97, sell.ts:97)
- ✅ Unit tests verify lock failure behavior (buy-shares.use-case.test.ts:357-371, sell-shares.use-case.test.ts:410+)
- ✅ Integration tests created in `test/integration/optimistic-locking.test.ts`
- ✅ Verified version increments on each trade (1 → 2 → 3)
- ✅ All 127 backend tests passing

---

### TRADE-7: Add Idempotency Key Support

**As a** backend developer  
**I want** idempotency keys  
**So that** duplicate requests are safe

**Acceptance Criteria:**
- [x] Accept optional `idempotencyKey` in trade requests
- [x] Check trade_ledger for existing key before processing
- [x] Return IDEMPOTENCY_CONFLICT if already used
- [x] Store key in trade_ledger entry

**References:** EDGE_CASES.md Section 4.2

**Implementation Notes:**
- ✅ `idempotency_key` column in `trade_ledger` table (schema.ts:185)
- ✅ Unique index on `idempotency_key` for fast lookups (schema.ts:195)
- ✅ Use cases check for duplicate keys before processing (buy-shares.use-case.ts:73-84, sell-shares.use-case.ts:73-84)
- ✅ Throws `IDEMPOTENCY_CONFLICT` error when duplicate found
- ✅ Routes return 409 status code (buy.ts:97, sell.ts:97)
- ✅ Unit tests verify idempotency behavior (buy-shares.use-case.test.ts:115-132, sell-shares.use-case.test.ts:115+)
- ✅ Integration tests created in `test/integration/idempotency.test.ts`
- ✅ Verified with curl: first request succeeds, second with same key returns 409 IDEMPOTENCY_CONFLICT
- ✅ Keys are optional - trades without keys are allowed
- ✅ Different keys allow different trades
- ✅ All 127 backend tests passing

**Curl Verification:**
```bash
# First request - SUCCESS
curl -X POST http://localhost:4000/api/v1/markets/MARKET_ID/buy \
  -b cookies.txt -H "Content-Type: application/json" \
  -d '{"side": "YES", "amount": "100000", "minSharesOut": "1", "idempotencyKey": "test-key-123"}'
# Response: {"success":true, "data":{"transactionId":"...", "sharesOut":"43281", ...}}

# Second request with same key - CONFLICT
curl -X POST http://localhost:4000/api/v1/markets/MARKET_ID/buy \
  -b cookies.txt -H "Content-Type: application/json" \
  -d '{"side": "YES", "amount": "100000", "minSharesOut": "1", "idempotencyKey": "test-key-123"}'
# Response: {"success":false, "error":{"code":"IDEMPOTENCY_CONFLICT", ...}}
```

---