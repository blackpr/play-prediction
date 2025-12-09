## Epic 11: Real-Time Updates (WebSocket)

**Goal:** Live price updates and trade notifications.

### WS-1: Set Up Fastify WebSocket Server

**As a** backend developer  
**I want** WebSocket support  
**So that** I can push real-time updates

**Acceptance Criteria:**
- [ ] Register @fastify/websocket plugin
- [ ] Create `/ws` endpoint
- [ ] Validate session from cookies
- [ ] Reject connection if not authenticated (or allow public for prices)
- [ ] Send "connected" message on success
- [ ] Handle ping/pong for keepalive

**Connection URL:** `wss://api.example.com/ws`

**References:** WEBSOCKET_PROTOCOL.md Sections 1-2, 9.1

---

### WS-2: Implement Channel Subscriptions

**As a** backend developer  
**I want** channel management  
**So that** clients receive relevant updates

**Channels:**
- `global` - Platform-wide events (new markets)
- `market:{marketId}` - Market-specific (prices, state)
- `user:{userId}` - User-specific (trade confirmations, balance)

**Acceptance Criteria:**
- [ ] Subscribe message: `{ type: "subscribe", channel: "market:abc" }`
- [ ] Unsubscribe message: `{ type: "unsubscribe", channel: "..." }`
- [ ] Confirm subscription: `{ type: "subscribed", channel: "..." }`
- [ ] Auto-subscribe user to their user channel
- [ ] Enforce authorization (can't subscribe to other users)
- [ ] Max 50 subscriptions per connection
- [ ] Max 5 connections per user

**References:** WEBSOCKET_PROTOCOL.md Sections 4, 6

---

### WS-3: Broadcast Price Updates After Trades

**As a** user  
**I want** live price updates  
**So that** I see current market prices

**Message Type:** `price_update`

**Acceptance Criteria:**
- [ ] After every trade, broadcast to `market:{marketId}`
- [ ] Include: yesPrice, noPrice, yesQty, noQty
- [ ] Include: lastTradePrice, lastTradeSide, lastTradeSize
- [ ] Include: volume24h
- [ ] Timestamp in ISO 8601

**Message:**
```json
{
  "type": "price_update",
  "channel": "market:mkt_abc",
  "data": {
    "marketId": "mkt_abc",
    "yesPrice": "0.5523",
    "noPrice": "0.4477",
    "yesQty": "4500000",
    "noQty": "5500000",
    "lastTradePrice": "0.5510",
    "lastTradeSide": "YES",
    "lastTradeSize": "50000"
  },
  "timestamp": "2024-12-09T10:30:01Z"
}
```

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

---

### WS-4: Send Trade Confirmations to User

**As a** user  
**I want** trade confirmations  
**So that** I know my trade succeeded

**Message Type:** `trade_confirmed`

**Acceptance Criteria:**
- [ ] Send to `user:{userId}` after trade completes
- [ ] Include full trade details
- [ ] Include new balance
- [ ] Include new position

**Also broadcast:**
- `balance_update` - when balance changes
- `resolution_payout` - when user receives payout
- `points_granted` - when admin grants points

**References:** WEBSOCKET_PROTOCOL.md Section 5.3

---

### WS-5: Create useWebSocket Hook

**As a** frontend developer  
**I want** WebSocket management  
**So that** components receive live updates

**Acceptance Criteria:**
- [ ] Create `src/hooks/useWebSocket.ts`
- [ ] Connect with session cookie
- [ ] Auto-reconnect with exponential backoff
- [ ] Ping every 30 seconds
- [ ] Handle disconnection states
- [ ] Subscribe/unsubscribe methods
- [ ] Custom message handler callback

**References:** FRONTEND_STATE.md Section 5, WEBSOCKET_PROTOCOL.md Section 9.3

---

### WS-6: Update TanStack Query Cache from WebSocket

**As a** frontend developer  
**I want** cache updates from WebSocket  
**So that** UI stays in sync

**Acceptance Criteria:**
- [ ] On `price_update`: Update market detail cache
- [ ] On `balance_update`: Update auth/me cache
- [ ] On `trade_confirmed`: Invalidate portfolio queries
- [ ] On `market_state`: Invalidate market queries
- [ ] On `market_resolved`: Invalidate market queries and portfolio
- [ ] Use `queryClient.setQueryData` for instant updates
- [ ] Use `queryClient.invalidateQueries` for refetch

**References:** FRONTEND_STATE.md Section 5.1, WEBSOCKET_PROTOCOL.md Section 5.2

---

### WS-7: Show Live Price Updates

**As a** user  
**I want** real-time prices  
**So that** I see the latest odds

**Acceptance Criteria:**
- [ ] Subscribe to market channel on detail page
- [ ] Update ProbabilityBar when prices change
- [ ] Update TradeForm prices
- [ ] Animate price changes
- [ ] Unsubscribe on unmount

---

### WS-8: Show Connection Status Indicator

**As a** user  
**I want** to see my connection status  
**So that** I know if real-time data is working

**Acceptance Criteria:**
- [ ] Connection status indicator in header
- [ ] States: Connected (green), Connecting (yellow), Disconnected (red)
- [ ] Tooltip with status details
- [ ] Reconnection attempt indicator
- [ ] Manual reconnect button when disconnected

---

### WS-9: Handle Live Trade Broadcasts

**As a** user  
**I want** to see trades happen in real-time  
**So that** the market feels alive

**Acceptance Criteria:**
- [ ] Listen for `trade` messages on market channel
- [ ] Update RecentTrades component list
- [ ] Flash/highlight the new trade
- [ ] Limit list size (keep last 20-50) in state
- [ ] Handle high frequency updates efficiently

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

---

### WS-10: Handle New Market Notifications

**As a** user  
**I want** to know when new markets are created  
**So that** I can be one of the first to trade

**Acceptance Criteria:**
- [ ] Listen for `new_market` messages on global channel
- [ ] Show toast notification with market title
- [ ] Option to click toast to go to market
- [ ] Add to markets list cache if on markets page

**References:** WEBSOCKET_PROTOCOL.md Section 5.4

---

### WS-11: Handle Market State Updates

**As a** user  
**I want** the UI to react to market state changes  
**So that** I don't try to trade on closed markets

**Acceptance Criteria:**
- [ ] Listen for `market_state` and `market_resolved` messages
- [ ] Update market status badge immediately
- [ ] Disable TradeForm if paused/resolved
- [ ] Show resolution banner if resolved
- [ ] Refresh market data to get full state

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

---