# API Specification

**Version:** 3.1  
**Base URL:** `https://api.play-prediction.com/v1`  
**Protocol:** HTTPS (TLS 1.3)  
**Framework:** Fastify 4.x  
**Backend:** Supabase (Auth + Database)  
**Last Updated:** December 2025

> **Architecture Note:** All API requests are handled by our Fastify server. Authentication uses Supabase Auth via `@supabase/ssr` (server-side only). The React frontend **never** directly calls Supabase - all requests go through this API.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Common Standards](#3-common-standards)
4. [Endpoints](#4-endpoints)
   - [Auth Endpoints](#41-auth-endpoints)
   - [User Endpoints](#42-user-endpoints)
   - [Market Endpoints](#43-market-endpoints)
   - [Trading Endpoints](#44-trading-endpoints)
   - [Portfolio Endpoints](#45-portfolio-endpoints)
   - [Admin Endpoints](#46-admin-endpoints)
5. [Error Handling](#5-error-handling)
6. [Rate Limiting](#6-rate-limiting)
7. [Webhooks](#7-webhooks)

---

## 1. Overview

### 1.1 API Design Principles

- **RESTful:** Resources identified by URLs, actions by HTTP methods
- **JSON:** All request/response bodies use JSON
- **Stateless:** Each request contains all necessary information
- **Versioned:** URL-based versioning (`/v1/`)
- **Idempotent:** Safe to retry failed requests with idempotency keys
- **Framework-Agnostic:** Business logic is decoupled from HTTP framework (currently Fastify)

> **See Also:** [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) for domain-driven code organization that allows swapping Fastify for any other framework.

### 1.2 Virtual Points System

> **Important:** This platform uses a **virtual points system**, not real money.
>
> - **Points** are the in-platform currency for all trading activities
> - Users receive a **welcome bonus** upon registration (default: 10 Points)
> - Points **cannot be withdrawn** or exchanged for real currency
> - Administrators can **grant additional Points** to users
> - All monetary values in the API are expressed in **MicroPoints** (1 Point = 1,000,000 MicroPoints)

### 1.3 HTTP Methods

| Method | Usage |
|--------|-------|
| `GET` | Retrieve resources (cacheable) |
| `POST` | Create resources or execute actions |
| `PUT` | Replace entire resource |
| `PATCH` | Partial resource update |
| `DELETE` | Remove resource |

---

## 2. Authentication (Supabase Auth - Server-Side Only)

> **Important:** All authentication is handled server-side using `@supabase/ssr`. We **never** use the Supabase browser client. The React frontend communicates only with our Fastify API.

### 2.1 Authentication Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Client   │     │  Fastify Server │     │    Supabase     │
│  (No Supabase)  │     │  (@supabase/ssr)│     │   Auth + DB     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  POST /auth/login     │                       │
         │  {email, password}    │                       │
         │──────────────────────>│                       │
         │                       │  signInWithPassword() │
         │                       │──────────────────────>│
         │                       │<──────────────────────│
         │                       │  Set-Cookie (session) │
         │  200 OK + Set-Cookie  │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  GET /api/markets     │                       │
         │  Cookie: sb-xxx=...   │                       │
         │──────────────────────>│                       │
         │                       │  getUser() (validates)│
         │                       │──────────────────────>│
         │                       │<──────────────────────│
         │  200 OK {markets}     │                       │
         │<──────────────────────│                       │
```

### 2.2 Session Management

- **Session Storage:** HTTP-only cookies (set by server, not accessible to JS)
- **Token Format:** Supabase JWT (managed automatically)
- **Token Refresh:** Handled by `@supabase/ssr` middleware on each request
- **Validation:** Always use `supabase.auth.getUser()` on server (validates with Supabase Auth server)

> **Security Note:** Never trust `getSession()` for authorization. Always use `getUser()` which validates the JWT with Supabase Auth server.

### 2.3 Server-Side Supabase Client Setup

```typescript
// lib/supabase/server.ts
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

export function createClient(req: FastifyRequest, reply: FastifyReply) {
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(req.headers.cookie ?? '')
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            reply.header('Set-Cookie', serializeCookieHeader(name, value, options))
          )
        },
      },
    }
  )
}
```

### 2.4 Headers

**Session cookies are sent automatically by the browser.**

**Optional for idempotent operations:**
```
Idempotency-Key: <unique-uuid>
```

### 2.5 Fastify Authentication Middleware

```typescript
// src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

declare module 'fastify' {
  interface FastifyRequest {
    supabase: ReturnType<typeof createServerClient>;
    user: { id: string; email: string; role: string } | null;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Create Supabase client with request/response cookie handling
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.cookie ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            reply.header('Set-Cookie', serializeCookieHeader(name, value, options))
          );
        },
      },
    }
  );
  
  request.supabase = supabase;
  
  // Always validate with getUser() - never trust getSession() on server
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    request.user = null;
    return; // Let route handler decide if auth is required
  }
  
  // Get user role from our users table
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  
  request.user = {
    id: user.id,
    email: user.email!,
    role: userData?.role ?? 'user',
  };
}

// Require authenticated user
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authMiddleware(request, reply);
  
  if (!request.user) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return reply;
  }
}

