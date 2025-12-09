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
- [ ] Public endpoint (no auth required)
- [ ] Query markets table with filters
- [ ] Join with liquidity_pools for price data
- [ ] Calculate yesPrice, noPrice from pool quantities
- [ ] Calculate 24h volume from trade_ledger
- [ ] Return paginated response
- [ ] Cache results (5 second TTL)

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
- [ ] Implement price calculation: `P_YES = noQty / (yesQty + noQty)`
- [ ] Implement price calculation: `P_NO = yesQty / (yesQty + noQty)`
- [ ] Verify `P_YES + P_NO = 1.0` always holds
- [ ] Return prices as decimal strings (6 decimal places)
- [ ] Handle edge case: empty pool returns 0.50/0.50

**References:** SYSTEM_DESIGN.md Section 1.4, ENGINE_LOGIC.md Section 2.2

---

### MARKET-3: Create Markets List Page

**As a** user  
**I want** a markets listing page  
**So that** I can browse available markets

**Route:** `/markets`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/markets/index.tsx`
- [ ] Use type-safe search params with Zod
- [ ] Use `useMarkets()` hook with TanStack Query
- [ ] Display grid of MarketCard components
- [ ] Loading state with skeletons
- [ ] Empty state message
- [ ] Pagination controls

**References:** FRONTEND_ARCHITECTURE.md Section 5.4

---

### MARKET-4: Create MarketCard Component

**As a** user  
**I want** market cards  
**So that** I can see market info at a glance

**Acceptance Criteria:**
- [ ] Create `src/components/market/MarketCard.tsx`
- [ ] Status badge (colored by status)
- [ ] Time until close (using date-fns)
- [ ] Market title (2 line clamp)
- [ ] Probability bar showing YES/NO %
- [ ] Volume stat
- [ ] YES/NO percentages
- [ ] Link to market detail

**References:** FRONTEND_COMPONENTS.md Section 4.1

---

### MARKET-5: Add Status Filter Tabs

**As a** user  
**I want** to filter markets by status  
**So that** I can find active or resolved markets

**Acceptance Criteria:**
- [ ] Tab buttons: All, Active, Resolved
- [ ] Update URL search params on change
- [ ] Highlight active tab
- [ ] Reset to page 1 on filter change

---

### MARKET-6: Add Sorting Options

**As a** user  
**I want** to sort markets  
**So that** I can find relevant ones

**Acceptance Criteria:**
- [ ] Sort dropdown: Newest, Most Volume, Ending Soon
- [ ] Update URL search params on change
- [ ] Reset to page 1 on sort change

---

### MARKET-7: Add Market Search

**As a** user  
**I want** to search markets by title  
**So that** I can find specific markets quickly

**Acceptance Criteria:**
- [ ] Search input in markets page header
- [ ] Debounce search input (300ms)
- [ ] Update URL search params with query
- [ ] Search server-side (not client filter)
- [ ] Clear search button
- [ ] Show "No results" message when empty

---

### MARKET-8: Add Category Filter

**As a** user  
**I want** to filter markets by category  
**So that** I can browse specific topics

**Acceptance Criteria:**
- [ ] Category chips/pills below search
- [ ] "All" option to clear filter
- [ ] Combine with status filter
- [ ] Update URL search params
- [ ] Categories fetched from backend or defined in config

**Default Categories:**
- Sports, Politics, Crypto, Technology, Entertainment, Weather, Other

---