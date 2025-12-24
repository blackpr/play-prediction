# Testing Redis Pub/Sub for WebSocket Broadcasting

This guide explains how to test the Redis-based WebSocket broadcasting across multiple server instances.

## Prerequisites

- Redis running locally: `redis://localhost:6379`
- Backend dependencies installed: `npm install`

## Test Setup

### 1. Start Redis (if not already running)

```bash
redis-server
```

Or if using Docker:

```bash
docker run -d -p 6379:6379 redis:alpine
```

### 2. Start Multiple Backend Instances

Open **3 separate terminals** and run:

**Terminal 1 - Server Instance 1 (Port 4000):**
```bash
cd backend
PORT=4000 npm run dev
```

**Terminal 2 - Server Instance 2 (Port 4001):**
```bash
cd backend
PORT=4001 npm run dev
```

**Terminal 3 - Server Instance 3 (Port 4002):**
```bash
cd backend
PORT=4002 npm run dev
```

### 3. Connect WebSocket Clients

Open **3 browser tabs** (or use a WebSocket client like `wscat`):

**Tab 1 - Connect to Server 1:**
```javascript
// Browser Console
const ws1 = new WebSocket('ws://localhost:4000/ws');
ws1.onmessage = (e) => console.log('[Server 1]', JSON.parse(e.data));
ws1.onopen = () => {
  console.log('[Server 1] Connected');
  ws1.send(JSON.stringify({ type: 'subscribe', channel: 'market:test_123' }));
};
```

**Tab 2 - Connect to Server 2:**
```javascript
// Browser Console
const ws2 = new WebSocket('ws://localhost:4001/ws');
ws2.onmessage = (e) => console.log('[Server 2]', JSON.parse(e.data));
ws2.onopen = () => {
  console.log('[Server 2] Connected');
  ws2.send(JSON.stringify({ type: 'subscribe', channel: 'market:test_123' }));
};
```

**Tab 3 - Connect to Server 3:**
```javascript
// Browser Console
const ws3 = new WebSocket('ws://localhost:4002/ws');
ws3.onmessage = (e) => console.log('[Server 3]', JSON.parse(e.data));
ws3.onopen = () => {
  console.log('[Server 3] Connected');
  ws3.send(JSON.stringify({ type: 'subscribe', channel: 'market:test_123' }));
};
```

## Test Scenarios

### Test 1: Broadcast to Channel

Trigger a trade on any server instance (e.g., via API call to port 4000).

**Expected Result:**
- All 3 WebSocket clients should receive the `price_update` message
- Even though they're connected to different servers
- This proves Redis pub/sub is working

### Test 2: User-Specific Messages

Send a user-specific message (e.g., trade confirmation).

**Expected Result:**
- Only the user's connections receive the message
- Works across all server instances

### Test 3: Manual Redis Publish (Direct Test)

Use `redis-cli` to publish a test message:

```bash
redis-cli
> PUBLISH ws:broadcast:market:test_123 '{"channel":"market:test_123","message":{"type":"price_update","data":{"test":true}}}'
```

**Expected Result:**
- All 3 clients subscribed to `market:test_123` should receive the message
- Confirms Redis pub/sub is properly wired

## Verification Checklist

- [ ] Multiple server instances start successfully
- [ ] WebSocket connections succeed on all ports
- [ ] Clients can subscribe to channels
- [ ] Broadcast messages reach all clients across servers
- [ ] User-specific messages work across servers
- [ ] Redis pub/sub logs appear in server console
- [ ] No duplicate messages (each client receives message once)

## Monitoring Redis

Watch Redis pub/sub activity:

```bash
redis-cli
> PSUBSCRIBE ws:*
```

This will show all WebSocket-related pub/sub messages in real-time.

## Troubleshooting

### Issue: Messages not reaching all clients

**Check:**
1. All servers connected to same Redis instance (check `REDIS_URL`)
2. Redis pub/sub initialized: Look for `[RedisPubSub] Subscribed to WebSocket channels` in logs
3. No Redis connection errors in server logs

### Issue: Duplicate messages

**Check:**
1. Only one `broadcast()` call per event in use cases
2. No infinite loops (Redis message handler doesn't re-publish)

### Issue: Connection refused

**Check:**
1. Redis is running: `redis-cli ping` should return `PONG`
2. `REDIS_URL` environment variable is set correctly
3. Firewall not blocking Redis port 6379

## Performance Testing

To test under load:

```bash
# Install wscat if needed
npm install -g wscat

# Connect 100 clients to different servers
for i in {1..100}; do
  PORT=$((4000 + ($i % 3)))
  wscat -c "ws://localhost:$PORT/ws" &
done
```

Monitor Redis memory usage:
```bash
redis-cli info memory
```

## Success Criteria

✅ **Horizontal Scaling Works** when:
- Clients on Server 1 receive broadcasts from trades on Server 2
- User messages reach all user connections regardless of server
- No message loss or duplication
- Performance is acceptable (< 50ms latency for broadcasts)

## Cleanup

```bash
# Stop all backend instances (Ctrl+C in each terminal)
# Stop Redis
redis-cli shutdown
```

---

**Last Updated:** December 2025