// Require admin role
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await requireAuth(request, reply);
  
  if (request.user && request.user.role !== 'admin') {
    reply.status(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
    return reply;
  }
}
```

---

## 3. Common Standards

### 3.1 Request Format

```json
{
  "fieldName": "value",
  "nestedObject": {
    "key": "value"
  },
  "arrayField": ["item1", "item2"]
}
```

### 3.2 Response Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-12-09T10:30:00Z"
  }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Your balance is insufficient for this trade",
    "details": {
      "required": 1000000,
      "available": 500000
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-12-09T10:30:00Z"
  }
}
```

### 3.3 Monetary Values

All monetary values are expressed in **MicroPoints** (integers):

| Display | MicroPoints | JSON |
|---------|-------------|------|
| $1.00 | 1,000,000 | `1000000` |
| $0.50 | 500,000 | `500000` |
| $0.01 | 10,000 | `10000` |

**Note:** Values are returned as strings in JSON to preserve precision:
```json
{
  "balance": "1000000",
  "yesQty": "500000"
}
```

### 3.4 Timestamps

All timestamps use ISO 8601 format with timezone:
```
2024-12-09T10:30:00.000Z
```

---

## 4. Endpoints

### 4.1 Auth Endpoints

#### `POST /auth/register`

Create a new user account via Supabase Auth.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Server Implementation (Drizzle Transaction):**
```typescript
// src/routes/auth/register.ts
import { db } from '../../db';
import { users, pointGrants } from '../../db/schema';

const WELCOME_BONUS = 10_000_000n; // 10 Points

// 1. Create Supabase Auth user
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { role: 'user' }
  }
});

if (authError || !authData.user) {
  throw new Error('SIGNUP_FAILED');
}

// 2. Create user profile with welcome bonus in Drizzle transaction
const newUser = await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(users)
    .values({
      id: authData.user.id,
      email,
      balance: WELCOME_BONUS,
      role: 'user',
    })
    .returning();

  // Log the welcome bonus grant
  await tx.insert(pointGrants).values({
    userId: authData.user.id,
    amount: WELCOME_BONUS,
    balanceBefore: 0n,
    balanceAfter: WELCOME_BONUS,
    grantType: 'REGISTRATION_BONUS',
    reason: 'Welcome bonus',
  });

  return user;
});
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "user",
      "balance": "10000000",
      "createdAt": "2024-12-09T10:30:00Z"
    },
    "message": "Please check your email to confirm your account"
  }
}
```

> **Note:** New users automatically receive a welcome bonus of Points (default: 10,000,000 MicroPoints = 10 Points). Session cookie is set automatically by Supabase after email confirmation.

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `INVALID_EMAIL` | 400 | Email format is invalid |
| `WEAK_PASSWORD` | 400 | Password doesn't meet requirements |

---

#### `POST /auth/login`

Authenticate user via Supabase Auth. Session cookie set automatically.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Server Implementation:**
```typescript
// Uses Supabase Auth signInWithPassword
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})
// Cookie is set automatically via @supabase/ssr
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "user",
      "balance": "5000000"
    }
  }
}
```

> **Note:** Session is stored in HTTP-only cookies. No tokens are returned to the client. Subsequent requests automatically include the session cookie.

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `INVALID_CREDENTIALS` | 401 | Email or password incorrect |
| `EMAIL_NOT_CONFIRMED` | 401 | Email not yet confirmed |
| `ACCOUNT_DISABLED` | 403 | Account has been deactivated |

---

#### `POST /auth/logout`

Sign out and clear session cookies.

**Auth:** Required (session cookie)

