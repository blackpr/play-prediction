# Play-Prediction Platform: Technical Overview for Engineering Leadership

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Audience:** Engineering Leadership
---

## Executive Summary

Play-Prediction is a **binary prediction market platform** built on a **Constant Product Market Maker (CPMM)** algorithm. The platform enables users to trade shares representing YES/NO outcomes on real-world events, with prices determined algorithmically through an Automated Market Maker (AMM) that provides continuous liquidity.

### Key Characteristics

- **Virtual Points System**: No real money - users trade with virtual Points (no cash value, cannot be withdrawn)
- **Always-On Liquidity**: Users can trade 24/7 without waiting for counterparties
- **Transparent Pricing**: Algorithmic price discovery based on supply and demand
- **Provable Solvency**: Mathematical guarantees ensure the system can always pay winners
- **Real-Time Updates**: WebSocket-based live price feeds and trade notifications
- **Production-Ready**: Comprehensive testing, monitoring, and admin tooling

### Technology Stack at a Glance

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19 + TanStack Start (SPA) | Modern type-safe UI framework |
| **Backend** | Fastify 4.x + TypeScript | High-performance REST API |
| **Database** | Supabase (PostgreSQL 15+) | Managed database + auth |
| **ORM** | Drizzle ORM | Type-safe database access |
| **Auth** | Supabase Auth (@supabase/ssr) | Server-side session management |
| **Real-Time** | @fastify/websocket + Redis | WebSocket server with pub/sub |
| **Background Jobs** | BullMQ + Redis | Scheduled tasks and async processing |
| **Validation** | Zod v4 | Runtime schema validation |
| **Testing** | Vitest | Unit and integration tests |

---

## Table of Contents

