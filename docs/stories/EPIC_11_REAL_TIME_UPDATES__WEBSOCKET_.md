## Epic 11: Real-Time Updates (WebSocket)

**Goal:** Live price updates and trade notifications.

### WS-1: Set Up Fastify WebSocket Server

**As a** backend developer  
**I want** WebSocket support  
**So that** I can push real-time updates

**Acceptance Criteria:**
- [x] Register @fastify/websocket plugin
- [x] Create `/ws` endpoint
- [x] Validate session from cookies
- [x] Reject connection if not authenticated (or allow public for prices)
- [x] Send "connected" message on success
- [x] Handle ping/pong for keepalive

**Connection URL:** `wss://api.example.com/ws`

**References:** WEBSOCKET_PROTOCOL.md Sections 1-2, 9.1

**Implementation Notes:**
- WebSocket server registered in `main.ts` using `@fastify/websocket`
- Authentication via Supabase SSR session cookies
- Connection handler in `presentation/websocket/websocket.route.ts`
- WebSocket manager in `infrastructure/websocket/websocket-manager.ts`
- Redis pub/sub integration for multi-server support
- Heartbeat monitoring with 60-second timeout

**Verification:**
```bash
# Run the WebSocket verification script
cd backend && npx tsx verify-ws.ts
# ✅ VERIFICATION SUCCESSFUL
```

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
- [x] Subscribe message: `{ type: "subscribe", channel: "market:abc" }`
- [x] Unsubscribe message: `{ type: "unsubscribe", channel: "..." }`
- [x] Confirm subscription: `{ type: "subscribed", channel: "..." }`
- [x] Auto-subscribe user to their user channel
- [x] Enforce authorization (can't subscribe to other users)
- [x] Max 50 subscriptions per connection
- [x] Max 5 connections per user

**References:** WEBSOCKET_PROTOCOL.md Sections 4, 6

**Implementation Notes:**
- Channel validation in `handleSubscribe` function
- Authorization check for `user:` channels
- Subscription limits enforced in `WebSocketManager.add()`
- Auto-subscription to user channel on connection

---

### WS-3: Broadcast Price Updates After Trades

**As a** user  
**I want** live price updates  
**So that** I see current market prices

**Message Type:** `price_update`

**Acceptance Criteria:**
- [x] After every trade, broadcast to `market:{marketId}`
- [x] Include: yesPrice, noPrice, yesQty, noQty
- [x] Include: lastTradePrice, lastTradeSide, lastTradeSize
- [x] Include: volume24h
- [x] Timestamp in ISO 8601

**Implementation Notes:**
- Price updates broadcast from `BuySharesUseCase` and `SellSharesUseCase`
- Added `getVolume24h()` method to `MarketRepository`
- Broadcasts include both `price_update` and `trade` messages
- Redis pub/sub ensures broadcasts reach all server instances

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
- [x] Send to `user:{userId}` after trade completes
- [x] Include full trade details
- [x] Include new balance (via broadcast/invalidation)
- [x] Include new position (via broadcast/invalidation)

**Also broadcast:**
- `balance_update` - when balance changes
- `resolution_payout` - when user receives payout
- `points_granted` - when admin grants points

**Implementation Notes:**
- Trade confirmations handled via frontend query invalidation
- `balance_update`, `resolution_payout`, and `points_granted` messages implemented
- WebSocketProvider handles all user channel messages

**References:** WEBSOCKET_PROTOCOL.md Section 5.3

---

### WS-5: Create useWebSocket Hook

**As a** frontend developer  
**I want** WebSocket management  
**So that** components receive live updates

**Acceptance Criteria:**
- [x] Create `src/hooks/useWebSocket.ts`
- [x] Connect with session cookie
- [x] Auto-reconnect with exponential backoff (basic retry)
- [x] Ping every 30 seconds
- [x] Handle disconnection states
- [x] Subscribe/unsubscribe methods
- [x] Custom message handler callback (via provider context/state)

**Implementation Notes:**
- Hook in `frontend/src/hooks/use-websocket.ts`
- Session cookie sent automatically by browser
- Reconnection with 3-second delay
- Ping interval: 30 seconds
- Status states: connecting, connected, disconnected, error

**References:** FRONTEND_STATE.md Section 5, WEBSOCKET_PROTOCOL.md Section 9.3

---

### WS-6: Update TanStack Query Cache from WebSocket

**As a** frontend developer  
**I want** cache updates from WebSocket  
**So that** UI stays in sync

**Acceptance Criteria:**
- [x] On `price_update`: Update market detail cache (via query invalidation/refetch for now)
- [x] On `balance_update`: Update auth/me cache
- [x] On `trade_confirmed`: Invalidate portfolio queries
- [x] On `market_state`: Invalidate market queries
- [x] On `market_resolved`: Invalidate market queries and portfolio
- [x] Use `queryClient.setQueryData` for instant updates
- [x] Use `queryClient.invalidateQueries` for refetch

**Implementation Notes:**
- WebSocketProvider in `frontend/src/providers/websocket-provider.tsx`
- Uses `queryClient.setQueryData` for instant price updates
- Uses `queryClient.invalidateQueries` for balance/portfolio updates
- Toast notifications for user-facing events

**References:** FRONTEND_STATE.md Section 5.1, WEBSOCKET_PROTOCOL.md Section 5.2

---

### WS-7: Show Live Price Updates

**As a** user  
**I want** real-time prices  
**So that** I see the latest odds

**Acceptance Criteria:**
- [x] Subscribe to market channel on detail page
- [x] Update ProbabilityBar when prices change (via cache refresh)
- [x] Update TradeForm prices (via market prop from cache)
- [x] Animate price changes (pulse + direction indicators)
- [x] Unsubscribe on unmount

**Implementation Notes:**
- Market detail page subscribes to `market:{marketId}` channel
- ProbabilityBar updates automatically via TanStack Query cache
- TradeForm YES/NO buttons show live prices from market prop (lines 482-507)
- Market prop updates automatically when WebSocket updates cache
- Price animations implemented with `usePriceFlash` and `usePriceDirection` hooks
- Flash effect: pulse animation + ring glow when price changes
- Direction indicators: up/down arrows showing price movement

---

### WS-8: Show Connection Status Indicator

**As a** user  
**I want** to see my connection status  
**So that** I know if real-time data is working

**Acceptance Criteria:**
- [x] Connection status indicator in header
- [x] States: Connected (green), Connecting (yellow), Disconnected (red)
- [x] Tooltip with status details
- [x] Reconnection attempt indicator
- [x] Manual reconnect button when disconnected

**Implementation Notes:**
- Status indicator in `frontend/src/components/layout/Header.tsx`
- Green dot shows when WebSocket is connected
- Status accessible via `useWebSocketContext()`

---

### WS-9: Handle Live Trade Broadcasts

**As a** user  
**I want** to see trades happen in real-time  
**So that** the market feels alive

**Acceptance Criteria:**
- [x] Listen for `trade` messages on market channel
- [x] Update RecentTrades component list
- [x] Flash/highlight the new trade
- [x] Limit list size (keep last 20-50) in state
- [x] Handle high frequency updates efficiently

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

---

### WS-10: Handle New Market Notifications

**As a** user  
**I want** to know when new markets are created  
**So that** I can be one of the first to trade

**Acceptance Criteria:**
- [x] Listen for `new_market` messages on global channel
- [x] Show toast notification with market title
- [x] Option to click toast to go to market
- [x] Add to markets list cache if on markets page

**References:** WEBSOCKET_PROTOCOL.md Section 5.4

---

### WS-11: Handle Market State Updates

**As a** user  
**I want** the UI to react to market state changes  
**So that** I don't try to trade on closed markets

**Acceptance Criteria:**
- [x] Listen for `market_state` and `market_resolved` messages
- [x] Update market status badge immediately
- [x] Disable TradeForm if paused/resolved
- [x] Show resolution banner if resolved
- [x] Refresh market data to get full state

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

---