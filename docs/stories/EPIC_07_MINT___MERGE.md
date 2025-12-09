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
- [ ] Require authentication
- [ ] No fee charged
- [ ] Create equal YES and NO shares
- [ ] 1 Point = 1 YES + 1 NO
- [ ] Deduct points from user
- [ ] Add shares to portfolio
- [ ] Log to trade_ledger

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
- [ ] Require authentication
- [ ] No fee charged
- [ ] Require equal YES and NO shares
- [ ] Destroy equal amounts of both
- [ ] Credit points to user (1 Point per pair)
- [ ] Update portfolio
- [ ] Log to trade_ledger

**Error:** INSUFFICIENT_SHARES if user doesn't have equal amounts

**References:** API_SPECIFICATION.md Section 4.4.4, ENGINE_LOGIC.md Section 6.3

---

### MINT-3: Add Mint/Merge to TradeForm

**As a** user  
**I want** mint/merge UI  
**So that** I can use these operations

**Acceptance Criteria:**
- [ ] Add Mint/Merge tabs to TradeForm
- [ ] Mint: single amount input, show output preview
- [ ] Merge: single amount input, show both share types
- [ ] Validate user has sufficient balance/shares
- [ ] Create mutations for mint/merge

---

### MINT-4: Implement Netting Protocol

**As a** user  
**I want** automatic netting  
**So that** I don't hold conflicting positions

**Acceptance Criteria:**
- [ ] Detect when user buys opposite side
- [ ] Auto-exit opposite position first (fee-free)
- [ ] Combine proceeds with new buy amount
- [ ] Execute single entry trade (with fees)
- [ ] Log NET_SELL action to ledger
- [ ] Maintain Rule 2: No conflicting positions

**Example:**
User holds 100 NO shares, wants to buy YES with $50:
1. Sell 100 NO shares (fee-free) → get ~$40
2. Combine: $50 + $40 = $90
3. Buy YES with $90 (2% fee)

**References:** ENGINE_LOGIC.md Section 7, SYSTEM_DESIGN.md Rule 2

---