## Epic 3: Markets Listing

**Goal:** View all available markets with filtering/sorting.

### MARKET-1: Implement GET /markets Endpoint

**As a** user  
**I want** to list all markets  
**So that** I can find markets to trade

**Endpoint:** `GET /v1/markets`

**Query Params:**
- `status` (default: ACTIVE) - ACTIVE, RESOLVED, CANCELLED, all
- `category` - filter by category
- `page` (default: 1)
- `pageSize` (default: 20, max: 100)
- `sort` (default: createdAt) - createdAt, closesAt, volume
- `order` (default: desc) - asc, desc

**Acceptance Criteria:**
- [x] Public endpoint (no auth required)
- [x] Query markets table with filters
- [x] Join with liquidity_pools for price data
- [x] Calculate yesPrice, noPrice from pool quantities
- [x] Calculate 24h volume from trade_ledger
- [x] Return paginated response
- [x] Cache results (5 second TTL)

**Response includes per market:**
```json
{
  "id": "mkt_abc123",
  "title": "Will BTC exceed $100k?",
  "description": "...",
  "status": "ACTIVE",
  "category": "Crypto",
  "imageUrl": "https://...",
  "closesAt": "2024-12-31T23:59:59Z",
  "createdAt": "2024-12-01T00:00:00Z",
  "pool": {
    "yesQty": "5000000",
    "noQty": "5000000",
    "yesPrice": "0.50",
    "noPrice": "0.50"
  },
  "volume24h": "1500000"
}
```

**References:** API_SPECIFICATION.md Section 4.3.1

---

### MARKET-2: Calculate Pool Prices

**As a** backend developer  
**I want** correct price calculations  
**So that** prices always sum to 1.0

**Acceptance Criteria:**
- [x] Implement price calculation: `P_YES = noQty / (yesQty + noQty)`
- [x] Implement price calculation: `P_NO = yesQty / (yesQty + noQty)`
- [x] Verify `P_YES + P_NO = 1.0` always holds
- [x] Return prices as decimal strings (6 decimal places)
- [x] Handle edge case: empty pool returns 0.50/0.50

**References:** SYSTEM_DESIGN.md Section 1.4, ENGINE_LOGIC.md Section 2.2

---

### MARKET-3: Create Markets List Page

**As a** user  
**I want** a markets listing page  
**So that** I can browse available markets

**Route:** `/markets`

**Acceptance Criteria:**
- [x] Create route at `src/routes/markets/index.tsx`
- [x] Use type-safe search params with Zod
- [x] Use `useMarkets()` hook with TanStack Query
- [x] Display grid of MarketCard components
- [x] Loading state with skeletons
- [x] Empty state message
- [x] Pagination controls

**References:** FRONTEND_ARCHITECTURE.md Section 5.4

---

### MARKET-4: Create MarketCard Component

**As a** user  
**I want** market cards  
**So that** I can see market info at a glance

**Acceptance Criteria:**
- [x] Create `src/components/market/MarketCard.tsx`
- [x] Status badge (colored by status)
- [x] Time until close (using date-fns)
- [x] Market title (2 line clamp)
- [x] Probability bar showing YES/NO %
- [x] Volume stat
- [x] YES/NO percentages
- [x] Link to market detail

**References:** FRONTEND_COMPONENTS.md Section 4.1

---

### MARKET-5: Add Status Filter Tabs

**As a** user  
**I want** to filter markets by status  
**So that** I can find active or resolved markets

**Acceptance Criteria:**
- [x] Tab buttons: All, Active, Resolved
- [x] Update URL search params on change
- [x] Highlight active tab
- [x] Reset to page 1 on filter change

---

### MARKET-6: Add Sorting Options

**As a** user  
**I want** to sort markets  
**So that** I can find relevant ones

**Acceptance Criteria:**
- [x] Sort dropdown: Newest, Most Volume, Ending Soon
- [x] Update URL search params on change
- [x] Reset to page 1 on sort change

---

### MARKET-7: Add Market Search

**As a** user  
**I want** to search markets by title  
**So that** I can find specific markets quickly

**Acceptance Criteria:**
- [x] Search input in markets page header
- [x] Debounce search input (300ms)
- [x] Update URL search params with query
- [x] Search server-side (not client filter)
- [x] Clear search button
- [x] Show "No results" message when empty

---

### MARKET-8: Add Category Filter

**As a** user  
**I want** to filter markets by category  
**So that** I can browse specific topics

**Acceptance Criteria:**
- [x] Category chips/pills below search
- [x] "All" option to clear filter
- [x] Combine with status filter
- [x] Update URL search params
- [x] Categories fetched from backend or defined in config

**Default Categories:**
- Sports, Politics, Crypto, Technology, Entertainment, Weather, Other

---