**Server Implementation:**
```typescript
await supabase.auth.signOut()
// Cookies cleared automatically
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

---

#### `GET /auth/callback`

OAuth callback endpoint for email confirmation and OAuth flows.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `token_hash` | string | Token hash from email link |
| `type` | string | `email` or `signup` |

**Server Implementation:**
```typescript
const { token_hash, type } = req.query
await supabase.auth.verifyOtp({ type, token_hash })
// Redirect to app on success
```

---

### 4.2 User Endpoints

#### `GET /users/me`

Get current user profile.

**Auth:** Required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "user",
    "balance": "5000000",
    "isActive": true,
    "createdAt": "2024-12-09T10:30:00Z"
  }
}
```

---

#### `GET /users/me/points-history`

Get history of point grants and adjustments.

**Auth:** Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `pageSize` | int | 20 | Items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "grant_abc123",
        "type": "REGISTRATION_BONUS",
        "amount": "10000000",
        "balanceAfter": "10000000",
        "grantedBy": null,
        "reason": "Welcome bonus",
        "createdAt": "2024-12-09T10:30:00Z"
      },
      {
        "id": "grant_def456",
        "type": "ADMIN_GRANT",
        "amount": "5000000",
        "balanceAfter": "15000000",
        "grantedBy": "admin@example.com",
        "reason": "Contest winner reward",
        "createdAt": "2024-12-10T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 2
    }
  }
}
```

> **Note:** This is a virtual points system. Points have no cash value and cannot be withdrawn or exchanged for real currency. Users receive an initial balance upon registration, and administrators can grant additional points.

---

### 4.3 Market Endpoints

#### `GET /markets`

List all markets with optional filters.

**Auth:** Optional (public endpoint)

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `ACTIVE` | Filter by status |
| `category` | string | - | Filter by category |
| `page` | int | 1 | Page number |
| `pageSize` | int | 20 | Items per page (max 100) |
| `sort` | string | `createdAt` | Sort field |
| `order` | string | `desc` | Sort order (asc/desc) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mkt_abc123",
        "title": "Will BTC exceed $100k by Dec 31?",
        "description": "Bitcoin price milestone prediction",
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
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 45,
      "totalPages": 3
    }
  }
}
```

---

#### `GET /markets/:id`

Get single market details.

**Auth:** Optional

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "mkt_abc123",
    "title": "Will BTC exceed $100k by Dec 31?",
    "description": "Bitcoin price milestone prediction. Resolves YES if...",
    "status": "ACTIVE",
    "resolution": null,
    "category": "Crypto",
    "imageUrl": "https://...",
    "closesAt": "2024-12-31T23:59:59Z",
    "resolvedAt": null,
    "createdAt": "2024-12-01T00:00:00Z",
    "pool": {
      "yesQty": "5000000",
      "noQty": "5000000",
      "yesPrice": "0.50",
      "noPrice": "0.50",
      "k": "25000000000000"
    },
    "stats": {
      "totalVolume": "15000000",
      "volume24h": "1500000",
      "tradeCount": 234,
      "uniqueTraders": 89
    }
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `MARKET_NOT_FOUND` | 404 | Market doesn't exist |

---

#### `GET /markets/:id/price-history`

Get historical price data for charts.

