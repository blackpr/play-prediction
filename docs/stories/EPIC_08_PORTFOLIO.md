## Epic 8: Portfolio

**Goal:** User can view all positions and trade history.

### PORT-1: Implement GET /portfolio

**As a** user  
**I want** to see all my positions  
**So that** I can track my investments

**Endpoint:** `GET /v1/portfolio`

**Query Params:**
- `status` - filter by market status
- `hasPosition` - only markets with holdings (default: true)

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Query portfolios for user
- [ ] Join with markets for market info
- [ ] Calculate current value: shares × currentPrice
- [ ] Calculate unrealized P&L: currentValue - costBasis
- [ ] Calculate total portfolio value
- [ ] Return positions list

**Response:**
```json
{
  "totalValue": "5250000",
  "totalCostBasis": "5000000",
  "unrealizedPnL": "250000",
  "positions": [
    {
      "market": { "id": "...", "title": "...", "status": "ACTIVE", "yesPrice": 0.55 },
      "yesQty": "100000",
      "noQty": "0",
      "yesCostBasis": "50000",
      "noCostBasis": "0",
      "currentValue": "55000",
      "unrealizedPnL": "5000"
    }
  ]
}
```

**References:** API_SPECIFICATION.md Section 4.5.1

---

### PORT-2: Implement GET /portfolio/:marketId

**As a** user  
**I want** my position in a specific market  
**So that** I can see detailed info

**Endpoint:** `GET /v1/portfolio/:marketId`

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Return position or empty if none
- [ ] Calculate average buy price
- [ ] Calculate unrealized P&L

**References:** API_SPECIFICATION.md Section 4.5.2

---

### PORT-3: Implement GET /portfolio/history

**As a** user  
**I want** my trade history  
**So that** I can review past trades

**Endpoint:** `GET /v1/portfolio/history`

**Query Params:**
- `marketId` - filter by market
- `action` - filter by action type
- `page`, `pageSize`

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Query trade_ledger for user
- [ ] Join market title
- [ ] Paginate results
- [ ] Order by created_at DESC

**References:** API_SPECIFICATION.md Section 4.5.3

---

### PORT-4: Create Portfolio Page

**As a** user  
**I want** a portfolio page  
**So that** I can see all my positions

**Route:** `/portfolio`

**Acceptance Criteria:**
- [ ] Protected route (require auth)
- [ ] Show total value and P&L summary
- [ ] Grid of PositionCard components
- [ ] Empty state if no positions
- [ ] Link to markets to start trading

---

### PORT-5: Create PositionCard Component

**As a** user  
**I want** position cards  
**So that** I can see position details

**Acceptance Criteria:**
- [ ] Create `src/components/portfolio/PositionCard.tsx`
- [ ] Market title
- [ ] YES/NO holdings with current price
- [ ] Unrealized P&L with trend icon
- [ ] Link to market detail

**References:** FRONTEND_COMPONENTS.md Section 6.1

---

### PORT-6: Create TradeHistory Component

**As a** user  
**I want** trade history  
**So that** I can review past activity

**Acceptance Criteria:**
- [ ] Create `src/components/portfolio/TradeHistory.tsx`
- [ ] Use infinite scroll with useInfiniteQuery
- [ ] Show action type, side, amounts, fees
- [ ] Show market title
- [ ] Timestamp formatting

**References:** FRONTEND_STATE.md Section 3.4

---

### PORT-7: Create Empty State Components

**As a** user  
**I want** helpful empty states  
**So that** I know what to do when I have no data

**Acceptance Criteria:**
- [ ] Empty portfolio: "You don't have any positions yet"
- [ ] Empty trade history: "No trades yet"
- [ ] CTA button linking to markets page
- [ ] Illustration/icon for visual appeal
- [ ] Different message for filtered empty results

---