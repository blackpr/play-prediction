# Logging Guide

## Overview

The backend uses **Pino** for high-performance, structured logging with pretty formatting in development mode.

## Features

### 🎨 Pretty Printing (Development Mode)

In development, logs are automatically formatted with:
- **Colorized output** - Different colors for different log levels
- **Human-readable timestamps** - `HH:MM:ss Z` format
- **Clean output** - Hides unnecessary fields like `pid` and `hostname`
- **Single-line or multi-line** - Configurable based on content

### 📊 Structured Logging

All logs include structured data for easy filtering and analysis:
- Request ID (automatically added by Fastify)
- User ID (for authenticated requests)
- Category tags (trade, admin, auth, etc.)
- Performance metrics
- Error details with stack traces

## Log Levels

| Level | When to Use |
|-------|-------------|
| `debug` | Detailed debugging information (default in dev) |
| `info` | Normal operations, successful actions |
| `warn` | Warning conditions, 4xx errors, slow requests |
| `error` | Error conditions, 5xx errors, exceptions |

## Automatic Logging

### 1. Request/Response Logging

All HTTP requests are automatically logged with:
- Method, URL, query params
- User agent and IP address
- Response status code
- Duration (warns if > 1s)

```typescript
// Automatically logged for all routes
INFO: Incoming request { method: 'POST', url: '/api/v1/markets/123/buy', userId: 'abc...' }
INFO: Request completed { statusCode: 200, duration: '45ms' }
```

### 2. Error Logging

All errors are automatically logged with context:
- Domain errors (business logic)
- Validation errors
- Rate limit errors
- Unexpected errors

```typescript
WARN: Domain Error (4xx) { code: 'INSUFFICIENT_BALANCE', requestId: '...' }
ERROR: Unexpected Error { err: {...}, requestId: '...' }
```

### 3. User Context

For authenticated requests, the user ID is automatically added to all logs:

```typescript
// User ID automatically included in all logs for the request
INFO: { userId: 'abc-123', ... }
```

## Business Logic Logging

Use the `BusinessLogger` utility for structured logging of business operations:

```typescript
import { BusinessLogger } from '@/shared/logger';

// Log a trade
BusinessLogger.logTrade(request.log, {
  userId: user.id,
  marketId: market.id,
  action: 'BUY',
  side: 'YES',
  amount: '1000000',
  sharesOut: '950',
  feePaid: '50000',
  executionPrice: '0.52',
  duration: 45,
});

// Log an admin action
BusinessLogger.logAdminAction(request.log, {
  adminId: admin.id,
  adminEmail: admin.email,
  action: 'MARKET_RESOLVED',
  entityType: 'MARKET',
  entityId: market.id,
  details: { resolution: 'YES', totalPayout: '10000000' },
});

// Log authentication events
BusinessLogger.logAuthEvent(request.log, {
  userId: user.id,
  email: user.email,
  action: 'LOGIN',
  success: true,
});

// Log performance metrics
BusinessLogger.logPerformance(request.log, 'calculatePayout', duration, {
  marketId: market.id,
  winnerCount: 42,
});

// Log WebSocket events
BusinessLogger.logWebSocket(request.log, 'connected', {
  userId: user.id,
  sessionId: 'xyz-789',
});

// Log circuit breaker events
BusinessLogger.logCircuitBreaker(request.log, 'open', 'redis', 'Too many errors');
```

## Manual Logging

For custom logging in routes or use cases:

```typescript
// Info level (successful operations)
request.log.info({ 
  category: 'custom',
  marketId: '123',
  action: 'price_updated' 
}, 'Market price updated');

// Warn level (concerning but not critical)
request.log.warn({ 
  category: 'performance',
  duration: '2500ms',
  operation: 'slow_query' 
}, 'Query took longer than expected');

// Error level (failures)
request.log.error({ 
  err: error,
  userId: user.id,
  marketId: market.id 
}, 'Failed to execute trade');

// Debug level (detailed info)
request.log.debug({ 
  poolState: { yesQty, noQty },
  calculatedPrice: price 
}, 'CPMM calculation completed');
```

## Log Categories

Use these category tags for consistent filtering:

| Category | Use Case |
|----------|----------|
| `request` | HTTP requests |
| `response` | HTTP responses |
| `trade` | Trading operations (buy, sell, mint, merge) |
| `admin` | Admin actions |
| `auth` | Authentication events |
| `market` | Market lifecycle events |
| `performance` | Performance metrics |
| `circuit_breaker` | Circuit breaker state changes |
| `websocket` | WebSocket connections/messages |

## Production vs Development

### Development
- Pretty formatted output
- Log level: `debug` (shows everything)
- All timestamps in local time
- Colorized by level

### Production
- JSON structured output (for log aggregators)
- Log level: `info` (only important events)
- All timestamps in ISO 8601 UTC
- No colors

## Sensitive Data

The logger automatically **redacts** sensitive fields:
- `authorization` headers
- `cookie` headers
- Any field named `password`, `token`, `secret`, `key`
- Email addresses (configurable)

```typescript
// This will be logged as [Redacted]
request.log.info({ 
  user: { 
    email: 'user@example.com',  // [Redacted]
    password: 'secret123'        // [Redacted]
  } 
});
```

## Best Practices

1. **Always include context** - Add relevant IDs, actions, and data
2. **Use appropriate levels** - Don't log everything as `error`
3. **Use structured data** - Pass objects, not just strings
4. **Include timing for important operations** - Help identify bottlenecks
5. **Don't log sensitive data** - Use the redaction feature
6. **Use BusinessLogger for domain events** - Consistent format across the app
7. **Include user context when available** - Already automatic for authenticated requests

## Examples

### Logging a Successful Trade

```typescript
const startTime = Date.now();
const result = await buySharesUseCase.execute(params);
const duration = Date.now() - startTime;

BusinessLogger.logTrade(request.log, {
  userId: user.id,
  marketId: params.marketId,
  action: 'BUY',
  side: params.side,
  amount: params.amount.toString(),
  sharesOut: result.sharesOut.toString(),
  feePaid: result.feePaid.toString(),
  executionPrice: result.avgExecutionPrice,
  duration,
});
```

### Logging a Market Resolution

```typescript
BusinessLogger.logMarketEvent(request.log, {
  marketId: market.id,
  action: 'RESOLVED',
  resolution: 'YES',
  totalPayout: totalPayout.toString(),
  affectedUsers: winners.length,
});
```

### Logging a Slow Operation

```typescript
const startTime = Date.now();
const users = await repository.findAll();
const duration = Date.now() - startTime;

if (duration > 1000) {
  BusinessLogger.logPerformance(request.log, 'findAllUsers', duration, {
    count: users.length,
  });
}
```

## Viewing Logs

### Development
```bash
npm run dev
# Logs will appear in terminal with pretty formatting
```

### Production
```bash
npm start
# Logs are in JSON format, pipe to log aggregator
npm start | jq  # Pretty print JSON logs
```

## Configuration

Logger config is in `src/shared/logger/index.ts`:

```typescript
export const loggerConfig = {
  level: getEnv('LOG_LEVEL', isProduction ? 'info' : 'debug'),
  transport: !isProduction ? { target: 'pino-pretty', options: {...} } : undefined,
  // ... more config
};
```

To change log level:
```bash
LOG_LEVEL=warn npm run dev
```

---

*Last Updated: December 2025*

