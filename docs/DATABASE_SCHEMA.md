# Database Schema Specification

**Version:** 3.1  
**Platform:** Supabase (PostgreSQL 15+)  
**ORM:** Drizzle ORM  
**Auth:** Supabase Auth (server-side only via `@supabase/ssr`)  
**Last Updated:** December 2025

> **Important:** We use Supabase as our backend platform. The database is hosted on Supabase, and all access goes through our Fastify server using `@supabase/ssr`. We **never** use the Supabase browser client.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Schema Diagram](#2-schema-diagram)
3. [Table Definitions](#3-table-definitions)
4. [Drizzle ORM Schema](#4-drizzle-orm-schema)
5. [Indexes](#5-indexes)
6. [Constraints](#6-constraints)
7. [Migrations](#7-migrations)

---

## 1. Overview

### 1.1 Design Principles

- **BigInt for Money:** All monetary values stored as `BIGINT` in MicroPoints (1 USD = 1,000,000 MicroPoints)
- **Optimistic Locking:** `version_id` columns for concurrent modification detection
- **Soft Deletes:** No hard deletes; use status flags
- **Audit Trail:** All state changes logged to `trade_ledger`
- **UUID Primary Keys:** All tables use UUID v4 for primary keys

### 1.2 Unit Convention

| Unit | Value | Example |
|------|-------|---------|
| 1 Point | 1,000,000 MicroPoints | $1.00 = 1,000,000 |
| 1 Cent | 10,000 MicroPoints | $0.01 = 10,000 |
| 1 Mill | 1,000 MicroPoints | $0.001 = 1,000 |
| Minimum Trade | 1,000 MicroPoints | $0.001 |

---

## 2. Schema Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│       users         │       │      markets        │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │       │ id (PK)             │
│ email               │       │ title               │
│ password_hash       │       │ description         │
│ balance             │       │ status              │
│ role                │       │ resolution          │
│ created_at          │       │ resolved_at         │
│ updated_at          │       │ closes_at           │
└─────────┬───────────┘       │ created_at          │
          │                   │ updated_at          │
          │                   └─────────┬───────────┘
          │                             │
          │                             │
          │    ┌────────────────────────┘
          │    │
          ▼    ▼
┌─────────────────────────────────────────────────────┐
│                    portfolios                        │
├─────────────────────────────────────────────────────┤
│ user_id (PK, FK → users)                            │
│ market_id (PK, FK → markets)                        │
│ yes_qty                                             │
│ no_qty                                              │
│ yes_cost_basis                                      │
│ no_cost_basis                                       │
│ updated_at                                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────────┐
│  liquidity_pools    │       │     trade_ledger        │
├─────────────────────┤       ├─────────────────────────┤
│ id (PK, FK→markets) │       │ id (PK)                 │
│ yes_qty             │       │ user_id (FK → users)    │
│ no_qty              │       │ market_id (FK → markets)│
│ version_id          │       │ action                  │
│ updated_at          │       │ side                    │
└─────────────────────┘       │ amount_in               │
                              │ amount_out              │
                              │ shares_before           │
                              │ shares_after            │
                              │ fee_paid                │
                              │ fee_vault               │
                              │ fee_lp                  │
                              │ pool_yes_before         │
                              │ pool_no_before          │
                              │ pool_yes_after          │
                              │ pool_no_after           │
                              │ price_at_execution      │
                              │ idempotency_key         │
                              │ created_at              │
                              └─────────────────────────┘
```

---

## 3. Table Definitions

### 3.1 `users` Table

Stores user profile data and balances. Links to Supabase `auth.users` table.

> **Note:** Authentication is handled by Supabase Auth. This table extends user data with application-specific fields. The `id` column references `auth.users(id)`. User profile creation is handled in application code via Drizzle transactions (not SQL triggers).

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY,  -- Set from auth.users.id in application code
    email           VARCHAR(255) NOT NULL UNIQUE,
    balance         BIGINT NOT NULL DEFAULT 0,
    role            VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT users_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT users_role_valid CHECK (role IN ('user', 'admin', 'treasury'))
);

COMMENT ON TABLE users IS 'User profiles with balances in MicroPoints (extends auth.users)';
COMMENT ON COLUMN users.balance IS 'Balance in MicroPoints (1 USD = 1,000,000)';
```

**User Creation (Drizzle Transaction):**

User profile and welcome bonus are created in a single Drizzle transaction after Supabase Auth signup:

```typescript
// src/services/auth.service.ts
import { db } from '../db';
import { users, pointGrants } from '../db/schema';

const WELCOME_BONUS = 10_000_000n; // 10 Points in MicroPoints

export async function createUserProfile(
  authUserId: string,
  email: string,
  role: 'user' | 'admin' = 'user'
) {
  return await db.transaction(async (tx) => {
    // 1. Create user profile
    const [newUser] = await tx
      .insert(users)
      .values({
        id: authUserId,
        email,
        balance: WELCOME_BONUS,
        role,
      })
      .returning();

    // 2. Log the welcome bonus
    await tx.insert(pointGrants).values({
      userId: authUserId,
      amount: WELCOME_BONUS,
      balanceBefore: 0n,
      balanceAfter: WELCOME_BONUS,
      grantType: 'REGISTRATION_BONUS',
      reason: 'Welcome bonus',
    });

    return newUser;
  });
}
```

### 3.2 `markets` Table

Stores market metadata and lifecycle state.

```sql
CREATE TABLE markets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    resolution      VARCHAR(10),
    image_url       VARCHAR(2048),
    category        VARCHAR(100),
    closes_at       TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT markets_status_valid CHECK (
        status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'RESOLVED', 'CANCELLED')
    ),
    CONSTRAINT markets_resolution_valid CHECK (
        resolution IS NULL OR resolution IN ('YES', 'NO', 'CANCELLED')
    ),
    CONSTRAINT markets_resolution_requires_status CHECK (
        (status IN ('RESOLVED', 'CANCELLED') AND resolution IS NOT NULL) OR
        (status NOT IN ('RESOLVED', 'CANCELLED') AND resolution IS NULL)
    )
);

COMMENT ON TABLE markets IS 'Binary prediction markets';
COMMENT ON COLUMN markets.status IS 'Market lifecycle state';
COMMENT ON COLUMN markets.resolution IS 'Final outcome (YES, NO, or CANCELLED)';
```

### 3.3 `liquidity_pools` Table

Stores the AMM pool state for each market.

```sql
CREATE TABLE liquidity_pools (
    id              UUID PRIMARY KEY REFERENCES markets(id) ON DELETE CASCADE,
    yes_qty         BIGINT NOT NULL,
    no_qty          BIGINT NOT NULL,
    version_id      INTEGER NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT pools_yes_non_negative CHECK (yes_qty >= 0),
    CONSTRAINT pools_no_non_negative CHECK (no_qty >= 0),
    CONSTRAINT pools_version_positive CHECK (version_id > 0)
);

COMMENT ON TABLE liquidity_pools IS 'CPMM liquidity pool state';
COMMENT ON COLUMN liquidity_pools.yes_qty IS 'YES tokens in pool (MicroPoints scale)';
COMMENT ON COLUMN liquidity_pools.no_qty IS 'NO tokens in pool (MicroPoints scale)';
COMMENT ON COLUMN liquidity_pools.version_id IS 'Optimistic lock version counter';
```

### 3.4 `portfolios` Table

Stores user positions with cost basis tracking.

```sql
CREATE TABLE portfolios (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id       UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    yes_qty         BIGINT NOT NULL DEFAULT 0,
    no_qty          BIGINT NOT NULL DEFAULT 0,
    yes_cost_basis  BIGINT NOT NULL DEFAULT 0,
    no_cost_basis   BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, market_id),
    
    CONSTRAINT portfolios_yes_non_negative CHECK (yes_qty >= 0),
    CONSTRAINT portfolios_no_non_negative CHECK (no_qty >= 0),
    CONSTRAINT portfolios_yes_basis_non_negative CHECK (yes_cost_basis >= 0),
    CONSTRAINT portfolios_no_basis_non_negative CHECK (no_cost_basis >= 0)
);

COMMENT ON TABLE portfolios IS 'User holdings per market with cost basis';
COMMENT ON COLUMN portfolios.yes_cost_basis IS 'Total MicroPoints invested in current YES position';
COMMENT ON COLUMN portfolios.no_cost_basis IS 'Total MicroPoints invested in current NO position';
```

### 3.5 `trade_ledger` Table

Immutable audit log of all transactions.

```sql
CREATE TABLE trade_ledger (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    market_id           UUID NOT NULL REFERENCES markets(id),
    action              VARCHAR(20) NOT NULL,
    side                VARCHAR(3),
    amount_in           BIGINT NOT NULL,
    amount_out          BIGINT NOT NULL,
    shares_before       BIGINT,
    shares_after        BIGINT,
    fee_paid            BIGINT NOT NULL DEFAULT 0,
    fee_vault           BIGINT NOT NULL DEFAULT 0,
    fee_lp              BIGINT NOT NULL DEFAULT 0,
    pool_yes_before     BIGINT,
    pool_no_before      BIGINT,
    pool_yes_after      BIGINT,
    pool_no_after       BIGINT,
    price_at_execution  BIGINT,
    idempotency_key     VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ledger_action_valid CHECK (
        action IN (
            'BUY', 'SELL', 'MINT', 'MERGE', 
            'NET_SELL', 'GENESIS_MINT', 
            'RESOLUTION_PAYOUT', 'REFUND',
            'DEPOSIT', 'WITHDRAW'
        )
    ),
    CONSTRAINT ledger_side_valid CHECK (
        side IS NULL OR side IN ('YES', 'NO')
    ),
    CONSTRAINT ledger_amounts_non_negative CHECK (
        amount_in >= 0 AND amount_out >= 0 AND fee_paid >= 0
    )
);

COMMENT ON TABLE trade_ledger IS 'Immutable audit trail of all transactions';
COMMENT ON COLUMN trade_ledger.action IS 'Type of transaction';
COMMENT ON COLUMN trade_ledger.idempotency_key IS 'Client-provided key for safe retries';
```

### 3.6 `refresh_tokens` Table

Stores JWT refresh tokens for session management.

```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT refresh_tokens_not_expired CHECK (expires_at > created_at)
);

COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for authentication';
```

### 3.7 `point_grants` Table

Audit trail for all point grants (registration bonuses and admin grants).

```sql
CREATE TABLE point_grants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          BIGINT NOT NULL,
    balance_before  BIGINT NOT NULL,
    balance_after   BIGINT NOT NULL,
    grant_type      VARCHAR(30) NOT NULL,
    reason          VARCHAR(500),
    granted_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT point_grants_amount_positive CHECK (amount > 0),
    CONSTRAINT point_grants_type_valid CHECK (
        grant_type IN ('REGISTRATION_BONUS', 'ADMIN_GRANT', 'PROMOTION', 'CORRECTION')
    )
);

COMMENT ON TABLE point_grants IS 'Audit trail for all point grants to users';
COMMENT ON COLUMN point_grants.grant_type IS 'Type: REGISTRATION_BONUS, ADMIN_GRANT, PROMOTION, CORRECTION';
COMMENT ON COLUMN point_grants.granted_by IS 'Admin who granted (NULL for system grants like registration)';
```

> **Note:** This is a virtual points system. Points have no cash value and cannot be withdrawn.
> Users receive an initial balance upon registration (configurable via `REGISTRATION_BONUS_AMOUNT` env var).

---

## 4. Drizzle ORM Schema

### 4.1 Schema File (`src/db/schema.ts`)

```typescript
import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  bigint, 
  integer,
  boolean,
  timestamp,
  primaryKey,
  check
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ============================================================================
// ENUMS (as const for type safety)
// ============================================================================

export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  TREASURY: 'treasury',
} as const;

export const MarketStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
} as const;

export const Resolution = {
  YES: 'YES',
  NO: 'NO',
  CANCELLED: 'CANCELLED',
} as const;

export const TradeAction = {
  BUY: 'BUY',
  SELL: 'SELL',
  MINT: 'MINT',
  MERGE: 'MERGE',
  NET_SELL: 'NET_SELL',
  GENESIS_MINT: 'GENESIS_MINT',
  RESOLUTION_PAYOUT: 'RESOLUTION_PAYOUT',
  REFUND: 'REFUND',
  DEPOSIT: 'DEPOSIT',
  WITHDRAW: 'WITHDRAW',
} as const;

export const Side = {
  YES: 'YES',
  NO: 'NO',
} as const;

// ============================================================================
// TABLES
// ============================================================================

// Users table - extends Supabase auth.users
// Note: id references auth.users(id), authentication handled by Supabase Auth
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // References auth.users(id) - set by trigger
  email: varchar('email', { length: 255 }).notNull().unique(),
  balance: bigint('balance', { mode: 'bigint' }).notNull().default(0n),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const markets = pgTable('markets', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
  resolution: varchar('resolution', { length: 10 }),
  imageUrl: varchar('image_url', { length: 2048 }),
  category: varchar('category', { length: 100 }),
  closesAt: timestamp('closes_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const liquidityPools = pgTable('liquidity_pools', {
  id: uuid('id').primaryKey().references(() => markets.id, { onDelete: 'cascade' }),
  yesQty: bigint('yes_qty', { mode: 'bigint' }).notNull(),
  noQty: bigint('no_qty', { mode: 'bigint' }).notNull(),
  versionId: integer('version_id').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const portfolios = pgTable('portfolios', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketId: uuid('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  yesQty: bigint('yes_qty', { mode: 'bigint' }).notNull().default(0n),
  noQty: bigint('no_qty', { mode: 'bigint' }).notNull().default(0n),
  yesCostBasis: bigint('yes_cost_basis', { mode: 'bigint' }).notNull().default(0n),
  noCostBasis: bigint('no_cost_basis', { mode: 'bigint' }).notNull().default(0n),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.marketId] }),
}));

export const tradeLedger = pgTable('trade_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  marketId: uuid('market_id').notNull().references(() => markets.id),
  action: varchar('action', { length: 20 }).notNull(),
  side: varchar('side', { length: 3 }),
  amountIn: bigint('amount_in', { mode: 'bigint' }).notNull(),
  amountOut: bigint('amount_out', { mode: 'bigint' }).notNull(),
  sharesBefore: bigint('shares_before', { mode: 'bigint' }),
  sharesAfter: bigint('shares_after', { mode: 'bigint' }),
  feePaid: bigint('fee_paid', { mode: 'bigint' }).notNull().default(0n),
  feeVault: bigint('fee_vault', { mode: 'bigint' }).notNull().default(0n),
  feeLp: bigint('fee_lp', { mode: 'bigint' }).notNull().default(0n),
  poolYesBefore: bigint('pool_yes_before', { mode: 'bigint' }),
  poolNoBefore: bigint('pool_no_before', { mode: 'bigint' }),
  poolYesAfter: bigint('pool_yes_after', { mode: 'bigint' }),
  poolNoAfter: bigint('pool_no_after', { mode: 'bigint' }),
  priceAtExecution: bigint('price_at_execution', { mode: 'bigint' }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const PointGrantType = {
  REGISTRATION_BONUS: 'REGISTRATION_BONUS',
  ADMIN_GRANT: 'ADMIN_GRANT',
  PROMOTION: 'PROMOTION',
  CORRECTION: 'CORRECTION',
} as const;

export const pointGrants = pgTable('point_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  balanceBefore: bigint('balance_before', { mode: 'bigint' }).notNull(),
  balanceAfter: bigint('balance_after', { mode: 'bigint' }).notNull(),
  grantType: varchar('grant_type', { length: 30 }).notNull(),
  reason: varchar('reason', { length: 500 }),
  grantedBy: uuid('granted_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  portfolios: many(portfolios),
  trades: many(tradeLedger),
  createdMarkets: many(markets),
  refreshTokens: many(refreshTokens),
  pointGrants: many(pointGrants),
}));

export const marketsRelations = relations(markets, ({ one, many }) => ({
  creator: one(users, {
    fields: [markets.createdBy],
    references: [users.id],
  }),
  pool: one(liquidityPools, {
    fields: [markets.id],
    references: [liquidityPools.id],
  }),
  portfolios: many(portfolios),
  trades: many(tradeLedger),
}));

export const liquidityPoolsRelations = relations(liquidityPools, ({ one }) => ({
  market: one(markets, {
    fields: [liquidityPools.id],
    references: [markets.id],
  }),
}));

export const portfoliosRelations = relations(portfolios, ({ one }) => ({
  user: one(users, {
    fields: [portfolios.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [portfolios.marketId],
    references: [markets.id],
  }),
}));

export const tradeLedgerRelations = relations(tradeLedger, ({ one }) => ({
  user: one(users, {
    fields: [tradeLedger.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [tradeLedger.marketId],
    references: [markets.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const pointGrantsRelations = relations(pointGrants, ({ one }) => ({
  user: one(users, {
    fields: [pointGrants.userId],
    references: [users.id],
  }),
  grantedByUser: one(users, {
    fields: [pointGrants.grantedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES (Inferred from schema)
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;

export type LiquidityPool = typeof liquidityPools.$inferSelect;
export type NewLiquidityPool = typeof liquidityPools.$inferInsert;

export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;

export type TradeLedgerEntry = typeof tradeLedger.$inferSelect;
export type NewTradeLedgerEntry = typeof tradeLedger.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export type PointGrant = typeof pointGrants.$inferSelect;
export type NewPointGrant = typeof pointGrants.$inferInsert;
```

### 4.2 Supabase Client Setup (`src/lib/supabase/server.ts`)

> **Critical:** All Supabase access is server-side only. Never use the browser client.

```typescript
// src/lib/supabase/server.ts
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Creates a Supabase server client for Fastify
 * This handles cookie-based auth automatically
 */
export function createSupabaseClient(req: FastifyRequest, reply: FastifyReply) {
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

/**
 * Creates a Supabase admin client (for server-only operations)
 * Uses service role key - NEVER expose to client
 */
export function createSupabaseAdminClient() {
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role for admin operations
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}
```

### 4.3 Drizzle ORM Connection (`src/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use Supabase connection string
const connectionString = process.env.DATABASE_URL!;

// For query purposes (connection pooling via Supabase)
const client = postgres(connectionString, { 
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
```

### 4.4 Environment Variables

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server only!
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

---

## 5. Indexes

### 5.1 Index Definitions

```sql
-- Users: Email lookup for authentication
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;

-- Markets: Status filtering and sorting
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_status_closes ON markets(status, closes_at) 
    WHERE status = 'ACTIVE';
CREATE INDEX idx_markets_category ON markets(category) WHERE status = 'ACTIVE';
CREATE INDEX idx_markets_created_by ON markets(created_by);

-- Portfolios: User portfolio lookup
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_portfolios_market ON portfolios(market_id);
CREATE INDEX idx_portfolios_holdings ON portfolios(user_id, market_id) 
    WHERE yes_qty > 0 OR no_qty > 0;

-- Trade Ledger: Audit queries
CREATE INDEX idx_ledger_user ON trade_ledger(user_id, created_at DESC);
CREATE INDEX idx_ledger_market ON trade_ledger(market_id, created_at DESC);
CREATE INDEX idx_ledger_idempotency ON trade_ledger(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_ledger_action ON trade_ledger(action, created_at DESC);

-- Refresh Tokens: Token validation
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) 
    WHERE revoked_at IS NULL;
```

### 5.2 Index Strategy

| Query Pattern | Index | Notes |
|---------------|-------|-------|
| User login | `idx_users_email` | Unique, fast lookup |
| Active markets list | `idx_markets_status` | Filter by status |
| User portfolio | `idx_portfolios_user` | Get all user positions |
| Market leaderboard | `idx_portfolios_market` | Get all market holders |
| Trade history | `idx_ledger_user` | Paginated by date |
| Idempotency check | `idx_ledger_idempotency` | Prevent duplicate trades |

---

## 6. Constraints

### 6.1 Business Rule Constraints

| Constraint | Table | Rule |
|------------|-------|------|
| Non-negative balance | users | `balance >= 0` |
| Valid role | users | `role IN ('user', 'admin', 'treasury')` |
| Valid market status | markets | `status IN ('DRAFT', 'ACTIVE', ...)` |
| Resolution consistency | markets | Resolution required iff status is RESOLVED/CANCELLED |
| Non-negative pool | liquidity_pools | `yes_qty >= 0 AND no_qty >= 0` |
| Non-negative holdings | portfolios | All qty and basis columns >= 0 |
| Valid trade action | trade_ledger | `action IN ('BUY', 'SELL', ...)` |

### 6.2 Referential Integrity

All foreign keys use appropriate cascade rules:
- `ON DELETE CASCADE` for child records that should be removed with parent
- `ON DELETE RESTRICT` for references that should prevent parent deletion

---

## 7. Migrations

### 7.1 Initial Migration (`0001_initial_schema.sql`)

```sql
-- Migration: 0001_initial_schema
-- Description: Create all tables for Play-Prediction Engine
-- Created: 2025-12-09

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table (extends Supabase auth.users)
-- Note: Authentication is handled by Supabase Auth
-- User profile creation is handled via Drizzle transactions in application code
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- Set from auth.users.id in application code
    email VARCHAR(255) NOT NULL UNIQUE,
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    role VARCHAR(20) NOT NULL DEFAULT 'user' 
        CHECK (role IN ('user', 'admin', 'treasury')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create markets table
CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'RESOLVED', 'CANCELLED')),
    resolution VARCHAR(10)
        CHECK (resolution IS NULL OR resolution IN ('YES', 'NO', 'CANCELLED')),
    image_url VARCHAR(2048),
    category VARCHAR(100),
    closes_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT markets_resolution_requires_status CHECK (
        (status IN ('RESOLVED', 'CANCELLED') AND resolution IS NOT NULL) OR
        (status NOT IN ('RESOLVED', 'CANCELLED') AND resolution IS NULL)
    )
);

-- Create liquidity_pools table
CREATE TABLE liquidity_pools (
    id UUID PRIMARY KEY REFERENCES markets(id) ON DELETE CASCADE,
    yes_qty BIGINT NOT NULL CHECK (yes_qty >= 0),
    no_qty BIGINT NOT NULL CHECK (no_qty >= 0),
    version_id INTEGER NOT NULL DEFAULT 1 CHECK (version_id > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create portfolios table
CREATE TABLE portfolios (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    yes_qty BIGINT NOT NULL DEFAULT 0 CHECK (yes_qty >= 0),
    no_qty BIGINT NOT NULL DEFAULT 0 CHECK (no_qty >= 0),
    yes_cost_basis BIGINT NOT NULL DEFAULT 0 CHECK (yes_cost_basis >= 0),
    no_cost_basis BIGINT NOT NULL DEFAULT 0 CHECK (no_cost_basis >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, market_id)
);

-- Create trade_ledger table
CREATE TABLE trade_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    action VARCHAR(20) NOT NULL CHECK (
        action IN ('BUY', 'SELL', 'MINT', 'MERGE', 'NET_SELL', 
                   'GENESIS_MINT', 'RESOLUTION_PAYOUT', 'REFUND',
                   'DEPOSIT', 'WITHDRAW')
    ),
    side VARCHAR(3) CHECK (side IS NULL OR side IN ('YES', 'NO')),
    amount_in BIGINT NOT NULL CHECK (amount_in >= 0),
    amount_out BIGINT NOT NULL CHECK (amount_out >= 0),
    shares_before BIGINT,
    shares_after BIGINT,
    fee_paid BIGINT NOT NULL DEFAULT 0 CHECK (fee_paid >= 0),
    fee_vault BIGINT NOT NULL DEFAULT 0,
    fee_lp BIGINT NOT NULL DEFAULT 0,
    pool_yes_before BIGINT,
    pool_no_before BIGINT,
    pool_yes_after BIGINT,
    pool_no_after BIGINT,
    price_at_execution BIGINT,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create refresh_tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT refresh_tokens_not_expired CHECK (expires_at > created_at)
);

-- Create point_grants table (Virtual Points System audit trail)
CREATE TABLE point_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    grant_type VARCHAR(30) NOT NULL CHECK (
        grant_type IN ('REGISTRATION_BONUS', 'ADMIN_GRANT', 'PROMOTION', 'CORRECTION')
    ),
    reason VARCHAR(500),
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_status_closes ON markets(status, closes_at) WHERE status = 'ACTIVE';
CREATE INDEX idx_markets_category ON markets(category) WHERE status = 'ACTIVE';
CREATE INDEX idx_markets_created_by ON markets(created_by);
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_portfolios_market ON portfolios(market_id);
CREATE INDEX idx_portfolios_holdings ON portfolios(user_id, market_id) WHERE yes_qty > 0 OR no_qty > 0;
CREATE INDEX idx_ledger_user ON trade_ledger(user_id, created_at DESC);
CREATE INDEX idx_ledger_market ON trade_ledger(market_id, created_at DESC);
CREATE INDEX idx_ledger_idempotency ON trade_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_ledger_action ON trade_ledger(action, created_at DESC);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_point_grants_user ON point_grants(user_id, created_at DESC);
CREATE INDEX idx_point_grants_type ON point_grants(grant_type);

-- Note: User profile creation is handled in application code via Drizzle transactions
-- No SQL triggers needed - see auth.service.ts for createUserProfile()

-- Treasury user is created programmatically during deployment via application code:
-- 
-- 1. Create auth user via Supabase Admin API
-- 2. Create user profile via Drizzle transaction (with balance = 0)
-- 
-- See: src/scripts/setup-treasury.ts

COMMIT;
```

### 7.2 Drizzle Migration Config (`drizzle.config.ts`)

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'play_prediction',
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

---

## Related Documents

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — System architecture overview
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) — REST API endpoints
- [ENGINE_LOGIC.md](./ENGINE_LOGIC.md) — Trading engine implementation

---

*Document Version: 3.1 | Schema Version: 1*