**Auth:** Optional

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `interval` | string | `1h` | Time interval (1m, 5m, 1h, 1d) |
| `from` | timestamp | 24h ago | Start time |
| `to` | timestamp | now | End time |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "marketId": "mkt_abc123",
    "interval": "1h",
    "candles": [
      {
        "timestamp": "2024-12-09T10:00:00Z",
        "yesOpen": "0.48",
        "yesHigh": "0.52",
        "yesLow": "0.47",
        "yesClose": "0.50",
        "volume": "150000"
      }
    ]
  }
}
```

---

### 4.4 Trading Endpoints

#### `POST /markets/:id/buy`

Buy shares of YES or NO.

**Auth:** Required

**Request:**
```json
{
  "side": "YES",
  "amount": "100000",
  "minSharesOut": "95000",
  "idempotencyKey": "buy_abc123_1702123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `side` | string | Yes | `YES` or `NO` |
| `amount` | string | Yes | MicroPoints to spend |
| `minSharesOut` | string | Yes | Slippage protection (minimum shares) |
| `idempotencyKey` | string | No | Unique key for safe retries |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_xyz789",
    "action": "BUY",
    "side": "YES",
    "amountIn": "100000",
    "sharesOut": "98500",
    "feePaid": "2000",
    "feeBreakdown": {
      "vault": "1000",
      "liquidity": "1000"
    },
    "pricePerShare": "0.9898",
    "avgExecutionPrice": "0.5076",
    "newPosition": {
      "yesQty": "98500",
      "noQty": "0",
      "yesCostBasis": "98000",
      "noCostBasis": "0"
    },
    "newBalance": "4900000",
    "pool": {
      "yesQty": "4901500",
      "noQty": "5099000",
      "yesPrice": "0.5099",
      "noPrice": "0.4901"
    }
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `INSUFFICIENT_BALANCE` | 400 | Not enough points |
| `SLIPPAGE_EXCEEDED` | 400 | Price moved too much |
| `MARKET_NOT_ACTIVE` | 400 | Market is paused/resolved |
| `MINIMUM_TRADE_SIZE` | 400 | Amount below 1000 MicroPoints |
| `IDEMPOTENCY_CONFLICT` | 409 | Duplicate idempotency key |

---

#### `POST /markets/:id/sell`

Sell shares back to the pool.

**Auth:** Required

**Request:**
```json
{
  "side": "YES",
  "shares": "50000",
  "minAmountOut": "48000",
  "idempotencyKey": "sell_abc123_1702123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_def456",
    "action": "SELL",
    "side": "YES",
    "sharesIn": "50000",
    "amountOut": "49000",
    "feePaid": "1000",
    "avgExecutionPrice": "0.50",
    "newPosition": {
      "yesQty": "48500",
      "noQty": "0",
      "yesCostBasis": "49000",
      "noCostBasis": "0"
    },
    "newBalance": "4949000"
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `INSUFFICIENT_SHARES` | 400 | Don't own enough shares |
| `SLIPPAGE_EXCEEDED` | 400 | Output below minimum |
| `MARKET_NOT_ACTIVE` | 400 | Market is paused/resolved |

---

#### `POST /markets/:id/mint`

Create YES + NO shares by depositing points.

**Auth:** Required

**Request:**
```json
{
  "amount": "100000"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_ghi789",
    "action": "MINT",
    "amountIn": "100000",
    "yesOut": "100000",
    "noOut": "100000",
    "feePaid": "0",
    "newPosition": {
      "yesQty": "100000",
      "noQty": "100000"
    },
    "newBalance": "4900000"
  }
}
```

---

#### `POST /markets/:id/merge`

Destroy equal YES + NO shares to withdraw points.

**Auth:** Required

**Request:**
```json
{
  "amount": "50000"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_jkl012",
    "action": "MERGE",
    "yesIn": "50000",
    "noIn": "50000",
    "amountOut": "50000",
    "feePaid": "0",
    "newPosition": {
      "yesQty": "50000",
      "noQty": "50000"
    },
    "newBalance": "4950000"
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `INSUFFICIENT_SHARES` | 400 | Need equal YES and NO |

---

#### `GET /markets/:id/quote`

Get a price quote without executing.

**Auth:** Optional

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `side` | string | `YES` or `NO` |
| `action` | string | `BUY` or `SELL` |
| `amount` | string | Amount in MicroPoints (buy) or shares (sell) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "side": "YES",
    "action": "BUY",
    "amountIn": "100000",
    "estimatedSharesOut": "98500",
    "estimatedFee": "2000",
    "priceImpact": "0.0099",
    "spotPrice": "0.50",
    "avgExecutionPrice": "0.5076",
    "minimumRecommended": "93575",
    "expiresAt": "2024-12-09T10:30:30Z"
  }
}
```

---

### 4.5 Portfolio Endpoints

#### `GET /portfolio`

Get all user positions across markets.

**Auth:** Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `all` | Filter by market status |
| `hasPosition` | bool | `true` | Only markets with holdings |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalValue": "5250000",
    "totalCostBasis": "5000000",
    "unrealizedPnL": "250000",
    "positions": [
      {
        "market": {
          "id": "mkt_abc123",
          "title": "Will BTC exceed $100k?",
          "status": "ACTIVE",
          "yesPrice": "0.55"
        },
        "yesQty": "100000",
        "noQty": "0",
        "yesCostBasis": "50000",
        "noCostBasis": "0",
        "currentValue": "55000",
        "unrealizedPnL": "5000"
      }
    ]
  }
}
```

---

#### `GET /portfolio/:marketId`

Get position in a specific market.

