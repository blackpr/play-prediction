# System Design Document v3.1: The Play-Prediction Engine

**Scope:** End-to-End Architecture for CPMM Binary Markets  
**Stack:** Node.js / TypeScript / PostgreSQL / Drizzle ORM  
**Version:** 3.1 (Production Ready)  
**Last Updated:** December 2025

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Economic Model](#3-economic-model)
4. [Market Lifecycle](#4-market-lifecycle)
5. [System Components](#5-system-components)
6. [Security Model](#6-security-model)
7. [Performance Considerations](#7-performance-considerations)
8. [Monitoring & Observability](#8-monitoring--observability)
9. [Glossary](#9-glossary)

---

## 1. Executive Summary

The Play-Prediction Engine is an Automated Market Maker (AMM) for binary prediction markets. Users can buy and sell shares representing "YES" or "NO" outcomes on real-world events. The system uses a Constant Product Market Maker (CPMM) algorithm to provide continuous liquidity and automatic price discovery.

### 1.1 Core Value Proposition

- **Always-On Liquidity:** Users can trade at any time without waiting for counterparties
- **Transparent Pricing:** Prices are determined algorithmically based on supply and demand
- **Provable Solvency:** Mathematical guarantees ensure the system can always pay out winners
- **Fair Resolution:** Multiple resolution paths including standard payout and principal protection

### 1.2 Virtual Points System

**Important:** This platform operates on a **virtual points system**, not real money.

- **Points** are the in-platform currency used for all trading
- Users receive a **predefined balance** of Points upon registration (configurable, e.g., 10,000 Points)
- Points have **no cash value** and cannot be withdrawn or exchanged for real currency
- Administrators can **grant additional Points** to users for promotions, rewards, or corrections
- This design simplifies regulatory compliance and focuses on the prediction mechanics

### 1.3 The 3 Immutable Rules

These rules are the foundation of system integrity and must never be violated:

| Rule | Name | Description |
|------|------|-------------|
| **Rule 1** | Conservation of Mass | New shares are only created by minting a full set (1 YES + 1 NO) for 1 Point. No shares can be created from nothing. |
| **Rule 2** | Exclusivity | A user cannot hold conflicting positions simultaneously. The system forces a "Netting" event before any trade that would create a conflict. |
| **Rule 3** | The Floor Rule | All rounding operations must favor the House/Pool. User payouts round DOWN (floor). Fee calculations round UP (ceiling). |

### 1.4 The Golden Equation

At all times, the following must hold true:

```
P_YES + P_NO = 1.0
```

Where:
- `P_YES = NO_qty / (YES_qty + NO_qty)` — Price of YES shares
- `P_NO = YES_qty / (YES_qty + NO_qty)` — Price of NO shares

This ensures that buying a complete set (1 YES + 1 NO) always costs exactly 1 Point, maintaining system solvency.

---

## 2. Architecture Overview

> **See Also:** [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) for detailed code organization and framework-agnostic design patterns.

### 2.1 Design Principles

- **Domain-Driven Design:** Business logic organized by domain (trading, markets, portfolio)
- **Hexagonal Architecture:** Core logic is framework-agnostic (can swap Fastify for Express/Hono)
- **Clean Layer Separation:** Domain → Application → Infrastructure → Presentation
- **Dependency Inversion:** All dependencies point inward toward the domain

### 2.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Web App     │  │  Mobile App  │  │  Admin Panel │                   │
│  │  (React)     │  │  (React Native)│ │  (React)     │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  • JWT Authentication    • Rate Limiting    • Request Validation │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   REST API       │  │   WebSocket      │  │   Admin API      │
│   Server         │  │   Server         │  │   Server         │
│   (Fastify)      │  │   (Fastify-WS)   │  │   (Fastify)      │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CORE ENGINE                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Trading    │  │  Settlement │  │  Risk       │  │  Pricing    │    │
│  │  Engine     │  │  Engine     │  │  Engine     │  │  Engine     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    PostgreSQL Database                           │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │    │
│  │  │ users   │ │ markets │ │ pools   │ │portfolios│ │trade_ledger│ │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Redis Cache                                   │    │
│  │  • Price Cache    • Session Store    • Rate Limit Counters      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Node.js 20+ LTS | Server-side JavaScript execution |
| **Language** | TypeScript 5.x | Type safety and developer experience |
| **API Framework** | Fastify 4.x | High-performance REST API framework |
| **WebSocket** | @fastify/websocket | Native WebSocket support for Fastify |
| **Backend** | Supabase | Database (PostgreSQL), Auth, and Storage |
| **Database Access** | @supabase/supabase-js | Official Supabase JavaScript client |
| **Server Auth** | @supabase/ssr | Server-side authentication with cookies |
| **ORM** | Drizzle ORM | Type-safe database queries and migrations |
| **Cache** | Redis 7+ | Caching, rate limiting |
| **Validation** | Zod + Fastify Type Providers | Runtime schema validation with type inference |
| **Testing** | Vitest | Unit and integration testing |

> **Important:** We use **Supabase** as our backend platform. All database operations and authentication are handled through Supabase's server-side libraries. **We never use the Supabase frontend/browser client** - all requests go through our Fastify server using `@supabase/ssr`.

### 2.3 Key Design Principles

1. **Integer-Only Arithmetic:** All monetary calculations use `BigInt` to prevent floating-point errors
2. **Optimistic Locking:** Concurrent modifications are handled via version counters
3. **Audit Trail:** Every state change is logged to `trade_ledger` for compliance and debugging
4. **Fail-Safe Defaults:** System fails closed — if something is uncertain, reject the operation
5. **Idempotency:** All write operations support idempotency keys for safe retries

---

## 3. Economic Model

### 3.1 The Constant Product Market Maker (CPMM)

The CPMM algorithm maintains the invariant:

```
k = YES_qty × NO_qty
```

Where `k` must never decrease (it can increase due to fee injection).

#### Price Derivation

Given a pool with `x` YES tokens and `y` NO tokens:

| Price | Formula | Interpretation |
|-------|---------|----------------|
| **P_YES** | `y / (x + y)` | Cost to buy 1 YES share |
| **P_NO** | `x / (x + y)` | Cost to buy 1 NO share |

**Example:**
- Pool: 400 YES, 600 NO
- P_YES = 600 / (400 + 600) = 0.60 ($0.60)
- P_NO = 400 / (400 + 600) = 0.40 ($0.40)

### 3.2 Fee Structure

Total fee: **2.0%** (200 basis points)

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Vault (Revenue) | 1.0% | Platform revenue |
| Liquidity Injection | 1.0% | Increases pool depth over time |

#### Fee Application Rules

| Operation | Fee Timing | Fee Rate |
|-----------|------------|----------|
| **Buying** | Deducted from input (Points) BEFORE swap | 2.0% |
| **Selling** | Deducted from output (Points) AFTER swap | 2.0% |
| **Minting** | No fee | 0% |
| **Merging** | No fee | 0% |
| **Netting Exit** | No fee (the exit portion) | 0% |

### 3.3 Price Impact Visualization

```
Price Paid per Share ($)
   ^
   |
1.0|                  [DANGER ZONE]
   |                  /
   |                 /  ← Large trades cause significant
   |                /     price impact (slippage)
0.8|               /
   |              /
0.6|      _______/
   |     /
0.5|____/  ← Small trades have minimal impact
   |
   +------------------------------------->
    Trade Size ($ Amount)
   
   [Safe Zone]       [Slippage Zone]
   (Small buys)      (Large buys)
```

---

## 4. Market Lifecycle

### 4.1 State Machine

```
                    ┌─────────────┐
                    │   DRAFT     │
                    │ (Admin only)│
                    └──────┬──────┘
                           │ activate()
                           ▼
                    ┌─────────────┐
          ┌─────────│   ACTIVE    │─────────┐
          │         │ (Trading On)│         │
          │         └──────┬──────┘         │
          │                │                │
     pause()          resolve()        cancel()
          │                │                │
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │   PAUSED    │  │  RESOLVED   │  │  CANCELLED  │
   │(Trading Off)│  │ (Payout)    │  │  (Refund)   │
   └──────┬──────┘  └─────────────┘  └─────────────┘
          │
     resume()
          │
          ▼
   ┌─────────────┐
   │   ACTIVE    │
   └─────────────┘
```

### 4.2 State Definitions

| State | Trading | Description |
|-------|---------|-------------|
| `DRAFT` | No | Market created but not yet open. Admin can edit details. |
| `ACTIVE` | Yes | Market is live. Users can buy/sell/mint/merge. |
| `PAUSED` | No | Trading temporarily halted. Can be resumed. |
| `RESOLVED` | No | Event outcome known. Winners paid at 1.0 per share. |
| `CANCELLED` | No | Market voided. Principal refund protocol activated. |

### 4.3 Resolution Types

| Type | Winner Payout | Loser Payout | Trigger |
|------|---------------|--------------|---------|
| **YES Wins** | 1.0 per YES share | 0.0 | Admin resolves as YES |
| **NO Wins** | 1.0 per NO share | 0.0 | Admin resolves as NO |
| **Cancelled** | Cost basis refund | Cost basis refund | Admin cancels market |

---

## 5. System Components

### 5.1 Trading Engine

The Trading Engine is responsible for executing all market operations:

| Operation | Input | Output | Fee |
|-----------|-------|--------|-----|
| **Buy** | Points + Side | Shares | 2% on input |
| **Sell** | Shares + Side | Points | 2% on output |
| **Mint** | Points | YES + NO (equal) | 0% |
| **Merge** | YES + NO (equal) | Points | 0% |

### 5.2 Settlement Engine

Handles end-of-market payouts:

1. **Standard Resolution:** Pay winners 1.0 per share
2. **Refund Resolution:** Return cost basis to all holders
3. **Ambiguous Resolution:** Settle at 0.50 (deprecated in favor of refund)

### 5.3 Risk Engine

Continuous monitoring for system health:

| Check | Threshold | Action |
|-------|-----------|--------|
| k-invariant drift | k decreases | Pause market, alert admin |
| Pool imbalance | >99% on one side | Warning, increase slippage tolerance |
| Rapid price movement | >20% in 1 minute | Rate limit trades, alert |
| Treasury balance | <$1000 | Alert admin |

### 5.4 Pricing Engine

Provides real-time price quotes:

- **Spot Price:** Current instantaneous price (no slippage)
- **Execution Price:** Actual price including slippage for a given trade size
- **Max Buy Calculator:** Maximum shares purchasable with a given balance

### 5.5 Background Job System (BullMQ + Redis)

> **Infrastructure Stories:** See EPIC_00 - JOBS-1 through JOBS-3  
> **Market Scheduler Stories:** See EPIC_10 - SCHEDULER-1 through SCHEDULER-7

A **generic, reusable job queue infrastructure** for all background processing needs. Built with BullMQ + Redis to handle scheduled tasks, async processing, and event-driven workflows.

#### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Job Queue** | BullMQ 5.x | Reliable job processing with retries, delays, priorities |
| **Message Broker** | Redis 7+ | Fast in-memory storage for job queues |
| **Worker Process** | Separate Node.js process | Processes jobs independently from API server |

#### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         API Server (Fastify)                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  REST Routes   │  │  WebSocket     │  │  QueueService          │ │
│  │                │  │                │  │  (job producer)        │ │
│  └────────────────┘  └────────────────┘  └───────────┬────────────┘ │
└──────────────────────────────────────────────────────┼──────────────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Redis (BullMQ Queues)                        │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │
│  │ market-ops     │ │ notifications  │ │ maintenance    │  ...more  │
│  └────────────────┘ └────────────────┘ └────────────────┘           │
└──────────────────────────────────────────────────────┬──────────────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Worker Process (Separate)                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  JobProcessor (generic handler registration)                    │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │ │
│  │  │ MarketJobs   │ │ NotifyJobs   │ │ SystemJobs   │  ...more   │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

#### Queue Registry (Extensible)

| Queue | Purpose | Current Jobs | Future Examples |
|-------|---------|--------------|-----------------|
| `market-ops` | Market lifecycle automation | `check-expired`, `activate-scheduled` | `auto-resolve-oracle`, `archive-old-markets` |
| `notifications` | User & admin notifications | `alert-pending-resolution` | `trade-confirmation-email`, `weekly-digest`, `push-notifications` |
| `maintenance` | System housekeeping | `cleanup-tokens` | `backup-snapshots`, `prune-ledger`, `recalculate-stats` |
| `analytics` | Data processing | — | `calculate-leaderboard`, `aggregate-volume`, `generate-reports` |
| `integrations` | External services | — | `webhook-delivery`, `oracle-fetch`, `social-share` |

#### Key BullMQ Features

- **Repeatable Jobs:** Cron-like scheduling (`every 1 minute`, `daily at 3am`)
- **Delayed Jobs:** Schedule for specific future time
- **Job Retries:** Automatic retry with exponential backoff
- **Job Prioritization:** Critical jobs processed first
- **Concurrency Control:** Parallel processing with configurable limits
- **Job Events:** Real-time status tracking and monitoring
- **Rate Limiting:** Prevent overwhelming external services
- **Job Dependencies:** Chain jobs that depend on others

#### Adding New Jobs (Developer Guide)

```typescript
// 1. Define job type in shared/jobs/types.ts
export interface CalculateLeaderboardJob {
  type: 'analytics:calculate-leaderboard';
  data: { period: 'daily' | 'weekly' | 'allTime' };
}

// 2. Register handler in worker/handlers/analytics.ts
export const analyticsHandlers = {
  'analytics:calculate-leaderboard': async (job) => {
    // Implementation
  },
};

// 3. Add to queue from anywhere in the app
await queueService.add('analytics', {
  type: 'analytics:calculate-leaderboard',
  data: { period: 'weekly' },
});

// 4. Or schedule as repeatable
await queueService.addRepeatable('analytics', {
  type: 'analytics:calculate-leaderboard',
  data: { period: 'daily' },
}, { pattern: '0 0 * * *' }); // Daily at midnight
```

#### Dependencies

```json
{
  "bullmq": "^5.65.1",
  "ioredis": "^5.8.2"
}
```

#### Environment Variables

```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=optional_password
WORKER_CONCURRENCY=10
ENABLE_WORKER=true
```

---

## 6. Security Model

### 6.1 Authentication (Supabase Auth)

- **Provider:** Supabase Auth (server-side only via `@supabase/ssr`)
- **Method:** Email/password authentication with PKCE flow
- **Session Management:** Secure HTTP-only cookies managed by Supabase
- **Token Refresh:** Automatic via Supabase SSR middleware
- **No Frontend Client:** All auth operations go through the Fastify server

> **Critical:** We never use `@supabase/supabase-js` browser client. All Supabase operations use `createServerClient` from `@supabase/ssr` on the server.

### 6.2 Authorization

| Role | Permissions | Supabase User Metadata |
|------|-------------|------------------------|
| `user` | View markets, trade, view own portfolio | `role: 'user'` |
| `admin` | All user permissions + create/pause/resolve/cancel markets | `role: 'admin'` |
| `treasury` | System account for house liquidity | `role: 'treasury'`|

Roles are stored in `auth.users.raw_user_meta_data` and synced to our `users` table.

### 6.3 Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public (prices, markets) | 100 req | 1 minute |
| Authenticated (trades) | 30 req | 1 minute |
| Admin | 60 req | 1 minute |
| WebSocket messages | 10 msg | 1 second |

### 6.4 Input Validation

All inputs are validated using Zod schemas:

- Trade amounts: Must be positive integers, minimum 1000 MicroPoints ($0.001)
- Market IDs: Must be valid UUIDs
- Sides: Must be exactly 'YES' or 'NO'
- Slippage tolerance: 0-100% (default 1%)

---

## 7. Performance Considerations

### 7.1 Scalability Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Concurrent users | 10,000 | WebSocket connections |
| Trades per second | 100 | Peak throughput |
| API latency (p50) | <50ms | Excluding network |
| API latency (p99) | <200ms | Excluding network |
| Price update latency | <100ms | WebSocket broadcast |

### 7.2 Caching Strategy

| Data | Cache TTL | Invalidation |
|------|-----------|--------------|
| Market list | 5 seconds | On market state change |
| Spot prices | 1 second | On any trade |
| User portfolios | No cache | Always fresh (critical data) |
| Historical trades | 1 hour | Append-only data |

### 7.3 Database Optimization

- **Connection Pooling:** Min 5, Max 20 connections
- **Indexes:** See DATABASE_SCHEMA.md for index strategy
- **Partitioning:** `trade_ledger` partitioned by month (for large deployments)
- **Read Replicas:** Optional for read-heavy queries (market listings, history)

---

## 8. Monitoring & Observability

### 8.1 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `trades_total` | Counter | Total trades executed |
| `trade_volume_points` | Counter | Total points traded |
| `active_markets` | Gauge | Number of active markets |
| `pool_k_value` | Gauge | k-invariant per market |
| `api_latency_seconds` | Histogram | Request duration |

### 8.2 Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| k-invariant decreased | k_new < k_old | Critical |
| High error rate | >5% 5xx errors | High |
| API latency spike | p99 > 1s for 5 min | Medium |
| Low treasury balance | balance < $1000 | High |

### 8.3 Logging

- **Format:** Structured JSON
- **Levels:** ERROR, WARN, INFO, DEBUG
- **Required Fields:** timestamp, level, service, traceId, message
- **Sensitive Data:** Never log passwords, tokens, or full credit card numbers

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **AMM** | Automated Market Maker — algorithm providing liquidity |
| **CPMM** | Constant Product Market Maker — specific AMM using x×y=k |
| **MicroPoints** | 1/1,000,000 of a Point ($1.00 = 1,000,000 MicroPoints) |
| **Netting** | Process of canceling opposing positions before a trade |
| **Slippage** | Difference between expected and executed price |
| **k-invariant** | The product YES_qty × NO_qty that must never decrease |
| **Cost Basis** | Total amount invested in current holdings |
| **Minting** | Creating new YES+NO shares by depositing Points |
| **Merging** | Destroying YES+NO shares to withdraw Points |
| **Genesis** | Initial market creation with seed liquidity |

---

## Related Documents

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — Complete database schema and Drizzle types
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) — REST API endpoint documentation
- [ENGINE_LOGIC.md](./ENGINE_LOGIC.md) — Mathematical formulas and TypeScript implementation
- [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) — Real-time communication protocol
- [EDGE_CASES.md](./EDGE_CASES.md) — Edge case handling and safety protocols

---

*Document Version: 3.1 | Status: Production Ready*

