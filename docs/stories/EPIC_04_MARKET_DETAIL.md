## Epic 4: Market Detail

**Goal:** Single market view with all details and price chart.

### DETAIL-1: Implement GET /markets/:id

**As a** user  
**I want** full market details  
**So that** I can make informed trades

**Endpoint:** `GET /v1/markets/:id`

**Acceptance Criteria:**
- [ ] Public endpoint
- [ ] Return full market data
- [ ] Join liquidity_pool data
- [ ] Calculate prices
- [ ] Include k-invariant value
- [ ] Include stats: totalVolume, volume24h, tradeCount, uniqueTraders
- [ ] Return 404 if market not found

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
- [ ] Aggregate trade_ledger data by interval
- [ ] Return OHLC candles for YES price
- [ ] Include volume per candle
- [ ] Limit to reasonable date range

**References:** API_SPECIFICATION.md Section 4.3.3

---

### DETAIL-3: Create Market Detail Page

**As a** user  
**I want** a market detail page  
**So that** I can view and trade a market

**Route:** `/markets/$marketId`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/markets/$marketId.tsx`
- [ ] Load market data with loader
- [ ] Show market title, description
- [ ] Show status badge and close time
- [ ] Show ProbabilityBar
- [ ] Show PriceChart
- [ ] Show TradeForm (from Epic 6)
- [ ] Show market stats

**References:** FRONTEND_ARCHITECTURE.md Section 5.3

---

### DETAIL-4: Create ProbabilityBar Component

**As a** user  
**I want** a visual probability bar  
**So that** I can quickly see YES/NO odds

**Acceptance Criteria:**
- [ ] Create `src/components/market/ProbabilityBar.tsx`
- [ ] Green portion for YES percentage
- [ ] Red portion for NO percentage
- [ ] Optional labels showing percentages
- [ ] Size variants: sm, md, lg
- [ ] Smooth transitions on updates

**References:** FRONTEND_COMPONENTS.md Section 4.2

---

### DETAIL-5: Create PriceChart Component

**As a** user  
**I want** a price chart  
**So that** I can see historical prices

**Acceptance Criteria:**
- [ ] Create `src/components/market/PriceChart.tsx`
- [ ] Use Recharts LineChart
- [ ] Two lines: YES price (green), NO price (red)
- [ ] X-axis: timestamps
- [ ] Y-axis: 0-100% scale
- [ ] Tooltip with date and prices
- [ ] Responsive container

**References:** FRONTEND_COMPONENTS.md Section 4.3

---

### DETAIL-6: Show Market Metadata

**As a** user  
**I want** to see market metadata  
**So that** I understand the market context

**Acceptance Criteria:**
- [ ] Display close time with countdown
- [ ] Display total volume
- [ ] Display unique traders count
- [ ] Display trade count
- [ ] Display resolution criteria from description
- [ ] Display category badge

---

### DETAIL-7: Add Price Chart Time Interval Selector

**As a** user  
**I want** to select different time intervals for the price chart  
**So that** I can analyze short-term and long-term trends

**Acceptance Criteria:**
- [ ] Interval buttons: 1H, 24H, 7D, 30D, All
- [ ] Update chart data when interval changes
- [ ] Remember user preference (localStorage)
- [ ] Loading state while fetching new data
- [ ] Disable intervals with insufficient data

**References:** API_SPECIFICATION.md Section 4.3.3

---

### DETAIL-8: Show Market Creator Info

**As a** user  
**I want** to see who created the market  
**So that** I can assess the market's credibility

**Acceptance Criteria:**
- [ ] Display creator's display name or "Admin"
- [ ] Show creation date
- [ ] Admin badge if created by admin
- [ ] Link to view creator's other markets (optional)

---

### DETAIL-9: Create Recent Trades Component

**As a** user  
**I want** to see recent trades in the market  
**So that** I can gauge market activity and trends

**Acceptance Criteria:**
- [ ] Create `src/components/market/RecentTrades.tsx`
- [ ] List last 10-20 trades
- [ ] Show time, side (YES/NO), amount, and price
- [ ] Color code by side (Green/Red)
- [ ] Animate new trades entering the list
- [ ] Update in real-time via WebSocket

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

---