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
- [x] Require authentication
- [x] Query portfolios for user
- [x] Join with markets for market info
- [x] Calculate current value: shares × currentPrice
- [x] Calculate unrealized P&L: currentValue - costBasis
- [x] Calculate total portfolio value
- [x] Return positions list

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
- [x] Require authentication
- [x] Return position or empty if none
- [x] Calculate average buy price
- [x] Calculate unrealized P&L

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
- [x] Require authentication
- [x] Query trade_ledger for user
- [x] Join market title
- [x] Paginate results
- [x] Order by created_at DESC

**References:** API_SPECIFICATION.md Section 4.5.3

---

### PORT-4: Create Portfolio Page

**As a** user  
**I want** a portfolio page  
**So that** I can see all my positions

**Route:** `/portfolio`

**Acceptance Criteria:**
- [x] Protected route (require auth)
- [x] Show total value and P&L summary
- [x] Grid of PositionCard components
- [x] Empty state if no positions
- [x] Link to markets to start trading

---

### PORT-5: Create PositionCard Component

**As a** user  
**I want** position cards  
**So that** I can see position details

**Acceptance Criteria:**
- [x] Create `src/components/portfolio/PositionCard.tsx`
- [x] Market title
- [x] YES/NO holdings with current price
- [x] Unrealized P&L with trend icon
- [x] Link to market detail

**References:** FRONTEND_COMPONENTS.md Section 6.1

---

### PORT-6: Create TradeHistory Component

**As a** user  
**I want** trade history  
**So that** I can review past activity

**Acceptance Criteria:**
- [x] Create `src/components/portfolio/TradeHistory.tsx`
- [x] Use infinite scroll with useInfiniteQuery
- [x] Show action type, side, amounts, fees
- [x] Show market title
- [x] Timestamp formatting

**References:** FRONTEND_STATE.md Section 3.4

**Implementation Notes:**
- Created `TradeHistory.tsx` component with infinite scroll pagination
- Created `useTradeHistory` hook using TanStack Query's `useInfiniteQuery`
- Action badges color-coded: BUY (green), SELL (red), MINT (blue), MERGE (purple)
- Side badges: YES (green), NO (red)
- Relative timestamps (e.g., "2h ago", "21m ago")
- "Load More" button for pagination
- Empty state integration using reusable `EmptyState` component
- Displays: Amount In, Amount Out, Fee, Price at Execution
- Market titles are clickable links to market detail pages

**Files Created:**
- `frontend/src/components/portfolio/TradeHistory.tsx`
- `frontend/src/hooks/useTradeHistory.ts`
- `frontend/src/components/ui/EmptyState.tsx`

**Files Modified:**
- `frontend/src/api/types.ts` - Added `TradeHistoryItem` and `TradeHistoryResponse` types
- `frontend/src/api/markets.ts` - Added `getTradeHistory` function
- `frontend/src/routes/portfolio/index.tsx` - Integrated TradeHistory component

---

### PORT-7: Create Empty State Components

**As a** user  
**I want** helpful empty states  
**So that** I know what to do when I have no data

**Acceptance Criteria:**
- [x] Empty portfolio: "You don't have any positions yet"
- [x] Empty trade history: "No trades yet"
- [x] CTA button linking to markets page
- [x] Illustration/icon for visual appeal
- [x] Different message for filtered empty results

**Implementation Notes:**
- Created reusable `EmptyState` component in `frontend/src/components/ui/EmptyState.tsx`
- Supports custom icon, title, description, and optional action button
- Used in portfolio page for empty positions
- Used in TradeHistory component for empty trade history
- Consistent styling with dark theme and border
- Icons from lucide-react (Wallet, History)
- CTA button links to markets page with proper search params

**Files Created:**
- `frontend/src/components/ui/EmptyState.tsx`

**Files Modified:**
- `frontend/src/routes/portfolio/index.tsx` - Refactored to use EmptyState component
- `frontend/src/components/portfolio/TradeHistory.tsx` - Uses EmptyState for no trades

---