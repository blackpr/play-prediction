## Epic 4: Market Detail

**Goal:** Single market view with all details and price chart.

### DETAIL-1: Implement GET /markets/:id

**As a** user  
**I want** full market details  
**So that** I can make informed trades

**Endpoint:** `GET /v1/markets/:id`

**Acceptance Criteria:**
- [x] Public endpoint
- [x] Return full market data
- [x] Join liquidity_pool data
- [x] Calculate prices
- [x] Include k-invariant value
- [x] Include stats: totalVolume, volume24h, tradeCount, uniqueTraders
- [x] Return 404 if market not found

**References:** API_SPECIFICATION.md Section 4.3.2

---

### DETAIL-2: Implement Price History Endpoint

**As a** user  
**I want** historical price data  
**So that** I can see price trends

**Endpoint:** `GET /v1/markets/:id/price-history`

**Query Params:**
- `interval` (default: 1h) - 1m, 5m, 1h, 1d
- `from` (default: 24h ago)
- `to` (default: now)

**Acceptance Criteria:**
- [x] Aggregate trade_ledger data by interval
- [x] Return OHLC candles for YES price
- [x] Include volume per candle
- [x] Limit to reasonable date range

**References:** API_SPECIFICATION.md Section 4.3.3

---

### DETAIL-3: Create Market Detail Page

**As a** user  
**I want** a market detail page  
**So that** I can view and trade a market

**Route:** `/markets/$marketId`

**Acceptance Criteria:**
- [x] Create route at `src/routes/markets/$marketId.tsx`
- [x] Load market data with loader
- [x] Show market title, description
- [x] Show status badge and close time
- [x] Show ProbabilityBar
- [x] Show PriceChart
- [x] Show TradeForm (from Epic 6)
- [x] Show market stats

**References:** FRONTEND_ARCHITECTURE.md Section 5.3

---

### DETAIL-4: Create ProbabilityBar Component

**As a** user  
**I want** a visual probability bar  
**So that** I can quickly see YES/NO odds

**Acceptance Criteria:**
- [x] Create `src/components/market/ProbabilityBar.tsx`
- [x] Green portion for YES percentage
- [x] Red portion for NO percentage
- [x] Optional labels showing percentages
- [x] Size variants: sm, md, lg
- [x] Smooth transitions on updates

**References:** FRONTEND_COMPONENTS.md Section 4.2

---

### DETAIL-5: Create PriceChart Component

**As a** user  
**I want** a price chart  
**So that** I can see historical prices

**Acceptance Criteria:**
- [x] Create `src/components/market/PriceChart.tsx`
- [x] Use Recharts LineChart
- [x] Two lines: YES price (green), NO price (red)
- [x] X-axis: timestamps
- [x] Y-axis: 0-100% scale
- [x] Tooltip with date and prices
- [x] Responsive container

**References:** FRONTEND_COMPONENTS.md Section 4.3

---

### DETAIL-6: Show Market Metadata

**As a** user  
**I want** to see market metadata  
**So that** I understand the market context

**Acceptance Criteria:**
- [x] Display close time with countdown
- [x] Display total volume
- [x] Display unique traders count
- [x] Display trade count
- [x] Display resolution criteria from description
- [x] Display category badge

---

### DETAIL-7: Add Price Chart Time Interval Selector

**As a** user  
**I want** to select different time intervals for the price chart  
**So that** I can analyze short-term and long-term trends

**Acceptance Criteria:**
- [x] Interval buttons: 1H, 24H, 7D, 30D, All
- [x] Update chart data when interval changes
- [x] Remember user preference (localStorage)
- [x] Loading state while fetching new data
- [x] Disable intervals with insufficient data

**References:** API_SPECIFICATION.md Section 4.3.3

---

### DETAIL-8: Show Market Creator Info

**As a** user  
**I want** to see who created the market  
**So that** I can assess the market's credibility

**Acceptance Criteria:**
- [x] Display creator's display name or "Admin"
- [x] Show creation date
- [x] Admin badge if created by admin
- [x] Link to view creator's other markets (optional)

---

### DETAIL-9: Create Recent Trades Component

**As a** user  
**I want** to see recent trades in the market  
**So that** I can gauge market activity and trends

**Acceptance Criteria:**
- [x] Create `src/components/market/RecentTrades.tsx`
- [x] List last 10-20 trades
- [x] Show time, side (YES/NO), amount, and price
- [x] Color code by side (Green/Red)
- [x] Animate new trades entering the list
- [x] Update in real-time via WebSocket

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

**Notes:** Initial implementation uses polling (5s interval). WebSocket infrastructure is in place for future real-time updates.

---