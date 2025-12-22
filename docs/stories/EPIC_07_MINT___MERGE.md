## Epic 7: Mint & Merge

**Goal:** Advanced trading - create and destroy share pairs.

### MINT-1: Implement POST /markets/:id/mint

**As a** user  
**I want** to mint shares  
**So that** I can create YES+NO pairs

**Endpoint:** `POST /v1/markets/:id/mint`

**Request:**
```json
{
  "amount": "100000"
}
```

**Acceptance Criteria:**
- [x] Require authentication
- [x] No fee charged
- [x] Create equal YES and NO shares
- [x] 1 Point = 1 YES + 1 NO
- [x] Deduct points from user
- [x] Add shares to portfolio
- [x] Log to trade_ledger

**Response:**
```json
{
  "yesOut": "100000",
  "noOut": "100000",
  "newBalance": "4900000"
}
```

**References:** API_SPECIFICATION.md Section 4.4.3, ENGINE_LOGIC.md Section 6.3

---

### MINT-2: Implement POST /markets/:id/merge

**As a** user  
**I want** to merge shares  
**So that** I can convert pairs back to points

**Endpoint:** `POST /v1/markets/:id/merge`

**Request:**
```json
{
  "amount": "50000"
}
```

**Acceptance Criteria:**
- [x] Require authentication
- [x] No fee charged
- [x] Require equal YES and NO shares
- [x] Destroy equal amounts of both
- [x] Credit points to user (1 Point per pair)
- [x] Update portfolio
- [x] Log to trade_ledger

**Error:** INSUFFICIENT_SHARES if user doesn't have equal amounts

**References:** API_SPECIFICATION.md Section 4.4.4, ENGINE_LOGIC.md Section 6.3

---

### MINT-3: Add Mint/Merge to TradeForm

**As a** user  
**I want** mint/merge UI  
**So that** I can use these operations

**Acceptance Criteria:**
- [x] Add Mint/Merge tabs to TradeForm
- [x] Mint: single amount input, show output preview
- [x] Merge: single amount input, show both share types
- [x] Validate user has sufficient balance/shares
- [x] Create mutations for mint/merge

---

### MINT-4: Implement Netting Protocol

**As a** user  
**I want** automatic netting  
**So that** I don't hold conflicting positions

**Acceptance Criteria:**
- [x] Detect when user buys opposite side
- [x] Auto-exit opposite position first (fee-free)
- [x] Combine proceeds with new buy amount
- [x] Execute single entry trade (with fees)
- [x] Log NET_SELL action to ledger
- [x] Maintain Rule 2: No conflicting positions

**Example:**
User holds 100 NO shares, wants to buy YES with $50:
1. Sell 100 NO shares (fee-free) → get ~$40
2. Combine: $50 + $40 = $90
3. Buy YES with $90 (2% fee)

**Implementation Notes:**
- Modified `BuySharesUseCase` to detect opposite positions before executing buy
- Fee-free netting sell uses `calculateSellPoints` directly (no `calculateNetPayout`)
- Opposite position cleared in portfolio (set to 0n)
- NET_SELL logged with `feePaid: 0n`, `feeVault: 0n`, `feeLp: 0n`
- Aggregated buying power = `netAmount` (after buy fees) + `nettingProceeds`
- Pool state updated after netting sell, before final buy
- Two ledger entries created: NET_SELL (fee-free) + BUY (with fees)

**Verification:**
- ✅ All 7 unit tests passed
- ✅ All 16 existing regression tests passed
- ✅ Curl test: User with 100k NO shares bought YES
  - NET_SELL executed (fee-free)
  - Portfolio cleared: 605k YES, 0 NO
  - Buy returned 605k shares from 50k input (proving netting proceeds aggregated)

**References:** ENGINE_LOGIC.md Section 7, SYSTEM_DESIGN.md Rule 2

---