**Auth:** Required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "marketId": "mkt_abc123",
    "yesQty": "100000",
    "noQty": "0",
    "yesCostBasis": "50000",
    "noCostBasis": "0",
    "avgYesBuyPrice": "0.50",
    "currentYesPrice": "0.55",
    "unrealizedPnL": "5000"
  }
}
```

---

#### `GET /portfolio/history`

Get transaction history.

**Auth:** Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `marketId` | uuid | - | Filter by market |
| `action` | string | - | Filter by action type |
| `page` | int | 1 | Page number |
| `pageSize` | int | 50 | Items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "txn_xyz789",
        "marketId": "mkt_abc123",
        "marketTitle": "Will BTC exceed $100k?",
        "action": "BUY",
        "side": "YES",
        "amountIn": "100000",
        "amountOut": "98500",
        "feePaid": "2000",
        "priceAtExecution": "0.5076",
        "createdAt": "2024-12-09T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "totalItems": 125
    }
  }
}
```

---

### 4.6 Admin Endpoints

All admin endpoints require `role: admin`.

#### `POST /admin/markets`

Create a new market.

**Auth:** Required (Admin)

**Request:**
```json
{
  "title": "Will it rain tomorrow in NYC?",
  "description": "Resolves YES if any measurable precipitation...",
  "category": "Weather",
  "imageUrl": "https://...",
  "closesAt": "2024-12-10T23:59:59Z",
  "seedLiquidity": "10000000"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "mkt_new123",
    "title": "Will it rain tomorrow in NYC?",
    "status": "DRAFT",
    "pool": {
      "yesQty": "10000000",
      "noQty": "10000000",
      "k": "100000000000000"
    }
  }
}
```

---

#### `POST /admin/markets/:id/activate`

Activate a draft market for trading.

**Auth:** Required (Admin)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "mkt_new123",
    "status": "ACTIVE",
    "activatedAt": "2024-12-09T11:00:00Z"
  }
}
```

---

#### `POST /admin/markets/:id/pause`

Pause trading on a market.

**Auth:** Required (Admin)

**Request:**
```json
{
  "reason": "Investigating potential manipulation"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "mkt_abc123",
    "status": "PAUSED",
    "pausedAt": "2024-12-09T11:00:00Z",
    "reason": "Investigating potential manipulation"
  }
}
```

---

#### `POST /admin/markets/:id/resume`

Resume trading on a paused market.

**Auth:** Required (Admin)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "mkt_abc123",
    "status": "ACTIVE",
    "resumedAt": "2024-12-09T12:00:00Z"
  }
}
```

---

#### `POST /admin/markets/:id/resolve`

Resolve a market with a final outcome.

**Auth:** Required (Admin)

**Request:**
```json
{
  "resolution": "YES",
  "evidence": "BTC reached $102,450 at 14:32 UTC on Dec 15"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "mkt_abc123",
    "status": "RESOLVED",
    "resolution": "YES",
    "resolvedAt": "2024-12-15T15:00:00Z",
    "payouts": {
      "totalWinners": 89,
      "totalPayout": "4500000",
      "processedAt": "2024-12-15T15:00:05Z"
    }
  }
}
```

---

#### `POST /admin/markets/:id/cancel`

Cancel a market and initiate refunds.

**Auth:** Required (Admin)

**Request:**
```json
{
  "reason": "Event was cancelled"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "mkt_abc123",
    "status": "CANCELLED",
    "resolution": "CANCELLED",
    "cancelledAt": "2024-12-09T11:00:00Z",
    "refunds": {
      "totalHolders": 156,
      "totalRefunded": "7800000",
      "processedAt": "2024-12-09T11:00:10Z"
    }
  }
}
```

---

#### `POST /admin/users/:id/grant-points`

Grant additional points to a user.

**Auth:** Required (Admin)

**Request:**
```json
{
  "amount": "5000000",
  "reason": "Contest winner reward"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | Yes | MicroPoints to grant (must be positive) |
| `reason` | string | Yes | Audit reason for the grant |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "grantId": "grant_xyz789",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": "5000000",
    "previousBalance": "10000000",
    "newBalance": "15000000",
    "reason": "Contest winner reward",
    "grantedBy": "admin@example.com",
    "createdAt": "2024-12-09T11:00:00Z"
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `USER_NOT_FOUND` | 404 | User doesn't exist |
| `INVALID_AMOUNT` | 400 | Amount must be positive |

---

#### `GET /admin/users`

List all users with optional filters.

**Auth:** Required (Admin)

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | - | Search by email |
| `role` | string | - | Filter by role |
| `page` | int | 1 | Page number |
| `pageSize` | int | 20 | Items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "role": "user",
        "balance": "15000000",
        "isActive": true,
        "createdAt": "2024-12-09T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 156
    }
  }
}
```

