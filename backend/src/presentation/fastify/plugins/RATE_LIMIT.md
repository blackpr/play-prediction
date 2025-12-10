# Rate Limiting

This document describes the rate limiting implementation in the Play Prediction API.

## Overview

Rate limiting protects the API from abuse by restricting the number of requests a client can make within a time window. The implementation uses `@fastify/rate-limit` v10.3.0 with **Redis as the backing store** for distributed rate limiting.

## Production-Ready: Redis Backend

**⚠️ CRITICAL:** This implementation uses Redis as the backing store, making it **production-ready for distributed systems**.

- **With Redis**: Rate limits are shared across all server instances (horizontal scaling ready)
- **Without Redis**: Falls back to in-memory storage (NOT production-ready, development only)

### Environment Configuration

```bash
# Required for production
REDIS_URL=redis://localhost:6379

# Optional Redis password
REDIS_URL=redis://:password@localhost:6379

# Cloud Redis (e.g., AWS ElastiCache, Redis Cloud)
REDIS_URL=redis://username:password@redis.example.com:6379
```

## Configuration

### Rate Limit Types

Four different rate limit configurations are available based on endpoint type:

| Type | Limit | Time Window | Key |
|------|-------|-------------|-----|
| **Public** | 100 requests | 1 minute | IP address |
| **Authenticated** | 60 requests | 1 minute | User ID |
| **Trading** | 30 requests | 1 minute | User ID |
| **Admin** | 120 requests | 1 minute | User ID |

### Key Generation Strategy

- **Authenticated users**: Rate limits are keyed by user ID from the authentication middleware
- **Unauthenticated requests**: Rate limits are keyed by IP address
- This ensures users can't bypass limits by switching IPs after authentication

## Usage

### Basic Usage

Apply rate limiting to a route using the `withRateLimit` helper:

```typescript
import { withRateLimit, RateLimitType } from './presentation/fastify/plugins/rate-limit';

// Public endpoint - 100 req/min per IP
fastify.get(
  '/api/markets',
  withRateLimit(RateLimitType.PUBLIC),
  async (request, reply) => {
    return { markets: [] };
  }
);

// Trading endpoint - 30 req/min per user
fastify.post(
  '/api/trades/buy',
  withRateLimit(RateLimitType.TRADING),
  async (request, reply) => {
    return { tradeId: '123' };
  }
);
```

### Custom Rate Limits

For endpoints requiring custom limits:

```typescript
fastify.get(
  '/api/special',
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  },
  async (request, reply) => {
    return { data: 'custom rate limit' };
  }
);
```

## Response Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1702123500
```

- `X-RateLimit-Limit`: Maximum requests allowed in the time window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

## Error Response

When rate limit is exceeded, the API returns HTTP 429 with:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "retryAfter": 45
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-12-09T10:30:00Z"
  }
}
```

**Headers:**
```
Retry-After: 45
```

The `retryAfter` value indicates seconds until the rate limit resets.

## Implementation Details

### Redis Backend

The implementation uses Redis for distributed rate limiting with optimized settings:

```typescript
{
  connectTimeout: 1000,        // Fast connection timeout
  maxRetriesPerRequest: 3,     // Limit retries
  lazyConnect: true,           // Connect on first use
  enableOfflineQueue: false,   // Don't queue when offline
  retryStrategy: exponential   // Exponential backoff
}
```

**Graceful Degradation:**
- If Redis is unavailable at startup, the plugin logs a warning but continues
- `skipOnError: true` ensures requests aren't blocked if Redis fails during operation
- The system falls back to in-memory storage (with warning logs)

### Plugin Registration

The rate limiting plugin is registered globally in `main.ts`:

```typescript
import { registerRateLimit } from './presentation/fastify/plugins/rate-limit';

server.register(registerRateLimit);
```

**Startup Behavior:**
- With `REDIS_URL`: `✓ Rate limiting using Redis backend (production-ready)`
- Without `REDIS_URL`: `⚠️ Rate limiting using in-memory storage (NOT PRODUCTION READY)`

### Redis Key Structure

Keys in Redis follow this pattern:
```
rate-limit:{type}:user:{userId}  # For authenticated requests (e.g. rate-limit:trading:user:123)
rate-limit:{type}:{ipAddress}    # For public requests (e.g. rate-limit:public:127.0.0.1)
```

### Error Handling

Rate limit errors are handled by the global error handler in `error-handler.ts`, which:
- Returns the proper error format matching the API specification
- Includes the `Retry-After` header
- Logs rate limit violations at warning level (not error level)

### Testing

Comprehensive tests are available in `test/rate-limit.test.ts` covering:
- Successful requests within limits
- Header presence and values
- Rate limit enforcement
- Different limits for different endpoint types
- Proper error response format

Run tests:
```bash
npm test test/rate-limit.test.ts
```

## Best Practices

1. **Choose the right type**: Use the most restrictive limit that makes sense for your endpoint
2. **Trading endpoints**: Always use `RateLimitType.TRADING` for buy/sell operations
3. **Admin endpoints**: Use `RateLimitType.ADMIN` for administrative operations
4. **Public endpoints**: Use `RateLimitType.PUBLIC` for unauthenticated endpoints
5. **Monitor**: Watch for legitimate users hitting limits (may indicate need for adjustment)

## Monitoring

Rate limit violations are logged as warnings:

```json
{
  "level": "warn",
  "requestId": "req_abc123",
  "userId": "user_xyz",
  "msg": "Rate Limit Exceeded"
}
```

Track these logs to identify:
- Potential abuse patterns
- Endpoints that may need limit adjustment
- Users who frequently hit limits

## Production Readiness

**Status:** ✅ Production ready with Redis configured

### Deployment Checklist

- [x] Redis backend configured
- [x] Connection timeouts optimized for rate limiting
- [x] Graceful degradation on Redis failure
- [x] Proper error logging
- [x] Redis connection cleanup on shutdown
- [ ] Monitor Redis connection health
- [ ] Set up Redis replication for high availability
- [ ] Configure Redis persistence (RDB/AOF)

### Scaling Considerations

**Horizontal Scaling:**
- ✅ Multiple API instances share rate limit state via Redis
- ✅ No coordination needed between instances
- ✅ Rate limits are accurate across the cluster

**Redis Sizing:**
- Memory: ~1KB per unique key (user/IP)
- Keys expire automatically after time window
- Example: 10K active users = ~10MB Redis memory

### Monitoring

Track these metrics:
- Redis connection status
- Rate limit hit rate (% of requests rate limited)
- Redis latency (should be <5ms)
- Redis memory usage

## Future Enhancements

Potential improvements:
- ~~Redis-backed rate limiting for distributed deployments~~ ✅ DONE
- Per-user custom rate limits (premium users)
- Dynamic rate limit adjustment based on system load
- Rate limit exemptions for specific API keys
- Detailed rate limit metrics and dashboards

## References

- [@fastify/rate-limit documentation](https://github.com/fastify/fastify-rate-limit)
- [API_SPECIFICATION.md](../../../docs/API_SPECIFICATION.md) - Section 6: Rate Limiting
- [SYSTEM_DESIGN.md](../../../docs/SYSTEM_DESIGN.md) - Rate limiting architecture