1. [Core Concepts & Jargon](#1-core-concepts--jargon)
2. [System Architecture](#2-system-architecture)
3. [Economic Model (CPMM)](#3-economic-model-cpmm)
4. [Feature Breakdown](#4-feature-breakdown)
5. [Technical Implementation](#5-technical-implementation)
6. [Data Flow & API](#6-data-flow--api)
7. [Real-Time Systems](#7-real-time-systems)
8. [Background Jobs & Automation](#8-background-jobs--automation)
9. [Admin & Operational Features](#9-admin--operational-features)
10. [Security & Performance](#10-security--performance)
11. [Development & Deployment](#11-development--deployment)

---

## 1. Core Concepts & Jargon

### 1.1 Prediction Market Terminology

| Term | Definition |
|------|------------|
| **Binary Market** | A market with exactly two possible outcomes: YES or NO |
| **Shares** | Tokens representing a position on an outcome (YES shares or NO shares) |
| **Position** | A user's holdings in a market (can hold YES, NO, or both) |
| **Resolution** | The process of determining the final outcome and paying winners |
| **Liquidity Pool** | The reserve of YES and NO shares available for trading |

### 1.2 AMM (Automated Market Maker) Concepts

| Term | Definition |
|------|------------|
| **AMM** | Automated Market Maker - algorithm that provides liquidity without human market makers |
| **CPMM** | Constant Product Market Maker - specific AMM using the formula `x × y = k` |
| **k-invariant** | The product `YES_qty × NO_qty` that must never decrease (ensures solvency) |
| **Slippage** | The difference between expected and actual execution price |
| **Price Impact** | How much a trade moves the market price |
| **Spot Price** | Current instantaneous price (no slippage) |
| **Execution Price** | Actual average price paid including slippage |

### 1.3 Trading Operations

| Operation | Description | Fee |
|-----------|-------------|-----|
| **Buy** | Purchase YES or NO shares with Points | 2% |
| **Sell** | Sell YES or NO shares for Points | 2% |
| **Mint** | Create a complete set (1 YES + 1 NO) for exactly 1 Point | 0% |
| **Merge** | Destroy a complete set (1 YES + 1 NO) to get exactly 1 Point back | 0% |
| **Netting** | Automatic cancellation of opposing positions before conflicting trades | 0% |

### 1.4 Monetary Units

| Unit | Value | Example |
|------|-------|---------|
| **Point** | Base currency unit | 1 Point = $1.00 equivalent |
| **MicroPoints** | 1/1,000,000 of a Point | 1,000,000 MicroPoints = 1 Point |
| **Minimum Trade** | 1,000 MicroPoints | $0.001 equivalent |

> **Critical**: All monetary calculations use `BigInt` (64-bit integers) in MicroPoints to prevent floating-point precision errors.

### 1.5 Market Lifecycle States

| State | Trading Allowed | Description |
|-------|----------------|-------------|
| **DRAFT** | No | Market created but not yet activated (admin only) |
| **ACTIVE** | Yes | Market is live and accepting trades |
| **PAUSED** | No | Trading temporarily halted (can be resumed) |
| **RESOLVED** | No | Outcome determined, winners paid out |
| **CANCELLED** | No | Market voided, all participants refunded |

### 1.6 The 3 Immutable Rules

These rules are the foundation of system integrity:

| Rule | Name | Description |
|------|------|-------------|
| **Rule 1** | Conservation of Mass | New shares only created by minting complete sets (1 YES + 1 NO = 1 Point) |
| **Rule 2** | Exclusivity | Users cannot hold conflicting positions (system forces netting) |
| **Rule 3** | The Floor Rule | All rounding favors the house: user payouts round DOWN, fees round UP |

### 1.7 The Golden Equation

At all times, prices must satisfy:

```
P_YES + P_NO = 1.0
```

Where:
- `P_YES = NO_qty / (YES_qty + NO_qty)`
- `P_NO = YES_qty / (YES_qty + NO_qty)`

This ensures buying a complete set (1 YES + 1 NO) always costs exactly 1 Point.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Web App     │  │  Mobile App  │  │  Admin Panel         │  │
│  │  (React SPA) │  │  (Future)    │  │  (React)             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘  │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Fastify)                       │
│  • JWT Auth (Supabase)  • Rate Limiting  • Request Validation   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   REST API   │  │  WebSocket   │  │  Admin API   │
│   Server     │  │  Server      │  │  Server      │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CORE ENGINE                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Trading    │  │  Settlement │  │  Risk       │             │
│  │  Engine     │  │  Engine     │  │  Engine     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Supabase)                                   │   │
│  │  • users  • markets  • pools  • portfolios  • ledger    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Redis                                                   │   │
│  │  • Price Cache  • Sessions  • Rate Limits  • Job Queue  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Backend Architecture (Hexagonal/DDD)

The backend follows **Domain-Driven Design** with **Hexagonal Architecture** (Ports & Adapters):

```
Dependencies ONLY point inward:
Presentation → Application → Domain ← Infrastructure
```

| Layer | Contains | Imports From | Framework-Dependent |
|-------|----------|--------------|---------------------|
| **Domain** | Entities, Value Objects, Domain Services | Nothing | No |
| **Application** | Use Cases, Ports (interfaces) | Domain only | No |
| **Infrastructure** | Repositories, External services | Application, Domain | Yes (Drizzle, Supabase) |
| **Presentation** | Routes, Middleware, Validation | Application only | Yes (Fastify) |

**Key Benefit**: The core business logic (Domain + Application layers) is **framework-agnostic**. Swapping Fastify for Express/Hono/any other framework only requires changes to the Presentation layer.

### 2.3 Frontend Architecture (SPA)

```
┌─────────────────────────────────────────────────────────────────┐
│                    React SPA (Browser)                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ TanStack     │  │ TanStack     │  │ TanStack             │  │
│  │ Router       │  │ Query        │  │ Form                 │  │
│  │ (Navigation) │  │ (Server Data)│  │ (Forms)              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────┴─────────────────┴──────────────────────┴───────────┐  │
│  │              API Client (Fetch + WebSocket)                │  │
│  │  - credentials: 'include' (sends cookies)                  │  │
│  │  - Error handling & retry logic                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP/WS (Session cookies)
                               ▼
                    Fastify API Server
```

**Important**: The frontend **never** calls Supabase directly. All requests go through our Fastify API.

### 2.4 Database Schema Overview

```
┌─────────────┐       ┌─────────────┐
│    users    │       │   markets   │
├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │
│ email       │       │ title       │
│ balance     │       │ status      │
│ role        │       │ resolution  │
└─────┬───────┘       │ closes_at   │
      │               │ close_behavior │
      │               └─────┬───────┘
      │                     │
      │    ┌────────────────┘
      │    │
      ▼    ▼
┌─────────────────────────────────┐
│         portfolios              │
├─────────────────────────────────┤
│ user_id (PK, FK)                │
│ market_id (PK, FK)              │
│ yes_qty, no_qty                 │
│ yes_cost_basis, no_cost_basis   │
└─────────────────────────────────┘

┌─────────────┐       ┌─────────────────┐
│ liquidity_  │       │  trade_ledger   │
│ pools       │       ├─────────────────┤
├─────────────┤       │ id (PK)         │
│ id (FK)     │       │ user_id (FK)    │
│ yes_qty     │       │ market_id (FK)  │
│ no_qty      │       │ action          │
│ version_id  │       │ amount_in/out   │
└─────────────┘       │ fee_paid        │
                      │ pool_before/after│
                      └─────────────────┘
```

**Key Tables**:
- `users`: User profiles, balances, roles
- `markets`: Market metadata and lifecycle state
- `liquidity_pools`: AMM pool state (YES/NO quantities)
- `portfolios`: User positions per market
- `trade_ledger`: Immutable audit trail of all transactions
- `point_grants`: Audit trail for point grants (registration bonuses, admin grants)

---

## 3. Economic Model (CPMM)

### 3.1 The Constant Product Formula

The CPMM maintains the invariant:

```
k = YES_qty × NO_qty
```

Where `k` must **never decrease** (it can increase due to fee injection).

### 3.2 Price Derivation

Given a pool with `x` YES tokens and `y` NO tokens:

| Price | Formula | Interpretation |
|-------|---------|----------------|
| **P_YES** | `y / (x + y)` | Cost to buy 1 YES share |
| **P_NO** | `x / (x + y)` | Cost to buy 1 NO share |

**Example**:
- Pool: 400 YES, 600 NO
- P_YES = 600 / 1000 = 0.60 ($0.60)
- P_NO = 400 / 1000 = 0.40 ($0.40)

### 3.3 Fee Structure

Total fee: **2.0%** (200 basis points)

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Vault (Revenue) | 1.0% | Platform revenue |
| Liquidity Injection | 1.0% | Increases pool depth over time |

**Fee Application**:
- **Buying**: Fee deducted from input (Points) BEFORE swap
- **Selling**: Fee deducted from output (Points) AFTER swap
- **Minting/Merging**: No fees

**Fee Destinations**:
- **Vault Fee (1%)**: Transferred to treasury account balance. This is platform revenue used for operational costs, point grants, and promotional activities.
- **LP Fee (1%)**: Injected back into the liquidity pool on the opposite side of the trade. This increases pool depth over time, improving prices for all traders.

### 3.4 Swap Mathematics

**Buying YES with Δy points**:
```
New y' = y + Δy
New x' = k / y' = (x × y) / (y + Δy)
Shares received = x - x'
```

**Selling Δx YES shares**:
```
New x' = x + Δx
New y' = k / x' = (x × y) / (x + Δx)
Points received = y - y'
```

### 3.5 Netting Protocol

**Problem**: Users cannot hold conflicting positions (Rule 2: Exclusivity).

**Solution**: Before executing a trade that would create a conflict, the system automatically:
1. Cancels opposing shares (netting)
2. Refunds the cost basis proportionally
3. Proceeds with the remaining trade

**Example**:
- User holds: 100 YES shares
- User wants to buy: 150 NO shares
- System automatically:
  - Nets 100 YES against 100 NO (merge to get 100 Points back)
  - Proceeds to buy remaining 50 NO shares

### 3.6 Seed Liquidity & Market Genesis

**Seed liquidity** is the initial pool of YES and NO shares created when a market is initialized. These shares are created via a `GENESIS_MINT` operation and granted to the **treasury account** (a special platform account with `role = 'treasury'`).

> **Critical Implementation Detail**: The treasury's **Points balance is NOT deducted**. The system creates shares "out of thin air" and grants them to the treasury's portfolio. This is similar to how a central bank creates currency. The treasury account must exist (user with `role = 'treasury'`), but its balance is not affected by market creation.

#### How Seed Liquidity Works

When an admin creates a market with seed amount `S` Points at initial YES price `P`:

**50/50 Genesis (P = 0.5)**:
```
Seed: S Points
YES_qty = S MicroPoints
NO_qty = S MicroPoints
P_YES = NO / (YES + NO) = S / (S + S) = 0.5
P_NO = YES / (YES + NO) = S / (S + S) = 0.5
```

**Skewed Genesis (P ≠ 0.5)**:
```
Given: Seed S, Initial YES price P
Goal: Find YES_qty and NO_qty such that:
  1. P_YES = NO_qty / (YES_qty + NO_qty) = P
  2. YES_qty + NO_qty = 2S (total shares from seed)

Solution:
  NO_qty = P × 2S
  YES_qty = (1 - P) × 2S

Example (S = 100 Points, P = 0.30):
  NO_qty = 0.30 × 200 = 60 MicroPoints
  YES_qty = 0.70 × 200 = 140 MicroPoints
  Check: 60 / (140 + 60) = 60 / 200 = 0.30 ✓
```

#### Impact on Trading

| Seed Amount | Price Impact | Use Case |
|-------------|--------------|----------|
| 10-50 Points | High (5-20%) | Low-volume markets, testing |
| 100-500 Points | Medium (1-5%) | Standard markets |
| 1,000+ Points | Low (<1%) | High-volume, popular events |

**Example: Price Impact Comparison**

User buys 10 YES shares:

```
Market A (100 Points seed):
  Initial: 100 YES, 100 NO
  After buy: ~91 YES, 110 NO
  Price change: 50% → 55% (+10% impact)

Market B (1,000 Points seed):
  Initial: 1,000 YES, 1,000 NO
  After buy: ~991 YES, 1,010 NO
  Price change: 50% → 50.5% (+1% impact)
```

#### Seed Liquidity Lifecycle

**1. Market Creation (GENESIS_MINT)**:
```
Treasury balance: 10,000 Points (unchanged)
Admin creates market with 100 Points seed
→ System creates 100 YES + 100 NO shares
→ Treasury portfolio: +100 YES, +100 NO
→ Pool: 100 YES, 100 NO available for trading
→ Treasury balance: Still 10,000 Points ✓
```

**2. Trading Phase**:
```
Users trade → Pool quantities change
Fees collected:
  - Vault fee (1%): Transferred to treasury account balance
  - LP fee (1%): Injected back into pool
Pool depth increases over time due to LP fee injection
Treasury balance increases over time from vault fees
```

**3. Market Resolution (YES wins)**:
```
Pool state: 80 YES, 120 NO
Winners paid: 120 Points (1 Point per YES share)
Treasury portfolio: Cleared
Pool: Cleared
→ Net result: Treasury "printed" shares, users traded,
   winners got paid from the pool. Treasury balance unchanged.
```

**4. Market Cancellation**:
```
All users refunded at cost basis (from their portfolios)
Pool cleared
Treasury portfolio: Cleared
→ Users get their Points back, shares disappear
```

#### Why Seed Liquidity Matters

1. **Enables Instant Trading**: Without seed liquidity, the pool would be empty and no trades could execute
2. **Determines Price Stability**: More liquidity = less price impact = better user experience
3. **Acts as Market Maker**: The pool is always willing to buy/sell at the current price
4. **Scales with Volume**: Popular markets should have higher seed to handle larger trades
5. **Treasury Management**: Seed is locked capital that returns (minus payouts) on resolution

#### Best Practices

- **Popular events**: 500-1,000+ Points seed (sports finals, major elections)
- **Standard markets**: 100-500 Points seed (regular games, daily events)
- **Experimental markets**: 10-50 Points seed (testing, low-interest topics)
- **Skewed genesis**: Use when market has clear favorite (e.g., 80% YES for "Will the sun rise tomorrow?")

---

## 4. Feature Breakdown

### 4.1 Epic 0: Project Setup

**Infrastructure & Tooling**:
- Supabase local development environment
- Drizzle ORM with type-safe migrations
- Fastify server with TypeScript
- React SPA with TanStack Start
- BullMQ job queue infrastructure
- Dependency Injection container

**Key Decisions**:
- **No Supabase browser client**: All auth/DB access goes through Fastify
- **Drizzle-kit for migrations**: Never use Supabase CLI for schema changes
- **BigInt for money**: All monetary values use `BigInt` in MicroPoints

### 4.2 Epic 1: Authentication

**Features**:
- Email/password registration via Supabase Auth
- Server-side session management (`@supabase/ssr`)
- HTTP-only cookies (not accessible to JavaScript)
- Automatic session refresh
- Role-based access control (user, admin, treasury)

**Security**:
- Always use `getUser()` for auth validation (validates with Supabase server)
- Never trust `getSession()` on server (can be spoofed)
- Session cookies are HTTP-only and secure

### 4.3 Epic 2: User Profile & Balance

**Features**:
- User profile with virtual Points balance
- Welcome bonus on registration (default: 10 Points)
- Point grants by admins
- Points history audit trail

**Virtual Points System**:
- Points have **no cash value**
- Cannot be withdrawn or exchanged for real currency
- Simplifies regulatory compliance
- Focus on prediction mechanics

### 4.4 Epic 3-4: Markets

**Market Listing**:
- Filter by status, category
- Sort by newest, volume, ending soon
- Pagination
- Real-time price updates via WebSocket

**Market Detail**:
- Full market information
- Live price chart (Recharts)
- Trade form with slippage protection
- Order book visualization
- Trade history

**Market Close Behavior**:
- `auto`: Auto-close when `closes_at` passes
- `manual`: Admin must close (for sports with variable end times)
- `auto_with_buffer`: Auto-close after buffer period (for events with potential overtime)

### 4.5 Epic 5-6: Trading Engine & UI

**Trading Operations**:
- **Buy**: Purchase YES/NO shares with slippage protection
- **Sell**: Sell shares with minimum payout protection
- **Mint**: Create complete sets (1 YES + 1 NO for 1 Point)
- **Merge**: Destroy complete sets (1 YES + 1 NO → 1 Point)

**Trade Form Features**:
- Real-time price quotes
- Slippage tolerance settings
- Max buy calculator
- Estimated execution price
- Fee breakdown display
- Idempotency keys for safe retries

**Safety Mechanisms**:
- Optimistic locking (version counters)
- Slippage protection
- Minimum trade size (1,000 MicroPoints)
- k-invariant validation
- Atomic transactions

### 4.6 Epic 7: Mint & Merge

**Mint Operation**:
- Create 1 YES + 1 NO for exactly 1 Point
- No fees
- Useful for arbitrage or position building

**Merge Operation**:
- Destroy 1 YES + 1 NO to get exactly 1 Point back
- No fees
- Useful for exiting positions without slippage

### 4.7 Epic 8: Portfolio

**Features**:
- View all active positions
- Unrealized P&L calculation
- Cost basis tracking
- Position history
- Trade history with filters
- Export to CSV

**P&L Calculation**:
```
Unrealized P&L = (Current Value) - (Cost Basis)
Current Value = shares × current_price
```

### 4.8 Epic 9: Admin - Market Management

**Market Creation**:
- Create markets with metadata
- Set close behavior (auto/manual/buffer)
- Upload market images
- Assign categories
- Set close time

**Market Control**:
- Activate/Pause/Resume markets
- Update market details
- Extend close time
- Cancel markets (refund all participants)

**Skewed Genesis**:
- Create markets with non-50/50 initial prices
- Set `initialYesPrice` (e.g., 0.30 for 30% YES)
- System calculates appropriate YES/NO quantities

### 4.9 Epic 10: Admin - Resolution & Points

**Market Resolution**:
- Resolve as YES or NO
- Automatic winner payouts (1 Point per winning share)
- Post-event trade voiding (trades after event ended)
- Audit logging

**Market Cancellation**:
- Refund all participants at cost basis
- Clear all positions
- Track surplus to treasury

**Point Management**:
- Grant points to users
- View grant history
- Audit trail with reasons
- Grant types: ADMIN_GRANT, PROMOTION, CORRECTION

**User Management**:
- View all users
- Search and filter by role
- View user details and stats
- Grant points to users

**Audit Logs**:
- View all admin actions
- Filter by action type, admin, date range
- Export audit logs

**Admin Stats Dashboard**:
- Total users, active users (7 days)
- Total markets by status
- Trading volume (total, 24h)
- Platform health metrics

### 4.10 Epic 11: Real-Time Updates (WebSocket)

**WebSocket Features**:
- Live price updates after trades
- Market state changes (paused, resolved)
- User-specific trade confirmations
- Balance updates
- Resolution payouts

**Channels**:
- `global`: Platform-wide events
- `market:<id>`: Market-specific updates
- `user:<id>`: User-specific notifications

**Protocol**:
- Session-based authentication (cookies)
- Subscribe/unsubscribe to channels
- Heartbeat (ping/pong)
- Automatic reconnection
- Rate limiting (10 msg/sec)

**Redis Pub/Sub**:
- Horizontal scaling support
- Multiple server instances
- Shared state via Redis

### 4.11 Epic 12: Webhooks (Optional Future)

**Planned Features**:
- Webhook subscriptions for external integrations
- Event types: trade, market_resolved, market_created
- Retry logic with exponential backoff
- Signature verification (HMAC)
- Webhook delivery logs

---

## 5. Technical Implementation

### 5.1 Backend Code Organization

> **Note**: The codebase follows a **pragmatic layered architecture** rather than strict DDD. While the folder structure suggests hexagonal architecture, the actual implementation is more practical.

```
backend/src/
├── domain/                      # Pure business logic (minimal external deps)
│   ├── entities/                # Mostly empty (only audit-log.entity.ts)
│   ├── value-objects/           # Empty (only .gitkeep)
│   ├── services/                # Core CPMM logic, fee calculation
│   │   ├── cpmm-engine.ts       # Constant product market maker math
│   │   ├── fee-calculator.ts    # Fee calculation and splitting
│   │   └── constants.ts         # Domain constants (FEE_RATE_BP, etc.)
│   ├── errors/                  # Domain-specific errors
│   └── repositories/            # Repository interfaces (empty - moved to application/ports)
│
├── application/                 # Use cases & orchestration
│   ├── ports/                   # Interfaces (contracts)
│   │   ├── repositories/        # IMarketRepo, IUserRepo, etc.
│   │   └── services/            # IAuthService, IEventPublisher
│   ├── use-cases/               # Business logic orchestration
│   │   ├── admin/               # Admin operations (create market, resolve, etc.)
│   │   ├── trading/             # Trading operations (buy, sell, mint, merge)
│   │   ├── user/                # User operations (profile, balance)
│   │   └── market/              # Market queries
│   └── dto/                     # Data Transfer Objects (minimal usage)
│
├── infrastructure/              # External implementations
│   ├── database/
│   │   ├── drizzle/             # Drizzle client, schema, migrations
│   │   └── repositories/        # Concrete repository implementations
│   ├── auth/                    # Supabase auth service
│   ├── events/                  # Event publisher (minimal)
│   ├── jobs/                    # BullMQ job handlers
│   ├── websocket/               # WebSocket manager
│   └── di/                      # Dependency injection container
│
├── presentation/                # HTTP/WS layer (Fastify-specific)
│   └── fastify/
│       ├── routes/              # REST endpoints
│       │   ├── admin/           # Admin routes
│       │   ├── auth/            # Auth routes
│       │   ├── markets/         # Market routes
│       │   ├── portfolio/       # Portfolio routes
│       │   └── trading/         # Trading routes
│       ├── middleware/          # Auth, rate limiting, error handling
│       ├── schemas/             # Zod validation schemas
│       └── plugins/             # Fastify plugins
│
└── shared/                      # Shared utilities
    ├── config/                  # App configuration
    ├── logger/                  # Logging setup
    └── utils/                   # Helper functions
```

**Key Differences from Ideal DDD**:
- **No rich domain entities**: Most logic is in use cases, not entity methods
- **No value objects**: Using primitive types (BigInt, string) directly
- **Pragmatic separation**: Focus on maintainability over architectural purity
- **Repository interfaces in application layer**: Not in domain layer
- **Use cases are the core**: Business logic lives here, not in domain entities

**Why This Works**:
- ✅ Clear separation of concerns
- ✅ Testable business logic
- ✅ Easy to understand and maintain
- ✅ Framework-agnostic core (use cases + domain services)
- ✅ Can evolve toward richer domain model if needed

### 5.2 Key Backend Patterns

**Dependency Injection**:
```typescript
// All dependencies injected via constructor
class ExecuteTradeUseCase {
  constructor(
    private marketRepo: IMarketRepository,
    private userRepo: IUserRepository,
    private poolRepo: ILiquidityPoolRepository,
    private portfolioRepo: IPortfolioRepository,
    private ledgerRepo: ITradeLedgerRepository,
    private txManager: ITransactionManager
  ) {}
}
```

**Optimistic Locking**:
```typescript
// Prevent concurrent modifications
const pool = await poolRepo.findById(marketId);
const versionBefore = pool.versionId;

// ... perform calculations ...

await poolRepo.update({
  ...newPoolState,
  versionId: versionBefore + 1
}, {
  where: { id: marketId, versionId: versionBefore }
});
// Throws if another transaction modified the pool
```

**Audit Trail**:
```typescript
// Every state change logged to trade_ledger
await ledgerRepo.insert({
  userId,
  marketId,
  action: 'BUY',
  side: 'YES',
  amountIn,
  amountOut: sharesOut,
  feePaid,
  poolYesBefore,
  poolYesAfter,
  // ... complete snapshot
});
```

### 5.3 Frontend Code Organization

```
frontend/src/
├── routes/                      # File-based routing
│   ├── __root.tsx               # Root layout
│   ├── index.tsx                # Home page
│   ├── markets/
│   │   ├── index.tsx            # Markets list
│   │   └── $marketId.tsx        # Market detail
│   ├── portfolio/
│   └── admin/
│
├── components/                  # React components
│   ├── ui/                      # Base UI (Button, Input, Card)
│   ├── layout/                  # Header, Sidebar, Footer
│   ├── market/                  # MarketCard, PriceChart, TradeForm
│   └── portfolio/               # PositionCard, TradeHistory
│
├── api/                         # API client layer
│   ├── client.ts                # Base fetch client
│   ├── auth.ts                  # Auth endpoints
│   ├── markets.ts               # Market endpoints
│   └── trading.ts               # Trading endpoints
│
├── hooks/                       # Custom React hooks
│   ├── useAuth.ts               # Auth state
│   ├── useMarkets.ts            # Market queries
│   ├── useWebSocket.ts          # WebSocket connection
│   └── useTrading.ts            # Trading mutations
│
└── lib/                         # Utilities
    ├── format.ts                # MicroPoints formatting
    └── constants.ts             # App constants
```

### 5.4 Key Frontend Patterns

**TanStack Query for Server State**:
```typescript
// Declarative data fetching with caching
export const marketQueryOptions = (id: string) => ({
  queryKey: ['markets', id],
  queryFn: async () => {
    const res = await api.get(`/markets/${id}`);
    return res.data;
  },
  staleTime: 1000 * 60, // 1 minute
});

// In component
const { data: market } = useQuery(marketQueryOptions(marketId));
```

**TanStack Form for Type-Safe Forms**:
```typescript
const form = useForm({
  defaultValues: { side: 'YES', amount: '' },
  onSubmit: async ({ value }) => {
    await tradeMutation.mutateAsync(value);
  },
});
```

**WebSocket Hook**:
```typescript
const ws = useWebSocket({
  onPriceUpdate: (data) => {
    // Update market cache
    queryClient.setQueryData(['markets', data.marketId], (old) => ({
      ...old,
      pool: data.pool,
    }));
  },
});

// Subscribe to market
ws.subscribe(`market:${marketId}`);
```

---

## 6. Data Flow & API

### 6.1 Authentication Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Client  │                    │ Fastify │                    │Supabase │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                              │                              │
     │ POST /auth/login             │                              │
     │ {email, password}            │                              │
     │─────────────────────────────\u003e│                              │
     │                              │ signInWithPassword()         │
     │                              │─────────────────────────────\u003e│
     │                              │                              │
     │                              │\u003c─────────────────────────────│
     │                              │ Set-Cookie (session)         │
     │ 200 OK + Set-Cookie          │                              │
     │\u003c─────────────────────────────│                              │
     │                              │                              │
     │ GET /markets                 │                              │
     │ Cookie: sb-xxx=...           │                              │
     │─────────────────────────────\u003e│                              │
     │                              │ getUser() (validates)        │
     │                              │─────────────────────────────\u003e│
     │                              │\u003c─────────────────────────────│
     │ 200 OK {markets}             │                              │
     │\u003c─────────────────────────────│                              │
```

**Key Points**:
- Session stored in HTTP-only cookies (not accessible to JS)
- Frontend never calls Supabase directly
- Server validates session on every request via `getUser()`

### 6.2 Trading Flow

```
1. User submits trade form
   ↓
2. Frontend: POST /markets/:id/buy
   {side: 'YES', amount: '100000', minSharesOut: '95000'}
   ↓
3. Backend: Validate request (Zod schema)
   ↓
4. Backend: Start database transaction
   ↓
5. Backend: Lock user, pool, portfolio (optimistic locking)
   ↓
6. Backend: Calculate fees (FeeCalculator)
   ↓
7. Backend: Calculate swap (CPMMEngine)
   ↓
8. Backend: Validate slippage
   ↓
9. Backend: Update pool, user balance, portfolio
   ↓
10. Backend: Log to trade_ledger
   ↓
11. Backend: Commit transaction
   ↓
12. Backend: Broadcast price update via WebSocket
   ↓
13. Backend: Send trade confirmation to user via WebSocket
   ↓
14. Frontend: Update UI with new data
```

### 6.3 API Endpoints Summary

**Auth**:
- `POST /auth/register` - Create account
- `POST /auth/login` - Sign in
- `POST /auth/logout` - Sign out
- `GET /auth/me` - Get current user

**Markets**:
- `GET /markets` - List markets (with filters)
- `GET /markets/:id` - Get market details
- `GET /markets/:id/price-history` - Get price chart data

**Trading**:
- `POST /markets/:id/buy` - Buy YES/NO shares
- `POST /markets/:id/sell` - Sell shares
- `POST /markets/:id/mint` - Mint complete set
- `POST /markets/:id/merge` - Merge complete set

**Portfolio**:
- `GET /portfolio` - Get user positions
- `GET /portfolio/history` - Get trade history

**Admin**:
- `POST /admin/markets` - Create market
- `PATCH /admin/markets/:id` - Update market
- `POST /admin/markets/:id/activate` - Activate market
- `POST /admin/markets/:id/pause` - Pause market
- `POST /admin/markets/:id/resolve` - Resolve market
- `POST /admin/markets/:id/cancel` - Cancel market
- `POST /admin/users/:id/grant-points` - Grant points
- `GET /admin/stats` - Get platform stats
- `GET /admin/audit-logs` - Get audit logs

---

## 7. Real-Time Systems

### 7.1 WebSocket Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Fastify WebSocket Server                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Connection Manager                                   │   │
│  │  - Tracks all active connections                      │   │
│  │  - Maps users to connections                          │   │
│  │  - Handles subscriptions                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Redis Pub/Sub                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Channels:                                            │   │
│  │  - market:<id>  (price updates, state changes)       │   │
│  │  - user:<id>    (trade confirmations, balance)       │   │
│  │  - global       (new markets, announcements)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 WebSocket Message Types

**Server → Client**:
- `connected` - Connection established
- `subscribed` - Subscription confirmed
- `price_update` - Market price changed
- `market_state` - Market status changed
- `market_resolved` - Market resolved
- `trade` - Anonymous trade broadcast
- `trade_confirmed` - User's trade confirmed
- `balance_update` - User balance changed
- `points_granted` - Admin granted points
- `resolution_payout` - User received payout
- `error` - Error occurred
- `pong` - Heartbeat response

**Client → Server**:
- `subscribe` - Subscribe to channel
- `unsubscribe` - Unsubscribe from channel
- `ping` - Heartbeat

### 7.3 Redis Pub/Sub for Scaling

**Problem**: Multiple Fastify server instances need to share WebSocket state.

**Solution**: Redis Pub/Sub

```typescript
// Server 1: Trade executed
await redis.publish('market:mkt_123', JSON.stringify({
  type: 'price_update',
  data: { yesPrice: 0.55, noPrice: 0.45 }
}));

// Server 2: Receives message, broadcasts to connected clients
redis.subscribe('market:mkt_123');
redis.on('message', (channel, message) => {
  const data = JSON.parse(message);
  connectionManager.broadcast(channel, data);
});
```

---

## 8. Background Jobs & Automation

### 8.1 BullMQ Job Queue

**Architecture**:
```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  API Server      │     │  Redis (Queue)   │     │  Worker Process  │
│  (Job Producer)  │────\u003e│  - market-ops    │────\u003e│  (Job Consumer)  │
│                  │     │  - notifications │     │                  │
└──────────────────┘     │  - maintenance   │     └──────────────────┘
                         └──────────────────┘
```

**Queues**:
- `market-ops`: Market lifecycle automation
- `notifications`: User & admin notifications
- `maintenance`: System housekeeping

### 8.2 Market Scheduler Jobs

**Job: `market:check-expired`**
- **Schedule**: Every 1 minute
- **Purpose**: Auto-close markets based on `close_behavior`
- **Logic**:
  ```
  For each ACTIVE market where closes_at < NOW():
    IF close_behavior = 'auto':
      → Transition to PAUSED
    ELSE IF close_behavior = 'auto_with_buffer':
      IF closes_at + buffer_minutes < NOW():
        → Transition to PAUSED
    ELSE IF close_behavior = 'manual':
      → Skip (admin must close)
      → Queue reminder if > 1 hour past close time
  ```

**Job: `market:remind-manual-close`**
- **Schedule**: Triggered by `check-expired`
- **Purpose**: Notify admins of markets needing manual close
- **Logic**: Send notification if market is > 1 hour past `closes_at`

### 8.3 Adding New Jobs

```typescript
// 1. Define job type
export interface CalculateLeaderboardJob {
  type: 'analytics:calculate-leaderboard';
  data: { period: 'daily' | 'weekly' };
}

// 2. Register handler
export const analyticsHandlers = {
  'analytics:calculate-leaderboard': async (job) => {
    // Implementation
  },
};

// 3. Schedule job
await queueService.addRepeatable('analytics', {
  type: 'analytics:calculate-leaderboard',
  data: { period: 'daily' },
}, { pattern: '0 0 * * *' }); // Daily at midnight
```

---

## 9. Admin & Operational Features

### 9.1 Admin Dashboard

**Platform Stats**:
- Total users, active users (7 days)
- Total markets by status
- Trading volume (total, 24h)
- Platform health metrics

**Market Management**:
- Create/edit/activate/pause markets
- Extend close time
- Resolve markets (YES/NO)
- Cancel markets (refund all)
- View market stats (holders, volume, creator)

**User Management**:
- View all users
- Search by email, role
- View user stats (trades, volume, positions, points granted)
- Grant points to users

**Audit Logs**:
- View all admin actions
- Filter by action type, admin, market, user, date range
- Export audit logs
- Immutable audit trail

### 9.2 Point Grant System

**Grant Types**:
- `REGISTRATION_BONUS`: Automatic welcome bonus
- `ADMIN_GRANT`: Manual grant by admin
- `PROMOTION`: Promotional rewards
- `CORRECTION`: Balance corrections

**Audit Trail**:
- Every grant logged to `point_grants` table
- Tracks: amount, balance before/after, reason, granted by
- Immutable record for compliance

### 9.3 Market Close Behavior

**Problem**: Sports events have variable end times (added time, overtime).

**Solution**: Configurable `close_behavior`:

| Behavior | Use Case | Example |
|----------|----------|---------|
| `auto` | Exact-time events | "BTC > $100k at 5PM UTC?" |
| `manual` | Variable end times | Soccer (1-15+ min added time) |
| `auto_with_buffer` | Predictable overtime | Basketball (30 min OT buffer) |

**Admin UI**:
- Set `close_behavior` when creating market
- Set `buffer_minutes` for `auto_with_buffer`
- Override close behavior after creation

---

## 10. Security & Performance

### 10.1 Security Measures

**Authentication**:
- Supabase Auth with server-side validation
- HTTP-only cookies (not accessible to JS)
- Always use `getUser()` for validation (validates with Supabase server)
- Session refresh handled automatically

**Authorization**:
- Role-based access control (user, admin, treasury)
- Middleware enforces permissions
- Admin endpoints require `role = 'admin'`

**Rate Limiting**:
| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public (prices, markets) | 100 req | 1 minute |
| Authenticated (trades) | 30 req | 1 minute |
| Admin | 60 req | 1 minute |
| WebSocket messages | 10 msg | 1 second |

**Input Validation**:
- Zod schemas for all requests
- Type-safe validation with Fastify Type Providers
- Minimum trade size: 1,000 MicroPoints
- Slippage tolerance: 0-100%

**Idempotency**:
- All write operations support idempotency keys
- Prevents duplicate trades on retry
- Checked in `trade_ledger.idempotency_key`

### 10.2 Performance Optimizations

**Database**:
- Connection pooling (min 5, max 20)
- Indexes on frequently queried columns
- Optimistic locking for concurrent modifications
- Partitioning `trade_ledger` by month (for large deployments)

**Caching**:
| Data | Cache TTL | Invalidation |
|------|-----------|--------------|
| Market list | 5 seconds | On market state change |
| Spot prices | 1 second | On any trade |
| User portfolios | No cache | Always fresh (critical data) |
| Historical trades | 1 hour | Append-only data |

**Scalability Targets**:
| Metric | Target |
|--------|--------|
| Concurrent users | 10,000 |
| Trades per second | 100 |
| API latency (p50) | < 50ms |
| API latency (p99) | < 200ms |
| Price update latency | < 100ms |

### 10.3 Monitoring & Observability

**Metrics**:
- `trades_total` - Total trades executed
- `trade_volume_points` - Total points traded
- `active_markets` - Number of active markets
- `pool_k_value` - k-invariant per market
- `api_latency_seconds` - Request duration

**Alerts**:
| Alert | Condition | Severity |
|-------|-----------|----------|
| k-invariant decreased | k_new < k_old | Critical |
| High error rate | > 5% 5xx errors | High |
| API latency spike | p99 > 1s for 5 min | Medium |
| Low treasury balance | balance < $1000 | High |

**Logging**:
- Structured JSON logs
- Levels: ERROR, WARN, INFO, DEBUG
- Required fields: timestamp, level, service, traceId, message
- Never log sensitive data (passwords, tokens)

---

## 11. Development & Deployment

### 11.1 Development Setup

**Prerequisites**:
- Node.js 20+ LTS
- pnpm (recommended)
- Docker (for Supabase local)
- Redis

**Local Development**:
```bash
# Start Supabase local
supabase start

# Start Redis
docker run -d -p 6379:6379 redis:7

# Backend
cd backend
pnpm install
npx drizzle-kit generate  # Generate migrations
npx drizzle-kit migrate   # Apply migrations
pnpm dev                  # Start Fastify server

# Frontend
cd frontend
pnpm install
pnpm dev                  # Start Vite dev server

# Worker (separate terminal)
cd backend
pnpm worker              # Start BullMQ worker
```

**Environment Variables**:
```bash
# Supabase
SUPABASE_URL=http://127.0.0.1:55321
SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55326/postgres

# Redis
REDIS_URL=redis://localhost:6379

# Application
PORT=4000
NODE_ENV=development
```

### 11.2 Testing Strategy

**Backend**:
- **Unit Tests**: Domain logic, use cases (Vitest)
- **Integration Tests**: API endpoints, database operations
- **Coverage Target**: > 80%

**Frontend**:
- **Component Tests**: React components (Vitest + Testing Library)
- **E2E Tests**: Critical user flows (Playwright)

**Running Tests**:
```bash
# Backend
cd backend
pnpm test                 # Run all tests
pnpm test:coverage        # With coverage

# Frontend
cd frontend
pnpm test                 # Run all tests
pnpm test:e2e             # Run E2E tests
```

### 11.3 Deployment

**Backend**:
- Deploy Fastify server to any Node.js hosting (Fly.io, Railway, Render)
- Connect to Supabase production project
- Connect to Redis (Upstash, Redis Cloud)
- Run migrations: `npx drizzle-kit migrate`
- Start worker process separately

**Frontend**:
- Build: `pnpm build`
- Deploy static files to CDN (Vercel, Netlify, Cloudflare Pages)
- Set API proxy to production backend

**Database Migrations**:
```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations to production
npx drizzle-kit migrate
```

**Critical**: Always use Drizzle-kit for migrations, never Supabase CLI.

---

## Appendix: Related Documents

For deeper technical details, refer to:

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) - Complete system design
- [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) - Domain-driven code organization
- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - React SPA architecture
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Complete database schema
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - REST API documentation
- [ENGINE_LOGIC.md](./ENGINE_LOGIC.md) - CPMM math and implementation
- [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) - Real-time protocol
- [EDGE_CASES.md](./EDGE_CASES.md) - Edge case handling
- [ADR_001_MARKET_CLOSE_BEHAVIOR.md](./ADR_001_MARKET_CLOSE_BEHAVIOR.md) - Architecture decision record

---

**Document Status**: Complete  
**Last Updated**: December 2025  
**Maintained By**: Engineering Team