---

#### `GET /admin/users/:id`

Get detailed user information.

**Auth:** Required (Admin)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "user",
    "balance": "15000000",
    "isActive": true,
    "createdAt": "2024-12-09T10:30:00Z",
    "stats": {
      "totalTrades": 45,
      "totalVolume": "125000000",
      "activePositions": 3,
      "pointsGranted": "15000000"
    }
  }
}
```

---

## 5. Error Handling

### 5.1 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {
      "field": "Additional context"
    }
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### 5.2 Error Codes

#### Authentication Errors (401)

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | No valid token provided |
| `TOKEN_EXPIRED` | Access token has expired |
| `INVALID_TOKEN` | Token is malformed |
| `TOKEN_REVOKED` | Token has been revoked |

#### Authorization Errors (403)

| Code | Description |
|------|-------------|
| `FORBIDDEN` | Action not permitted |
| `ADMIN_REQUIRED` | Admin role required |
| `ACCOUNT_DISABLED` | Account is deactivated |

#### Validation Errors (400)

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `INVALID_SIDE` | Side must be YES or NO |
| `INVALID_AMOUNT` | Amount must be positive integer |
| `MINIMUM_TRADE_SIZE` | Below 1000 MicroPoints minimum |

#### Business Logic Errors (400)

| Code | Description |
|------|-------------|
| `INSUFFICIENT_BALANCE` | Not enough points |
| `INSUFFICIENT_SHARES` | Not enough shares to sell |
| `SLIPPAGE_EXCEEDED` | Price moved beyond tolerance |
| `MARKET_NOT_ACTIVE` | Market not accepting trades |
| `MARKET_CLOSED` | Past closing time |

#### Conflict Errors (409)

| Code | Description |
|------|-------------|
| `IDEMPOTENCY_CONFLICT` | Duplicate idempotency key |
| `OPTIMISTIC_LOCK_FAIL` | Concurrent modification |
| `EMAIL_ALREADY_EXISTS` | Email taken |

#### Not Found Errors (404)

| Code | Description |
|------|-------------|
| `MARKET_NOT_FOUND` | Market doesn't exist |
| `USER_NOT_FOUND` | User doesn't exist |

#### Server Errors (500)

| Code | Description |
|------|-------------|
| `INTERNAL_ERROR` | Unexpected server error |
| `DATABASE_ERROR` | Database operation failed |

---

## 6. Rate Limiting

### 6.1 Rate Limits

| Endpoint Type | Limit | Window | Key |
|---------------|-------|--------|-----|
| Public | 100 requests | 1 minute | IP address |
| Authenticated | 60 requests | 1 minute | User ID |
| Trading | 30 requests | 1 minute | User ID |
| Admin | 120 requests | 1 minute | User ID |

### 6.2 Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1702123500
```

### 6.3 Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "retryAfter": 45
    }
  }
}
```

**HTTP Status:** 429 Too Many Requests

**Headers:**
```
Retry-After: 45
```

---

## 7. Webhooks

### 7.1 Webhook Events

| Event | Trigger |
|-------|---------|
| `market.activated` | Market goes live |
| `market.resolved` | Market outcome decided |
| `market.cancelled` | Market cancelled |
| `trade.executed` | Trade completed |
| `payout.completed` | Resolution payout done |

### 7.2 Webhook Payload

```json
{
  "id": "evt_abc123",
  "type": "market.resolved",
  "createdAt": "2024-12-15T15:00:00Z",
  "data": {
    "marketId": "mkt_abc123",
    "resolution": "YES",
    "resolvedAt": "2024-12-15T15:00:00Z"
  }
}
```

### 7.3 Webhook Security

- Signature header: `X-Signature-256`
- Algorithm: HMAC-SHA256
- Verify: `HMAC(payload, webhook_secret) == signature`

---

## Related Documents

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — System architecture overview
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — Database schema
- [ENGINE_LOGIC.md](./ENGINE_LOGIC.md) — Trading engine implementation
- [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) — Real-time updates

---

*Document Version: 3.1 | API Version: v1*

