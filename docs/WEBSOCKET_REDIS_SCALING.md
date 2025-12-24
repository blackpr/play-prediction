# WebSocket Redis Pub/Sub Architecture

**Version:** 1.0  
**Last Updated:** December 2025

---

## Overview

The WebSocket implementation uses **Redis Pub/Sub** to enable horizontal scaling across multiple server instances. This allows WebSocket connections to be distributed across servers while maintaining real-time message delivery to all clients.

## Architecture

### Single-Server (Before)

```
┌─────────┐     WebSocket      ┌────────┐
│ Client1 │◄──────────────────►│ Server │
└─────────┘                    │        │
┌─────────┐     WebSocket      │  (In-  │
│ Client2 │◄──────────────────►│ Memory)│
└─────────┘                    └────────┘
```

**Limitation:** All clients must connect to the same server instance.

### Multi-Server with Redis (After)

```
┌─────────┐    WS     ┌──────────┐
│ Client1 │◄─────────►│ Server 1 │◄──┐
└─────────┘           └──────────┘   │
                                     │
┌─────────┐    WS     ┌──────────┐   │   ┌───────┐
│ Client2 │◄─────────►│ Server 2 │◄──┼──►│ Redis │
└─────────┘           └──────────┘   │   │Pub/Sub│
                                     │   └───────┘
┌─────────┐    WS     ┌──────────┐   │
│ Client3 │◄─────────►│ Server 3 │◄──┘
└─────────┘           └──────────┘
```

**Benefit:** Clients can connect to any server and receive messages from events on any other server.

## Components

### 1. RedisPubSubService

**Location:** `backend/src/infrastructure/websocket/redis-pubsub.service.ts`

**Responsibilities:**
- Maintains dedicated Redis connections for publishing and subscribing
- Publishes WebSocket messages to Redis channels
- Subscribes to Redis patterns and forwards to WebSocketManager
- Handles graceful shutdown

**Redis Channel Patterns:**
- `ws:broadcast:{channel}` - Broadcast to all subscribers of a WebSocket channel
- `ws:user:{userId}` - Send to specific user across all servers

### 2. WebSocketManager (Enhanced)

**Location:** `backend/src/infrastructure/websocket/websocket-manager.ts`

**Changes:**
- Added `redisPubSub` dependency (optional for backward compatibility)
- `broadcast()` and `sendToUser()` now publish to Redis
- Added `broadcastLocal()` and `sendToUserLocal()` for local-only delivery
- Redis message handler forwards messages to local WebSocket clients

**Key Methods:**

```typescript
// Publishes to Redis (reaches all servers)
await webSocketManager.broadcast('market:xyz', message);

// Sends to local clients only (called by Redis handler)
webSocketManager.broadcastLocal('market:xyz', message);
```

### 3. Use Cases (Updated)

All use cases that broadcast WebSocket messages now use `await`:

```typescript
// Before
this.webSocketManager.broadcast(channel, message);

// After
await this.webSocketManager.broadcast(channel, message);
```

This ensures Redis publish completes before the use case returns.

## Message Flow

### Example: Trade Execution

```
1. User trades on Server 2
   └─► BuySharesUseCase.execute()
       └─► webSocketManager.broadcast('market:xyz', priceUpdate)
           └─► redisPubSub.broadcastToChannel('market:xyz', priceUpdate)
               └─► Redis PUBLISH ws:broadcast:market:xyz

2. Redis delivers to all subscribers
   ├─► Server 1 receives message
   │   └─► webSocketManager.broadcastLocal('market:xyz', priceUpdate)
   │       └─► Sends to local WebSocket clients subscribed to market:xyz
   │
   ├─► Server 2 receives message
   │   └─► webSocketManager.broadcastLocal('market:xyz', priceUpdate)
   │       └─► Sends to local WebSocket clients subscribed to market:xyz
   │
   └─► Server 3 receives message
       └─► webSocketManager.broadcastLocal('market:xyz', priceUpdate)
           └─► Sends to local WebSocket clients subscribed to market:xyz
```

## Initialization

### Startup Sequence

1. **DI Container Registration** (`src/shared/container/index.ts`):
   ```typescript
   redisPubSubService: asClass(RedisPubSubService).singleton()
   webSocketManager: asFunction(() => WebSocketManager.getInstance()).singleton()
   ```

2. **Server Startup** (`src/main.ts`):
   ```typescript
   const webSocketManager = diContainer.resolve('webSocketManager');
   const redisPubSubService = diContainer.resolve('redisPubSubService');
   await webSocketManager.initializeRedisPubSub(redisPubSubService);
   ```

