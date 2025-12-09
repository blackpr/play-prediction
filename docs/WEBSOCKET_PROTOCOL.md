# WebSocket Protocol Specification

**Version:** 3.1  
**Library:** @fastify/websocket  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Connection Lifecycle](#2-connection-lifecycle)
3. [Message Format](#3-message-format)
4. [Client Messages](#4-client-messages)
5. [Server Messages](#5-server-messages)
6. [Channels & Subscriptions](#6-channels--subscriptions)
7. [Error Handling](#7-error-handling)
8. [Rate Limiting](#8-rate-limiting)
9. [Implementation Example](#9-implementation-example)

---

## 1. Overview

### 1.1 Purpose

The WebSocket protocol provides real-time updates for:
- Price changes after trades
- Market state changes (paused, resolved, cancelled)
- User-specific trade confirmations
- Portfolio updates

### 1.2 Connection URL

```
wss://api.play-prediction.com/ws
```

Development:
```
ws://localhost:3000/ws
```

### 1.3 Authentication (via Supabase Session)

WebSocket connections use the same session cookie as REST API calls:

```
wss://api.play-prediction.com/ws
Cookie: sb-<project-ref>-auth-token=<session>
```

**Note:** The session is validated on connection using `supabase.auth.getUser()` (server-side). If the session expires, the server will send a `SESSION_EXPIRED` error and close the connection. Clients should refresh their session via the REST API and reconnect.

> **Important:** We validate sessions server-side only. The WebSocket server uses `@supabase/ssr` to validate the session cookie.

---

## 2. Connection Lifecycle

```
┌────────┐                         ┌────────┐
│ Client │                         │ Server │
└───┬────┘                         └───┬────┘
    │                                  │
    │  WebSocket Connect               │
    │  ?token=eyJ...                   │
    │─────────────────────────────────>│
    │                                  │  Validate JWT
    │                                  │
    │  CONNECTED                       │
    │<─────────────────────────────────│
    │  { type: "connected",            │
    │    userId: "...",                │
    │    serverTime: "..." }           │
    │                                  │
    │  SUBSCRIBE                       │
    │  { channel: "market:mkt_123" }   │
    │─────────────────────────────────>│
    │                                  │
    │  SUBSCRIBED                      │
    │<─────────────────────────────────│
    │                                  │
    │  ... price updates ...           │
    │<─────────────────────────────────│
    │                                  │
    │  PING                            │
    │─────────────────────────────────>│
    │                                  │
    │  PONG                            │
    │<─────────────────────────────────│
    │                                  │
    │  CLOSE                           │
    │─────────────────────────────────>│
    │                                  │
```

### 2.1 Connection States

| State | Description |
|-------|-------------|
| `CONNECTING` | WebSocket handshake in progress |
| `CONNECTED` | Authenticated and ready |
| `RECONNECTING` | Attempting automatic reconnection |
| `DISCONNECTED` | Connection closed |

### 2.2 Heartbeat

- **Client PING:** Every 30 seconds
- **Server PONG:** Immediate response
- **Timeout:** Connection closed after 60 seconds without heartbeat

---

## 3. Message Format

All messages are JSON objects with a `type` field.

### 3.1 Client → Server

```typescript
interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  id?: string;           // Optional message ID for correlation
  channel?: string;      // Required for subscribe/unsubscribe
  params?: object;       // Optional parameters
}
```

### 3.2 Server → Client

```typescript
interface ServerMessage {
  type: string;          // Message type
  id?: string;           // Correlation ID (if client provided one)
  channel?: string;      // Channel this message belongs to
  data?: object;         // Message payload
  error?: {              // Present only on errors
    code: string;
    message: string;
  };
  timestamp: string;     // ISO 8601 timestamp
}
```

---

## 4. Client Messages

### 4.1 Subscribe

Subscribe to a channel for real-time updates.

```json
{
  "type": "subscribe",
  "id": "sub_123",
  "channel": "market:mkt_abc123"
}
```

**Response:**
```json
{
  "type": "subscribed",
  "id": "sub_123",
  "channel": "market:mkt_abc123",
  "timestamp": "2024-12-09T10:30:00Z"
}
```

### 4.2 Unsubscribe

Unsubscribe from a channel.

```json
{
  "type": "unsubscribe",
  "id": "unsub_456",
  "channel": "market:mkt_abc123"
}
```

**Response:**
```json
{
  "type": "unsubscribed",
  "id": "unsub_456",
  "channel": "market:mkt_abc123",
  "timestamp": "2024-12-09T10:30:00Z"
}
```

### 4.3 Ping

Keep-alive heartbeat.

```json
{
  "type": "ping",
  "id": "ping_789"
}
```

**Response:**
```json
{
  "type": "pong",
  "id": "ping_789",
  "timestamp": "2024-12-09T10:30:00Z"
}
```

---

## 5. Server Messages

### 5.1 Connection Messages

#### Connected

Sent immediately after successful authentication.

```json
{
  "type": "connected",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionId": "sess_xyz789",
    "serverTime": "2024-12-09T10:30:00Z"
  },
  "timestamp": "2024-12-09T10:30:00Z"
}
```

### 5.2 Market Channel Messages

#### Price Update

Sent after any trade affects the market price.

```json
{
  "type": "price_update",
  "channel": "market:mkt_abc123",
  "data": {
    "marketId": "mkt_abc123",
    "yesPrice": "0.5523",
    "noPrice": "0.4477",
    "yesQty": "4500000",
    "noQty": "5500000",
    "lastTradePrice": "0.5510",
    "lastTradeSide": "YES",
    "lastTradeSize": "50000",
    "volume24h": "1500000"
  },
  "timestamp": "2024-12-09T10:30:01Z"
}
```

#### Market State Change

Sent when market status changes.

```json
{
  "type": "market_state",
  "channel": "market:mkt_abc123",
  "data": {
    "marketId": "mkt_abc123",
    "previousStatus": "ACTIVE",
    "newStatus": "PAUSED",
    "reason": "Admin paused for investigation"
  },
  "timestamp": "2024-12-09T10:30:00Z"
}
```

#### Market Resolved

Sent when market is resolved.

```json
{
  "type": "market_resolved",
  "channel": "market:mkt_abc123",
  "data": {
    "marketId": "mkt_abc123",
    "resolution": "YES",
    "resolvedAt": "2024-12-09T10:30:00Z"
  },
  "timestamp": "2024-12-09T10:30:00Z"
}
```

#### Trade Broadcast

Sent to all market subscribers when a trade occurs (anonymized).

```json
{
  "type": "trade",
  "channel": "market:mkt_abc123",
  "data": {
    "marketId": "mkt_abc123",
    "action": "BUY",
    "side": "YES",
    "amount": "100000",
    "shares": "95000",
    "newYesPrice": "0.5523",
    "newNoPrice": "0.4477"
  },
  "timestamp": "2024-12-09T10:30:01Z"
}
```

### 5.3 User Channel Messages

User-specific channel: `user:<userId>`

#### Trade Confirmation

Sent to the user who executed the trade.

```json
{
  "type": "trade_confirmed",
  "channel": "user:550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "transactionId": "txn_xyz789",
    "marketId": "mkt_abc123",
    "action": "BUY",
    "side": "YES",
    "amountIn": "100000",
    "sharesOut": "95000",
    "feePaid": "2000",
    "newBalance": "4900000",
    "newPosition": {
      "yesQty": "195000",
      "noQty": "0"
    }
  },
  "timestamp": "2024-12-09T10:30:01Z"
}
```

#### Balance Update

Sent when user balance changes (trade, resolution payout, admin grant).

```json
{
  "type": "balance_update",
  "channel": "user:550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "previousBalance": "5000000",
    "newBalance": "4900000",
    "change": "-100000",
    "reason": "TRADE",
    "referenceId": "txn_xyz789"
  },
  "timestamp": "2024-12-09T10:30:01Z"
}
```

#### Points Granted

Sent when admin grants points to user.

```json
{
  "type": "points_granted",
  "channel": "user:550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "grantId": "grant_abc123",
    "amount": "5000000",
    "newBalance": "9900000",
    "reason": "Contest winner reward"
  },
  "timestamp": "2024-12-09T10:30:01Z"
}
```

#### Resolution Payout

Sent when user receives payout from resolved market.

```json
{
  "type": "resolution_payout",
  "channel": "user:550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "marketId": "mkt_abc123",
    "marketTitle": "Will BTC exceed $100k?",
    "resolution": "YES",
    "winningShares": "95000",
    "payout": "95000",
    "newBalance": "4995000"
  },
  "timestamp": "2024-12-09T10:30:01Z"
}
```

### 5.4 Global Channel Messages

Channel: `global`

#### New Market

Sent when a new market becomes active.

```json
{
  "type": "new_market",
  "channel": "global",
  "data": {
    "marketId": "mkt_new123",
    "title": "Will it rain tomorrow in NYC?",
    "category": "Weather",
    "yesPrice": "0.50",
    "noPrice": "0.50",
    "closesAt": "2024-12-10T23:59:59Z"
  },
  "timestamp": "2024-12-09T10:30:00Z"
}
```

---

## 6. Channels & Subscriptions

### 6.1 Available Channels

| Channel Pattern | Description | Auth Required |
|-----------------|-------------|---------------|
| `global` | Platform-wide events | No |
| `market:<marketId>` | Market-specific updates | No |
| `user:<userId>` | User-specific updates | Yes (own user only) |

### 6.2 Auto-Subscriptions

Upon connection, users are automatically subscribed to:
- `user:<their_userId>` (for authenticated users)

### 6.3 Subscription Limits

| Limit | Value |
|-------|-------|
| Max subscriptions per connection | 50 |
| Max connections per user | 5 |

---

## 7. Error Handling

### 7.1 Error Message Format

```json
{
  "type": "error",
  "error": {
    "code": "INVALID_CHANNEL",
    "message": "Channel 'xyz' does not exist"
  },
  "timestamp": "2024-12-09T10:30:00Z"
}
```

### 7.2 Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `SESSION_INVALID` | Session cookie invalid or missing | Login via REST API |
| `SESSION_EXPIRED` | Session has expired | Refresh session and reconnect |
| `INVALID_MESSAGE` | Message format invalid | Fix message format |
| `INVALID_CHANNEL` | Channel doesn't exist | Use valid channel |
| `UNAUTHORIZED` | Not allowed to subscribe | Check permissions |
| `RATE_LIMITED` | Too many messages | Slow down |
| `MAX_SUBSCRIPTIONS` | Too many subscriptions | Unsubscribe from some |

### 7.3 Connection Close Codes

| Code | Reason |
|------|--------|
| 1000 | Normal closure |
| 1001 | Server going away |
| 1008 | Policy violation (auth failed) |
| 1009 | Message too large |
| 1013 | Try again later (overloaded) |
| 4000 | Session expired |
| 4001 | Session invalid |
| 4002 | Rate limited |

---

## 8. Rate Limiting

### 8.1 Message Limits

| Type | Limit | Window |
|------|-------|--------|
| Inbound messages | 10 | 1 second |
| Subscribe requests | 5 | 1 second |
| Total messages per minute | 100 | 1 minute |

### 8.2 Rate Limit Response

When rate limited, server sends:

```json
{
  "type": "error",
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many messages",
    "retryAfter": 5
  },
  "timestamp": "2024-12-09T10:30:00Z"
}
```

---

## 9. Implementation Example

### 9.1 Server Implementation (Fastify with Supabase Auth)

```typescript
// src/websocket/server.ts

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { WebSocketClient, ConnectionManager } from './connection-manager';

const fastify = Fastify({ logger: true });

await fastify.register(websocket);

// WebSocket route - validates session via Supabase Auth
fastify.get('/ws', { websocket: true }, async (socket, req) => {
  // Create Supabase client with request cookies
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(req.headers.cookie ?? '');
        },
        setAll() {}, // WebSocket can't set cookies
      },
    }
  );
  
  // Validate session with Supabase Auth server (always use getUser, never getSession)
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    socket.send(JSON.stringify({
      type: 'error',
      error: { code: 'SESSION_INVALID', message: 'Authentication failed' },
      timestamp: new Date().toISOString(),
    }));
    socket.close(4001, 'Invalid session');
    return;
  }
  
  const userId = user.id;
  
  // Create client instance
  const client = new WebSocketClient(socket, userId);
  ConnectionManager.add(client);
  
  // Send connected message
  socket.send(JSON.stringify({
    type: 'connected',
    data: {
      userId,
      sessionId: client.sessionId,
      serverTime: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  }));
  
  // Auto-subscribe to user channel
  client.subscribe(`user:${userId}`);
  
  // Handle incoming messages
  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      handleClientMessage(client, message);
    } catch (err) {
      client.sendError('INVALID_MESSAGE', 'Failed to parse message');
    }
  });
  
  // Handle disconnect
  socket.on('close', () => {
    ConnectionManager.remove(client);
  });
});

function handleClientMessage(client: WebSocketClient, message: any) {
  switch (message.type) {
    case 'subscribe':
      handleSubscribe(client, message);
      break;
    case 'unsubscribe':
      handleUnsubscribe(client, message);
      break;
    case 'ping':
      client.send({
        type: 'pong',
        id: message.id,
        timestamp: new Date().toISOString(),
      });
      break;
    default:
      client.sendError('INVALID_MESSAGE', `Unknown message type: ${message.type}`);
  }
}

function handleSubscribe(client: WebSocketClient, message: any) {
  const { channel, id } = message;
  
  // Validate channel
  if (!isValidChannel(channel)) {
    client.sendError('INVALID_CHANNEL', `Channel '${channel}' does not exist`, id);
    return;
  }
  
  // Check authorization for user channels
  if (channel.startsWith('user:') && channel !== `user:${client.userId}`) {
    client.sendError('UNAUTHORIZED', 'Cannot subscribe to other users', id);
    return;
  }
  
  // Check subscription limit
  if (client.subscriptions.size >= 50) {
    client.sendError('MAX_SUBSCRIPTIONS', 'Maximum subscriptions reached', id);
    return;
  }
  
  client.subscribe(channel);
  client.send({
    type: 'subscribed',
    id,
    channel,
    timestamp: new Date().toISOString(),
  });
}
```

### 9.2 Broadcasting Price Updates

```typescript
// src/websocket/broadcaster.ts

import { ConnectionManager } from './connection-manager';

/**
 * Broadcast price update to all market subscribers
 */
export function broadcastPriceUpdate(
  marketId: string,
  data: {
    yesPrice: string;
    noPrice: string;
    yesQty: string;
    noQty: string;
    lastTradeSide: string;
    lastTradeSize: string;
  }
) {
  const channel = `market:${marketId}`;
  const message = {
    type: 'price_update',
    channel,
    data: {
      marketId,
      ...data,
    },
    timestamp: new Date().toISOString(),
  };
  
  ConnectionManager.broadcast(channel, message);
}

/**
 * Send trade confirmation to specific user
 */
export function sendTradeConfirmation(
  userId: string,
  data: {
    transactionId: string;
    marketId: string;
    action: string;
    side: string;
    amountIn: string;
    sharesOut: string;
    feePaid: string;
    newBalance: string;
  }
) {
  const channel = `user:${userId}`;
  const message = {
    type: 'trade_confirmed',
    channel,
    data,
    timestamp: new Date().toISOString(),
  };
  
  ConnectionManager.sendToUser(userId, message);
}
```

### 9.3 Client Implementation (TypeScript)

```typescript
// Client-side WebSocket manager
// Note: Session cookie is sent automatically by browser (same-origin)

class PredictionWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: NodeJS.Timer | null = null;
  
  constructor(
    private baseUrl: string,
    private onMessage: (message: any) => void,
    private onStateChange: (state: 'connected' | 'disconnected' | 'reconnecting') => void
  ) {}
  
  connect() {
    // Session cookie is sent automatically by browser
    // No token parameter needed - auth via HTTP-only cookie
    this.ws = new WebSocket(this.baseUrl);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStateChange('connected');
      this.startPing();
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'error' && message.error.code === 'TOKEN_EXPIRED') {
        this.reconnect();
        return;
      }
      
      this.onMessage(message);
    };
    
    this.ws.onclose = (event) => {
      this.stopPing();
      
      if (event.code === 4000 || event.code === 4001) {
        // Auth error - don't auto-reconnect
        this.onStateChange('disconnected');
        return;
      }
      
      this.reconnect();
    };
    
    this.ws.onerror = () => {
      this.reconnect();
    };
  }
  
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onStateChange('disconnected');
      return;
    }
    
    this.onStateChange('reconnecting');
    this.reconnectAttempts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => this.connect(), delay);
  }
  
  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', id: `ping_${Date.now()}` });
    }, 30000);
  }
  
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  subscribe(channel: string) {
    this.send({
      type: 'subscribe',
      channel,
      id: `sub_${Date.now()}`,
    });
  }
  
  unsubscribe(channel: string) {
    this.send({
      type: 'unsubscribe',
      channel,
      id: `unsub_${Date.now()}`,
    });
  }
  
  disconnect() {
    this.stopPing();
    this.ws?.close(1000, 'Client disconnect');
  }
}

// Usage
// Note: No token needed - session cookie sent automatically
const ws = new PredictionWebSocket(
  'wss://api.play-prediction.com/ws',
  (message) => {
    switch (message.type) {
      case 'price_update':
        updateMarketPrice(message.data);
        break;
      case 'trade_confirmed':
        showTradeConfirmation(message.data);
        break;
      case 'balance_update':
        updateUserBalance(message.data.newBalance);
        break;
    }
  },
  (state) => {
    console.log('WebSocket state:', state);
    // If disconnected due to session expiry, refresh session via REST API
    if (state === 'disconnected') {
      // Call /auth/refresh or redirect to login
    }
  }
);

ws.connect();
ws.subscribe('market:mkt_abc123');
```

---

## Related Documents

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — System architecture overview
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) — REST API endpoints
- [ENGINE_LOGIC.md](./ENGINE_LOGIC.md) — Trading engine implementation

---

*Document Version: 3.1 | Protocol Version: 1.0*