3. **Redis Subscription**:
   - RedisPubSubService subscribes to `ws:broadcast:*` and `ws:user:*` patterns
   - Message handler is registered with WebSocketManager

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  const webSocketManager = diContainer.resolve('webSocketManager');
  await webSocketManager.shutdown();
  // Closes all WebSocket connections
  // Shuts down Redis pub/sub connections
});
```

## Performance Considerations

### Latency

- **Local broadcast:** < 1ms (in-memory)
- **Redis pub/sub:** 5-20ms (network + Redis)
- **Total end-to-end:** 10-50ms (acceptable for real-time updates)

### Scalability

- **Redis pub/sub throughput:** ~100K messages/second per channel
- **WebSocket connections per server:** ~10K (with proper tuning)
- **Recommended setup:** 3-5 backend instances behind load balancer

### Memory

- Each server maintains its own client connections in memory
- Redis pub/sub uses minimal memory (no message persistence)
- Monitor Redis memory: `redis-cli info memory`

## Configuration

### Environment Variables

```bash
# Redis connection (required)
REDIS_URL=redis://localhost:6379

# Server port (for multiple instances)
PORT=4000  # Server 1
PORT=4001  # Server 2
PORT=4002  # Server 3
```

### Load Balancer

Use sticky sessions or IP hash for WebSocket connections:

**Nginx Example:**
```nginx
upstream backend {
  ip_hash;  # Sticky sessions
  server localhost:4000;
  server localhost:4001;
  server localhost:4002;
}

server {
  location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## Monitoring

### Redis Pub/Sub Activity

```bash
# Monitor all WebSocket channels
redis-cli
> PSUBSCRIBE ws:*

# Check active channels
> PUBSUB CHANNELS ws:*

# Check subscribers per channel
> PUBSUB NUMSUB ws:broadcast:market:xyz
```

### Server Logs

Look for these log messages:

```
[RedisPubSub] Subscribed to WebSocket channels
[WebSocketManager] Redis pub/sub initialized
[RedisPubSub] Connections closed
```

### Metrics to Track

- WebSocket connections per server
- Redis pub/sub latency
- Message delivery success rate
- Redis memory usage

## Troubleshooting

### Issue: Messages not reaching all clients

**Symptoms:**
- Clients on Server 1 don't receive broadcasts from Server 2

**Diagnosis:**
1. Check Redis connection: `redis-cli ping`
2. Verify all servers use same `REDIS_URL`
3. Check logs for `[RedisPubSub] Subscribed to WebSocket channels`
4. Monitor Redis: `redis-cli PSUBSCRIBE ws:*`

**Solution:**
- Ensure Redis is running and accessible
- Verify network connectivity between servers and Redis
- Check firewall rules

### Issue: Duplicate messages

**Symptoms:**
- Clients receive the same message multiple times

**Diagnosis:**
1. Check if multiple `broadcast()` calls in use case
2. Verify Redis handler doesn't re-publish messages

**Solution:**
- Ensure `broadcastLocal()` is used in Redis handler (not `broadcast()`)
- Check for infinite loops in message handling

### Issue: High latency

**Symptoms:**
- Slow WebSocket message delivery (> 100ms)

**Diagnosis:**
1. Check Redis latency: `redis-cli --latency`
2. Monitor network between servers and Redis
3. Check Redis CPU usage

**Solution:**
- Use Redis on same network/datacenter as servers
- Consider Redis Cluster for higher throughput
- Optimize message payload size

## Testing

See `backend/test-redis-pubsub.md` for detailed testing instructions.

**Quick Test:**

```bash
# Terminal 1
PORT=4000 npm run dev

# Terminal 2
PORT=4001 npm run dev

# Browser Console (Tab 1)
const ws1 = new WebSocket('ws://localhost:4000/ws');
ws1.onmessage = (e) => console.log('[4000]', e.data);

# Browser Console (Tab 2)
const ws2 = new WebSocket('ws://localhost:4001/ws');
ws2.onmessage = (e) => console.log('[4001]', e.data);

# Make a trade via API on port 4000
# Both ws1 and ws2 should receive price_update
```

## Security Considerations

1. **Redis Access Control:**
   - Use Redis password: `REDIS_URL=redis://:password@localhost:6379`
   - Enable Redis ACL for production
   - Restrict Redis network access

2. **Message Validation:**
   - All messages are JSON parsed with try/catch
   - Invalid messages are logged and dropped
   - No user input directly published to Redis

3. **Channel Authorization:**
   - User channels enforce userId matching
   - Clients cannot subscribe to other users' channels
   - Channel validation before subscription

## Future Enhancements

- [ ] Redis Cluster support for higher availability
- [ ] Message persistence for offline clients
- [ ] WebSocket connection metrics dashboard
- [ ] Auto-scaling based on connection count
- [ ] Message compression for large payloads

---

**Related Documents:**
- [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) - WebSocket message format
- [EPIC_11_REAL_TIME_UPDATES__WEBSOCKET_.md](./stories/EPIC_11_REAL_TIME_UPDATES__WEBSOCKET_.md) - Feature requirements
- [test-redis-pubsub.md](../backend/test-redis-pubsub.md) - Testing guide

---

*Document Version: 1.0 | Architecture Version: 1.0*

