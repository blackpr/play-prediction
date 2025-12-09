# Play Prediction - User Stories & Implementation Tasks

**Version:** 1.0  
**Last Updated:** December 2025

This document contains detailed user stories organized by Epic. Each story references the relevant specification documents and includes acceptance criteria.

---

## Epic 0: Project Setup

**Goal:** Foundation for both backend and frontend projects.

### SETUP-1: Initialize Backend Project

**As a** developer  
**I want** a properly configured backend project  
**So that** I can build the API with TypeScript, Fastify, and Drizzle ORM

**Acceptance Criteria:**
- [ ] Create `backend/` directory with package.json
- [ ] Configure TypeScript with strict mode (tsconfig.json)
- [ ] Install dependencies:
  - fastify ^4.28.1
  - @fastify/cookie, @fastify/cors, @fastify/websocket
  - drizzle-orm, postgres
  - @supabase/ssr, @supabase/supabase-js
  - zod for validation
  - tsx for development
  - vitest for testing
- [ ] Set up folder structure per BACKEND_ARCHITECTURE.md:
  ```
  src/
  ├── domain/           # Pure business logic
  ├── application/      # Use cases & ports
  ├── infrastructure/   # Database, auth implementations
  ├── presentation/     # Fastify routes
  └── shared/           # Config, logger, utils
  ```
- [ ] Create drizzle.config.ts

**References:** BACKEND_ARCHITECTURE.md Section 2

---

### SETUP-2: Configure Supabase Project

**As a** developer  
**I want** Supabase configured for authentication and database  
**So that** I can use managed PostgreSQL and auth services

**Acceptance Criteria:**
- [ ] Document required Supabase project settings
- [ ] Create .env.example with all required variables:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - DATABASE_URL
- [ ] Configure connection pooling settings
- [ ] Set up environment variable validation with Zod

**References:** SYSTEM_DESIGN.md Section 2.2, DATABASE_SCHEMA.md Section 4.2-4.4

---

### SETUP-3: Create Database Schema & Migrations

**As a** developer  
**I want** complete database schema with Drizzle ORM  
**So that** all tables are properly defined with constraints

**Acceptance Criteria:**
- [ ] Create Drizzle schema file with all tables:
  - `users` - User profiles with balance (extends Supabase auth.users)
  - `markets` - Binary prediction markets
  - `liquidity_pools` - CPMM pool state per market
  - `portfolios` - User positions with cost basis
  - `trade_ledger` - Immutable audit trail
  - `refresh_tokens` - JWT refresh tokens
  - `point_grants` - Audit trail for point grants
- [ ] Define all constraints:
  - Non-negative balance/shares checks
  - Valid status/role enums
  - Resolution consistency constraints
- [ ] Create all indexes per DATABASE_SCHEMA.md Section 5
- [ ] Define Drizzle relations
- [ ] Export inferred TypeScript types
- [ ] Create initial migration SQL

**Tables Detail (from DATABASE_SCHEMA.md):**

```typescript
// users table
- id: UUID (references auth.users)
- email: VARCHAR(255) UNIQUE
- balance: BIGINT (MicroPoints, >= 0)
- role: VARCHAR(20) - 'user' | 'admin' | 'treasury'
- is_active: BOOLEAN
- created_at, updated_at: TIMESTAMPTZ

// markets table
- id: UUID PRIMARY KEY
- title: VARCHAR(500)
- description: TEXT
- status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'RESOLVED' | 'CANCELLED'
- resolution: 'YES' | 'NO' | 'CANCELLED' | NULL
- image_url, category, closes_at, resolved_at
- created_by: UUID FK -> users

// liquidity_pools table
- id: UUID PK FK -> markets (1:1)
- yes_qty: BIGINT (>= 0)
- no_qty: BIGINT (>= 0)
- version_id: INTEGER (optimistic locking)

// portfolios table
- user_id, market_id: COMPOSITE PK
- yes_qty, no_qty: BIGINT
- yes_cost_basis, no_cost_basis: BIGINT

// trade_ledger table
- id: UUID PK
- user_id, market_id: FK
- action: 'BUY' | 'SELL' | 'MINT' | 'MERGE' | 'NET_SELL' | etc.
- side: 'YES' | 'NO' | NULL
- amount_in, amount_out: BIGINT
- shares_before, shares_after: BIGINT
- fee_paid, fee_vault, fee_lp: BIGINT
- pool_yes_before, pool_no_before, pool_yes_after, pool_no_after
- price_at_execution: BIGINT
- idempotency_key: VARCHAR(255)

// point_grants table
- id: UUID PK
- user_id: FK
- amount: BIGINT (> 0)
- balance_before, balance_after: BIGINT
- grant_type: 'REGISTRATION_BONUS' | 'ADMIN_GRANT' | 'PROMOTION' | 'CORRECTION'
- reason: VARCHAR(500)
- granted_by: UUID FK -> users (NULL for system)
```

**References:** DATABASE_SCHEMA.md Sections 3-4, 7

---

### SETUP-4: Initialize Frontend with TanStack Start

**As a** developer  
**I want** a TanStack Start SPA project configured  
**So that** I can build the React frontend

**Acceptance Criteria:**
- [ ] Create `frontend/` directory
- [ ] Initialize TanStack Start project in SPA mode
- [ ] Install dependencies:
  - @tanstack/react-start, @tanstack/react-router
  - @tanstack/react-query ^5.60.0
  - @tanstack/react-form
  - react ^19.0.0, react-dom ^19.0.0
  - recharts, lucide-react
  - zod ^4.0.0
  - clsx, tailwind-merge
- [ ] Configure Vite with SPA mode and API proxy
- [ ] Set up file-based routing structure:
  ```
  src/routes/
  ├── __root.tsx
  ├── index.tsx
  ├── login.tsx
  ├── register.tsx
  ├── markets/
  │   ├── index.tsx
  │   └── $marketId.tsx
  ├── portfolio/
  │   └── index.tsx
  └── admin/
      ├── index.tsx
      └── markets.tsx
  ```
- [ ] Create router.tsx with QueryClient
- [ ] Configure tsr.config.json

**References:** FRONTEND_ARCHITECTURE.md Sections 2-5

---

### SETUP-5: Configure Tailwind CSS & Base UI Components

**As a** developer  
**I want** Tailwind CSS v4 and base UI components  
**So that** I have a consistent design system

**Acceptance Criteria:**
- [ ] Install and configure Tailwind CSS v4
- [ ] Define color palette (dark theme):
  - Background: #0a0a0f, #12121a, #1a1a24, #22222e
  - Text: #f0f0f5, #a0a0b0, #606070
  - Accent: #3b82f6 (blue), #8b5cf6 (purple)
  - YES color: #22c55e (green)
  - NO color: #ef4444 (red)
- [ ] Create base UI components:
  - Button (primary, secondary, ghost, danger, yes, no variants)
  - Input (with label, error, hint)
  - Card (default, elevated, outlined)
  - Modal (with Dialog)
  - Spinner
- [ ] Create utility functions:
  - `cn()` for class merging
  - `formatPoints()` - MicroPoints to human readable
  - `formatCompactPoints()` - compact notation
  - `parsePoints()` - string to MicroPoints

**References:** FRONTEND_COMPONENTS.md Sections 1-2, 8

---

### SETUP-6: Development Environment Setup

**As a** developer  
**I want** a complete development environment  
**So that** I can run both backend and frontend locally

**Acceptance Criteria:**
- [ ] Create root package.json with workspace scripts
- [ ] Configure backend dev server on port 4000
- [ ] Configure frontend dev server on port 3000
- [ ] Set up Vite proxy for /api -> localhost:4000
- [ ] Set up Vite proxy for /ws -> ws://localhost:4000
- [ ] Create README.md with setup instructions
- [ ] Document required environment variables

**References:** FRONTEND_ARCHITECTURE.md Section 8

---

## Epic 1: Authentication

**Goal:** Full auth flow - user can register, login, logout.

### AUTH-1: Create Supabase SSR Auth Middleware

**As a** backend developer  
**I want** auth middleware that validates Supabase sessions  
**So that** routes can be protected

**Acceptance Criteria:**
- [ ] Create `createSupabaseClient(req, reply)` function using @supabase/ssr
- [ ] Parse cookies from request headers
- [ ] Set cookies on response headers
- [ ] Always use `supabase.auth.getUser()` for validation (NEVER `getSession()`)
- [ ] Create `authMiddleware` - populates `request.user` if authenticated
- [ ] Create `requireAuth` - returns 401 if not authenticated
- [ ] Create `requireAdmin` - returns 403 if not admin role
- [ ] Attach user to request: `{ id, email, role }`

**Implementation Notes:**
```typescript
// CORRECT - validates JWT with Supabase server
const { data: { user }, error } = await supabase.auth.getUser();

// WRONG - doesn't validate signature
const { data: { session } } = await supabase.auth.getSession();
```

**References:** API_SPECIFICATION.md Section 2.5, EDGE_CASES.md Section 5.0

---

### AUTH-2: Implement Registration Endpoint

**As a** new user  
**I want** to register with email and password  
**So that** I can start trading

**Endpoint:** `POST /v1/auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Acceptance Criteria:**
- [ ] Validate email format and password strength
- [ ] Create Supabase Auth user via `supabase.auth.signUp()`
- [ ] Create user profile in `users` table (Drizzle transaction)
- [ ] Grant welcome bonus (REGISTRATION_BONUS_AMOUNT from config)
- [ ] Log bonus to `point_grants` table
- [ ] Return user data (without password)
- [ ] Handle EMAIL_ALREADY_EXISTS error (409)
- [ ] Handle INVALID_EMAIL, WEAK_PASSWORD errors (400)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "balance": "10000000",
      "createdAt": "2024-12-09T10:30:00Z"
    },
    "message": "Please check your email to confirm your account"
  }
}
```

**References:** API_SPECIFICATION.md Section 4.1, DATABASE_SCHEMA.md Section 3.1

---

### AUTH-3: Implement Login and Logout Endpoints

**As a** registered user  
**I want** to login and logout  
**So that** I can access my account

**Endpoints:**
- `POST /v1/auth/login`
- `POST /v1/auth/logout`

**Login Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Acceptance Criteria:**
- [ ] Login: Call `supabase.auth.signInWithPassword()`
- [ ] Session cookie set automatically via @supabase/ssr
- [ ] Return user profile from `users` table
- [ ] Handle INVALID_CREDENTIALS (401)
- [ ] Handle EMAIL_NOT_CONFIRMED (401)
- [ ] Handle ACCOUNT_DISABLED (403)
- [ ] Logout: Call `supabase.auth.signOut()`
- [ ] Clear session cookies

**References:** API_SPECIFICATION.md Sections 4.1.2, 4.1.3

---

### AUTH-4: Implement Get Current User Endpoint

**As an** authenticated user  
**I want** to get my profile  
**So that** I can see my balance and info

**Endpoint:** `GET /v1/auth/me`

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Return user from `users` table
- [ ] Include balance in MicroPoints (as string)
- [ ] Return 401 if not authenticated

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "balance": "5000000",
    "isActive": true,
    "createdAt": "2024-12-09T10:30:00Z"
  }
}
```

**References:** API_SPECIFICATION.md Section 4.2.1

---

### AUTH-5: Create Frontend Login Page

**As a** user  
**I want** a login form  
**So that** I can sign into my account

**Route:** `/login`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/login.tsx`
- [ ] Use TanStack Form for form state
- [ ] Email input with validation
- [ ] Password input
- [ ] Show error messages from API
- [ ] Redirect to ?redirect param or /markets on success
- [ ] Link to registration page
- [ ] Style with dark theme

**References:** FRONTEND_ARCHITECTURE.md Section 6.2

---

### AUTH-6: Create Frontend Registration Page

**As a** new user  
**I want** a registration form  
**So that** I can create an account

**Route:** `/register`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/register.tsx`
- [ ] Email input with validation
- [ ] Password input with strength requirements
- [ ] Confirm password field
- [ ] Show error messages from API
- [ ] Show success message about email confirmation
- [ ] Link to login page

---

### AUTH-7: Implement useAuth Hook

**As a** frontend developer  
**I want** auth state management  
**So that** components can access user info

**Acceptance Criteria:**
- [ ] Create `src/hooks/useAuth.ts`
- [ ] Create `authQueryOptions` for TanStack Query
- [ ] `useAuth()` returns `{ user, isAuthenticated, isLoading }`
- [ ] `useLogin()` mutation with cache update
- [ ] `useLogout()` mutation that clears all queries
- [ ] `useRegister()` mutation

**References:** FRONTEND_ARCHITECTURE.md Section 6.1, FRONTEND_STATE.md Section 3

---

### AUTH-8: Add Protected Route Middleware

**As a** frontend developer  
**I want** route protection  
**So that** certain pages require authentication

**Acceptance Criteria:**
- [ ] Use TanStack Router's `beforeLoad` for auth check
- [ ] Redirect to /login if not authenticated
- [ ] Pass redirect URL in search params
- [ ] Create reusable auth check pattern

**Example:**
```typescript
export const Route = createFileRoute('/portfolio/')({
  beforeLoad: async ({ context }) => {
    const auth = await getAuthStatus()
    if (!auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: '/portfolio' },
      })
    }
  },
})
```

**References:** FRONTEND_ARCHITECTURE.md Section 5.2

---

## Epic 2: User Profile & Balance

**Goal:** User can see their profile and point balance.

### USER-1: Implement Users/Me Endpoint

**As an** authenticated user  
**I want** my profile with balance  
**So that** I know how many points I have

**Endpoint:** `GET /v1/users/me`

**Acceptance Criteria:**
- [ ] Return same data as AUTH-4
- [ ] Include formatted balance info

**References:** API_SPECIFICATION.md Section 4.2.1

---

### USER-2: Create Header Component with Balance

**As a** user  
**I want** to see my balance in the header  
**So that** I always know my points

**Acceptance Criteria:**
- [ ] Create `src/components/layout/Header.tsx`
- [ ] Show logo and navigation links
- [ ] Markets link, Portfolio link (if authenticated)
- [ ] Balance display with wallet icon
- [ ] Format balance using `formatPoints()`
- [ ] Sign In / Get Started buttons if not authenticated
- [ ] Sign Out button if authenticated
- [ ] Loading skeleton while auth loading

**References:** FRONTEND_COMPONENTS.md Section 3.1

---

### USER-3: Format MicroPoints Utility

**As a** frontend developer  
**I want** formatting utilities  
**So that** MicroPoints display correctly

**Acceptance Criteria:**
- [ ] Create `src/lib/format.ts`
- [ ] `formatPoints(microPoints)` - "1,000.00" format
- [ ] `formatCompactPoints(microPoints)` - "10K", "1.5M" format
- [ ] `parsePoints(string)` - convert to MicroPoints string
- [ ] Handle BigInt serialization (strings in JSON)
- [ ] Scale: 1 Point = 1,000,000 MicroPoints

**References:** FRONTEND_COMPONENTS.md Section 8.1

---

### USER-4: Implement Points History Endpoint

**As an** authenticated user  
**I want** to see my points history  
**So that** I can track grants and bonuses

**Endpoint:** `GET /v1/users/me/points-history`

**Query Params:**
- `page` (default: 1)
- `pageSize` (default: 20)

**Acceptance Criteria:**
- [ ] Query `point_grants` table for user
- [ ] Return paginated results
- [ ] Include grant type, amount, balance after, reason, granted by, date

**References:** API_SPECIFICATION.md Section 4.2.2

---

### USER-5: Create Points History View

**As a** user  
**I want** to view my points history  
**So that** I can see bonuses and grants

**Acceptance Criteria:**
- [ ] Create points history component/page
- [ ] Display list of grants
- [ ] Show type badge (Registration, Admin Grant, etc.)
- [ ] Show amount and running balance
- [ ] Pagination

---

## Epic 3: Markets Listing

**Goal:** View all available markets with filtering/sorting.

### MARKET-1: Implement GET /markets Endpoint

**As a** user  
**I want** to list all markets  
**So that** I can find markets to trade

**Endpoint:** `GET /v1/markets`

**Query Params:**
- `status` (default: ACTIVE) - ACTIVE, RESOLVED, CANCELLED, all
- `category` - filter by category
- `page` (default: 1)
- `pageSize` (default: 20, max: 100)
- `sort` (default: createdAt) - createdAt, closesAt, volume
- `order` (default: desc) - asc, desc

**Acceptance Criteria:**
- [ ] Public endpoint (no auth required)
- [ ] Query markets table with filters
- [ ] Join with liquidity_pools for price data
- [ ] Calculate yesPrice, noPrice from pool quantities
- [ ] Calculate 24h volume from trade_ledger
- [ ] Return paginated response
- [ ] Cache results (5 second TTL)

**Response includes per market:**
```json
{
  "id": "mkt_abc123",
  "title": "Will BTC exceed $100k?",
  "description": "...",
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
```

**References:** API_SPECIFICATION.md Section 4.3.1

---

### MARKET-2: Calculate Pool Prices

**As a** backend developer  
**I want** correct price calculations  
**So that** prices always sum to 1.0

**Acceptance Criteria:**
- [ ] Implement price calculation: `P_YES = noQty / (yesQty + noQty)`
- [ ] Implement price calculation: `P_NO = yesQty / (yesQty + noQty)`
- [ ] Verify `P_YES + P_NO = 1.0` always holds
- [ ] Return prices as decimal strings (6 decimal places)
- [ ] Handle edge case: empty pool returns 0.50/0.50

**References:** SYSTEM_DESIGN.md Section 1.4, ENGINE_LOGIC.md Section 2.2

---

### MARKET-3: Create Markets List Page

**As a** user  
**I want** a markets listing page  
**So that** I can browse available markets

**Route:** `/markets`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/markets/index.tsx`
- [ ] Use type-safe search params with Zod
- [ ] Use `useMarkets()` hook with TanStack Query
- [ ] Display grid of MarketCard components
- [ ] Loading state with skeletons
- [ ] Empty state message
- [ ] Pagination controls

**References:** FRONTEND_ARCHITECTURE.md Section 5.4

---

### MARKET-4: Create MarketCard Component

**As a** user  
**I want** market cards  
**So that** I can see market info at a glance

**Acceptance Criteria:**
- [ ] Create `src/components/market/MarketCard.tsx`
- [ ] Status badge (colored by status)
- [ ] Time until close (using date-fns)
- [ ] Market title (2 line clamp)
- [ ] Probability bar showing YES/NO %
- [ ] Volume stat
- [ ] YES/NO percentages
- [ ] Link to market detail

**References:** FRONTEND_COMPONENTS.md Section 4.1

---

### MARKET-5: Add Status Filter Tabs

**As a** user  
**I want** to filter markets by status  
**So that** I can find active or resolved markets

**Acceptance Criteria:**
- [ ] Tab buttons: All, Active, Resolved
- [ ] Update URL search params on change
- [ ] Highlight active tab
- [ ] Reset to page 1 on filter change

---

### MARKET-6: Add Sorting Options

**As a** user  
**I want** to sort markets  
**So that** I can find relevant ones

**Acceptance Criteria:**
- [ ] Sort dropdown: Newest, Most Volume, Ending Soon
- [ ] Update URL search params on change
- [ ] Reset to page 1 on sort change

---

## Epic 4: Market Detail

**Goal:** Single market view with all details and price chart.

### DETAIL-1: Implement GET /markets/:id

**As a** user  
**I want** full market details  
**So that** I can make informed trades

**Endpoint:** `GET /v1/markets/:id`

**Acceptance Criteria:**
- [ ] Public endpoint
- [ ] Return full market data
- [ ] Join liquidity_pool data
- [ ] Calculate prices
- [ ] Include k-invariant value
- [ ] Include stats: totalVolume, volume24h, tradeCount, uniqueTraders
- [ ] Return 404 if market not found

**References:** API_SPECIFICATION.md Section 4.3.2

---

### DETAIL-2: Implement Price History Endpoint

**As a** user  
**I want** historical price data  
**So that** I can see price trends

**Endpoint:** `GET /v1/markets/:id/price-history`

**Query Params:**
- `interval` (default: 1h) - 1m, 5m, 1h, 1d
- `from` (default: 24h ago)
- `to` (default: now)

**Acceptance Criteria:**
- [ ] Aggregate trade_ledger data by interval
- [ ] Return OHLC candles for YES price
- [ ] Include volume per candle
- [ ] Limit to reasonable date range

**References:** API_SPECIFICATION.md Section 4.3.3

---

### DETAIL-3: Create Market Detail Page

**As a** user  
**I want** a market detail page  
**So that** I can view and trade a market

**Route:** `/markets/$marketId`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/markets/$marketId.tsx`
- [ ] Load market data with loader
- [ ] Show market title, description
- [ ] Show status badge and close time
- [ ] Show ProbabilityBar
- [ ] Show PriceChart
- [ ] Show TradeForm (from Epic 6)
- [ ] Show market stats

**References:** FRONTEND_ARCHITECTURE.md Section 5.3

---

### DETAIL-4: Create ProbabilityBar Component

**As a** user  
**I want** a visual probability bar  
**So that** I can quickly see YES/NO odds

**Acceptance Criteria:**
- [ ] Create `src/components/market/ProbabilityBar.tsx`
- [ ] Green portion for YES percentage
- [ ] Red portion for NO percentage
- [ ] Optional labels showing percentages
- [ ] Size variants: sm, md, lg
- [ ] Smooth transitions on updates

**References:** FRONTEND_COMPONENTS.md Section 4.2

---

### DETAIL-5: Create PriceChart Component

**As a** user  
**I want** a price chart  
**So that** I can see historical prices

**Acceptance Criteria:**
- [ ] Create `src/components/market/PriceChart.tsx`
- [ ] Use Recharts LineChart
- [ ] Two lines: YES price (green), NO price (red)
- [ ] X-axis: timestamps
- [ ] Y-axis: 0-100% scale
- [ ] Tooltip with date and prices
- [ ] Responsive container

**References:** FRONTEND_COMPONENTS.md Section 4.3

---

### DETAIL-6: Show Market Metadata

**As a** user  
**I want** to see market metadata  
**So that** I understand the market context

**Acceptance Criteria:**
- [ ] Display close time with countdown
- [ ] Display total volume
- [ ] Display unique traders count
- [ ] Display trade count
- [ ] Display resolution criteria from description
- [ ] Display category badge

---

## Epic 5: Trading Engine (Core)

**Goal:** The CPMM swap logic - buy and sell shares.

### TRADE-1: Implement CPMM Engine (Domain Layer)

**As a** backend developer  
**I want** pure CPMM math functions  
**So that** trading logic is testable and framework-agnostic

**Acceptance Criteria:**
- [ ] Create `src/domain/services/cpmm-engine.ts`
- [ ] All calculations use BigInt (no floating point)
- [ ] `calculateBuyShares(pool, side, pointsIn)` - returns shares out
- [ ] `calculateSellPoints(pool, side, sharesIn)` - returns points out
- [ ] `getPrices(pool)` - returns { yes, no } prices
- [ ] `validatePool(pool)` - validates pool state
- [ ] Floor rounding on user outputs
- [ ] Ceiling division for pool calculations
- [ ] Verify k never decreases after operation
- [ ] Throw `InvariantViolatedError` if k decreases

**CPMM Formulas:**
```
k = YES_qty × NO_qty (constant)

Buying YES with Δy points:
- New y' = y + Δy
- New x' = k / y' (ceiling division)
- Shares received = x - x'

Selling Δx YES shares:
- New x' = x + Δx
- New y' = k / x' (ceiling division)
- Points received = y - y'
```

**References:** ENGINE_LOGIC.md Sections 2, 5

---

### TRADE-2: Implement Fee Calculator

**As a** backend developer  
**I want** correct fee calculations  
**So that** fees are properly deducted

**Acceptance Criteria:**
- [ ] Create `src/domain/services/fee-calculator.ts`
- [ ] Fee rate: 2.0% (200 basis points)
- [ ] Fee split: 50% vault, 50% LP injection
- [ ] `calculateFee(amount)` - ceiling rounding
- [ ] `splitFee(totalFee)` - returns { vaultFee, lpFee }
- [ ] `calculateNetAfterFee(grossAmount)` - for buying (fee from input)
- [ ] `calculateNetPayout(grossPayout)` - for selling (fee from output)
- [ ] No fee on mint, merge, or netting exit

**Fee Application:**
| Operation | Fee Timing |
|-----------|------------|
| Buy | Deduct from input BEFORE swap |
| Sell | Deduct from output AFTER swap |
| Mint | No fee |
| Merge | No fee |

**References:** ENGINE_LOGIC.md Section 4, SYSTEM_DESIGN.md Section 3.2

---

### TRADE-3: Implement POST /markets/:id/buy

**As a** user  
**I want** to buy shares  
**So that** I can bet on outcomes

**Endpoint:** `POST /v1/markets/:id/buy`

**Request:**
```json
{
  "side": "YES",
  "amount": "100000",
  "minSharesOut": "95000",
  "idempotencyKey": "buy_abc123_1702123456"
}
```

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Validate minimum trade size (1000 MicroPoints)
- [ ] Check market is ACTIVE
- [ ] Check market not past closesAt
- [ ] Check user has sufficient balance
- [ ] Check idempotency key not already used
- [ ] Apply fees to input
- [ ] Calculate shares via CPMM
- [ ] Check slippage (shares >= minSharesOut)
- [ ] Inject LP fee into pool
- [ ] Update pool with optimistic lock
- [ ] Deduct user balance
- [ ] Update/create portfolio
- [ ] Log to trade_ledger
- [ ] Return transaction details

**Errors:**
- INSUFFICIENT_BALANCE (400)
- SLIPPAGE_EXCEEDED (400)
- MARKET_NOT_ACTIVE (400)
- MINIMUM_TRADE_SIZE (400)
- IDEMPOTENCY_CONFLICT (409)
- OPTIMISTIC_LOCK_FAIL (409) - retry

**References:** API_SPECIFICATION.md Section 4.4.1, ENGINE_LOGIC.md Section 6.1

---

### TRADE-4: Implement POST /markets/:id/sell

**As a** user  
**I want** to sell shares  
**So that** I can exit positions

**Endpoint:** `POST /v1/markets/:id/sell`

**Request:**
```json
{
  "side": "YES",
  "shares": "50000",
  "minAmountOut": "48000",
  "idempotencyKey": "sell_abc123_1702123456"
}
```

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Check market is ACTIVE
- [ ] Check user has sufficient shares
- [ ] Calculate points via CPMM
- [ ] Apply fees to output
- [ ] Check slippage (points >= minAmountOut)
- [ ] Inject LP fee into pool
- [ ] Update pool with optimistic lock
- [ ] Credit user balance
- [ ] Reduce portfolio (proportional cost basis)
- [ ] Log to trade_ledger
- [ ] Return transaction details

**References:** API_SPECIFICATION.md Section 4.4.2, ENGINE_LOGIC.md Section 6.2

---

### TRADE-5: Implement GET /markets/:id/quote

**As a** user  
**I want** price quotes  
**So that** I can preview trades without executing

**Endpoint:** `GET /v1/markets/:id/quote`

**Query Params:**
- `side`: YES or NO
- `action`: BUY or SELL
- `amount`: MicroPoints (buy) or shares (sell)

**Acceptance Criteria:**
- [ ] Public endpoint
- [ ] Calculate estimated output
- [ ] Calculate fee
- [ ] Calculate price impact
- [ ] Calculate average execution price
- [ ] Calculate recommended minimum (5% slippage)
- [ ] Include quote expiry time (30 seconds)

**Response:**
```json
{
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
```

**References:** API_SPECIFICATION.md Section 4.4.5

---

### TRADE-6: Add Optimistic Locking

**As a** backend developer  
**I want** optimistic locking on pool updates  
**So that** concurrent trades don't corrupt state

**Acceptance Criteria:**
- [ ] Add version_id check in UPDATE WHERE clause
- [ ] Increment version_id on successful update
- [ ] Return OPTIMISTIC_LOCK_FAIL if no rows updated
- [ ] Client should retry on this error

**Implementation:**
```sql
UPDATE liquidity_pools
SET yes_qty = ?, no_qty = ?, version_id = version_id + 1
WHERE id = ? AND version_id = ?
-- rowCount === 0 means concurrent modification
```

**References:** EDGE_CASES.md Section 4.1

---

### TRADE-7: Add Idempotency Key Support

**As a** backend developer  
**I want** idempotency keys  
**So that** duplicate requests are safe

**Acceptance Criteria:**
- [ ] Accept optional `idempotencyKey` in trade requests
- [ ] Check trade_ledger for existing key before processing
- [ ] Return IDEMPOTENCY_CONFLICT if already used
- [ ] Store key in trade_ledger entry

**References:** EDGE_CASES.md Section 4.2

---

## Epic 6: Trading UI

**Goal:** User can buy/sell shares from the market detail page.

### TRADEUI-1: Create TradeForm Component

**As a** user  
**I want** a trade form  
**So that** I can buy and sell shares

**Acceptance Criteria:**
- [ ] Create `src/components/market/TradeForm.tsx`
- [ ] Buy/Sell tab toggle
- [ ] Render inside Card component
- [ ] Use TanStack Form for state
- [ ] Disabled when market not ACTIVE

**References:** FRONTEND_COMPONENTS.md Section 5.1

---

### TRADEUI-2: Add YES/NO Side Toggle

**As a** user  
**I want** to choose YES or NO  
**So that** I can bet on either outcome

**Acceptance Criteria:**
- [ ] Two large buttons: YES (green), NO (red)
- [ ] Show current price on each button
- [ ] Highlight selected side
- [ ] Update estimated output when changed

---

### TRADEUI-3: Implement Amount Input

**As a** user  
**I want** to enter trade amounts  
**So that** I can control my bet size

**Acceptance Criteria:**
- [ ] Input field for amount
- [ ] Switch between Points (buy) and Shares (sell)
- [ ] MAX button to fill available balance/shares
- [ ] Validate positive numbers
- [ ] Validate sufficient balance/shares
- [ ] Format with thousand separators

---

### TRADEUI-4: Show Estimated Output

**As a** user  
**I want** to see trade estimates  
**So that** I know what I'll receive

**Acceptance Criteria:**
- [ ] Call quote endpoint on amount change (debounced)
- [ ] Show estimated shares out (buy) or points out (sell)
- [ ] Show average price
- [ ] Show fee amount
- [ ] Show price impact percentage
- [ ] Update on amount/side change

---

### TRADEUI-5: Create Trading Mutations

**As a** frontend developer  
**I want** trade mutations  
**So that** I can execute trades

**Acceptance Criteria:**
- [ ] Create `src/hooks/useTrading.ts`
- [ ] `useBuyShares()` mutation
- [ ] `useSellShares()` mutation
- [ ] Invalidate queries on success: auth/me, portfolio, market detail
- [ ] Generate idempotency key per request
- [ ] Handle retry logic for network errors

**References:** FRONTEND_STATE.md Section 4.1

---

### TRADEUI-6: Handle Trade Errors

**As a** user  
**I want** clear error messages  
**So that** I understand why trades fail

**Acceptance Criteria:**
- [ ] Map error codes to user-friendly messages
- [ ] INSUFFICIENT_BALANCE: "You don't have enough points"
- [ ] SLIPPAGE_EXCEEDED: "Price moved too much. Try again with higher slippage"
- [ ] MARKET_NOT_ACTIVE: "This market is not open for trading"
- [ ] Display error in form
- [ ] Clear error on new submission

---

### TRADEUI-7: Show Trade Confirmation

**As a** user  
**I want** confirmation feedback  
**So that** I know my trade succeeded

**Acceptance Criteria:**
- [ ] Show success message/toast
- [ ] Display shares received
- [ ] Display new balance
- [ ] Reset form after success
- [ ] Update UI with new prices

---

## Epic 7: Mint & Merge

**Goal:** Advanced trading - create and destroy share pairs.

### MINT-1: Implement POST /markets/:id/mint

**As a** user  
**I want** to mint shares  
**So that** I can create YES+NO pairs

**Endpoint:** `POST /v1/markets/:id/mint`

**Request:**
```json
{
  "amount": "100000"
}
```

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] No fee charged
- [ ] Create equal YES and NO shares
- [ ] 1 Point = 1 YES + 1 NO
- [ ] Deduct points from user
- [ ] Add shares to portfolio
- [ ] Log to trade_ledger

**Response:**
```json
{
  "yesOut": "100000",
  "noOut": "100000",
  "newBalance": "4900000"
}
```

**References:** API_SPECIFICATION.md Section 4.4.3, ENGINE_LOGIC.md Section 6.3

---

### MINT-2: Implement POST /markets/:id/merge

**As a** user  
**I want** to merge shares  
**So that** I can convert pairs back to points

**Endpoint:** `POST /v1/markets/:id/merge`

**Request:**
```json
{
  "amount": "50000"
}
```

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] No fee charged
- [ ] Require equal YES and NO shares
- [ ] Destroy equal amounts of both
- [ ] Credit points to user (1 Point per pair)
- [ ] Update portfolio
- [ ] Log to trade_ledger

**Error:** INSUFFICIENT_SHARES if user doesn't have equal amounts

**References:** API_SPECIFICATION.md Section 4.4.4, ENGINE_LOGIC.md Section 6.3

---

### MINT-3: Add Mint/Merge to TradeForm

**As a** user  
**I want** mint/merge UI  
**So that** I can use these operations

**Acceptance Criteria:**
- [ ] Add Mint/Merge tabs to TradeForm
- [ ] Mint: single amount input, show output preview
- [ ] Merge: single amount input, show both share types
- [ ] Validate user has sufficient balance/shares
- [ ] Create mutations for mint/merge

---

### MINT-4: Implement Netting Protocol

**As a** user  
**I want** automatic netting  
**So that** I don't hold conflicting positions

**Acceptance Criteria:**
- [ ] Detect when user buys opposite side
- [ ] Auto-exit opposite position first (fee-free)
- [ ] Combine proceeds with new buy amount
- [ ] Execute single entry trade (with fees)
- [ ] Log NET_SELL action to ledger
- [ ] Maintain Rule 2: No conflicting positions

**Example:**
User holds 100 NO shares, wants to buy YES with $50:
1. Sell 100 NO shares (fee-free) → get ~$40
2. Combine: $50 + $40 = $90
3. Buy YES with $90 (2% fee)

**References:** ENGINE_LOGIC.md Section 7, SYSTEM_DESIGN.md Rule 2

---

## Epic 8: Portfolio

**Goal:** User can view all positions and trade history.

### PORT-1: Implement GET /portfolio

**As a** user  
**I want** to see all my positions  
**So that** I can track my investments

**Endpoint:** `GET /v1/portfolio`

**Query Params:**
- `status` - filter by market status
- `hasPosition` - only markets with holdings (default: true)

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Query portfolios for user
- [ ] Join with markets for market info
- [ ] Calculate current value: shares × currentPrice
- [ ] Calculate unrealized P&L: currentValue - costBasis
- [ ] Calculate total portfolio value
- [ ] Return positions list

**Response:**
```json
{
  "totalValue": "5250000",
  "totalCostBasis": "5000000",
  "unrealizedPnL": "250000",
  "positions": [
    {
      "market": { "id": "...", "title": "...", "status": "ACTIVE", "yesPrice": 0.55 },
      "yesQty": "100000",
      "noQty": "0",
      "yesCostBasis": "50000",
      "noCostBasis": "0",
      "currentValue": "55000",
      "unrealizedPnL": "5000"
    }
  ]
}
```

**References:** API_SPECIFICATION.md Section 4.5.1

---

### PORT-2: Implement GET /portfolio/:marketId

**As a** user  
**I want** my position in a specific market  
**So that** I can see detailed info

**Endpoint:** `GET /v1/portfolio/:marketId`

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Return position or empty if none
- [ ] Calculate average buy price
- [ ] Calculate unrealized P&L

**References:** API_SPECIFICATION.md Section 4.5.2

---

### PORT-3: Implement GET /portfolio/history

**As a** user  
**I want** my trade history  
**So that** I can review past trades

**Endpoint:** `GET /v1/portfolio/history`

**Query Params:**
- `marketId` - filter by market
- `action` - filter by action type
- `page`, `pageSize`

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Query trade_ledger for user
- [ ] Join market title
- [ ] Paginate results
- [ ] Order by created_at DESC

**References:** API_SPECIFICATION.md Section 4.5.3

---

### PORT-4: Create Portfolio Page

**As a** user  
**I want** a portfolio page  
**So that** I can see all my positions

**Route:** `/portfolio`

**Acceptance Criteria:**
- [ ] Protected route (require auth)
- [ ] Show total value and P&L summary
- [ ] Grid of PositionCard components
- [ ] Empty state if no positions
- [ ] Link to markets to start trading

---

### PORT-5: Create PositionCard Component

**As a** user  
**I want** position cards  
**So that** I can see position details

**Acceptance Criteria:**
- [ ] Create `src/components/portfolio/PositionCard.tsx`
- [ ] Market title
- [ ] YES/NO holdings with current price
- [ ] Unrealized P&L with trend icon
- [ ] Link to market detail

**References:** FRONTEND_COMPONENTS.md Section 6.1

---

### PORT-6: Create TradeHistory Component

**As a** user  
**I want** trade history  
**So that** I can review past activity

**Acceptance Criteria:**
- [ ] Create `src/components/portfolio/TradeHistory.tsx`
- [ ] Use infinite scroll with useInfiniteQuery
- [ ] Show action type, side, amounts, fees
- [ ] Show market title
- [ ] Timestamp formatting

**References:** FRONTEND_STATE.md Section 3.4

---

## Epic 9: Admin - Market Management

**Goal:** Admins can create and manage markets.

### ADMIN-1: Implement Admin Role Check

**As a** backend developer  
**I want** admin middleware  
**So that** admin endpoints are protected

**Acceptance Criteria:**
- [ ] Check user.role === 'admin'
- [ ] Return 403 FORBIDDEN if not admin
- [ ] Apply to all /admin routes

**References:** API_SPECIFICATION.md Section 2.5

---

### ADMIN-2: Implement POST /admin/markets (Create + Genesis)

**As an** admin  
**I want** to create markets  
**So that** users have events to trade

**Endpoint:** `POST /v1/admin/markets`

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

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Validate minimum seed liquidity
- [ ] Create market record (status: DRAFT)
- [ ] Create liquidity_pool with 50/50 split
- [ ] Grant seed shares to treasury account
- [ ] Log GENESIS_MINT to trade_ledger
- [ ] Return created market

**References:** API_SPECIFICATION.md Section 4.6.1, ENGINE_LOGIC.md Section 8

---

### ADMIN-3: Implement Market Lifecycle Endpoints

**As an** admin  
**I want** to manage market lifecycle  
**So that** I can control trading

**Endpoints:**
- `POST /v1/admin/markets/:id/activate`
- `POST /v1/admin/markets/:id/pause`
- `POST /v1/admin/markets/:id/resume`

**Acceptance Criteria:**
- [ ] Activate: DRAFT → ACTIVE
- [ ] Pause: ACTIVE → PAUSED (with optional reason)
- [ ] Resume: PAUSED → ACTIVE
- [ ] Validate state transitions
- [ ] Update market record
- [ ] Log actions

**State Machine:**
```
DRAFT → ACTIVE ⇄ PAUSED → RESOLVED/CANCELLED
```

**References:** API_SPECIFICATION.md Section 4.6.2-4.6.4, SYSTEM_DESIGN.md Section 4

---

### ADMIN-4: Create Admin Layout

**As an** admin  
**I want** an admin interface  
**So that** I can manage the platform

**Route:** `/admin`

**Acceptance Criteria:**
- [ ] Protected route (require admin)
- [ ] Sidebar navigation
- [ ] Dashboard overview
- [ ] Markets management link
- [ ] Users management link

---

### ADMIN-5: Create Market Creation Form

**As an** admin  
**I want** a form to create markets  
**So that** I can add new events

**Acceptance Criteria:**
- [ ] Title input (required)
- [ ] Description textarea (required)
- [ ] Category select
- [ ] Image URL input
- [ ] Closes at date picker
- [ ] Seed liquidity input
- [ ] Preview before submit
- [ ] Success/error feedback

---

### ADMIN-6: Create Markets Management Table

**As an** admin  
**I want** a markets table  
**So that** I can manage all markets

**Acceptance Criteria:**
- [ ] Table with all markets
- [ ] Columns: Title, Status, Volume, Created, Actions
- [ ] Action buttons: Activate, Pause, Resume, Resolve
- [ ] Filter by status
- [ ] Search by title
- [ ] Pagination

---

## Epic 10: Admin - Resolution & Points

**Goal:** Admins can resolve markets and grant points.

### RESOLVE-1: Implement POST /admin/markets/:id/resolve

**As an** admin  
**I want** to resolve markets  
**So that** winners get paid

**Endpoint:** `POST /v1/admin/markets/:id/resolve`

**Request:**
```json
{
  "resolution": "YES",
  "evidence": "BTC reached $102,450 at 14:32 UTC on Dec 15"
}
```

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Market must be ACTIVE or PAUSED
- [ ] Set status = RESOLVED
- [ ] Set resolution = YES or NO
- [ ] Set resolvedAt timestamp
- [ ] Process all winning positions:
  - Get all portfolios for market
  - Credit winners: 1 Point per winning share
  - Log RESOLUTION_PAYOUT per user
- [ ] Clear pool (set to 0/0)
- [ ] Return payout summary

**Payout Logic:**
- YES wins: Users with YES shares get 1 Point per share
- NO wins: Users with NO shares get 1 Point per share
- Losers get nothing

**References:** API_SPECIFICATION.md Section 4.6.5, ENGINE_LOGIC.md Section 9

---

### RESOLVE-2: Implement POST /admin/markets/:id/cancel

**As an** admin  
**I want** to cancel markets  
**So that** users get refunds when needed

**Endpoint:** `POST /v1/admin/markets/:id/cancel`

**Request:**
```json
{
  "reason": "Event was cancelled"
}
```

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Cannot cancel RESOLVED markets
- [ ] Set status = CANCELLED
- [ ] Set resolution = CANCELLED
- [ ] Refund all holders their cost basis:
  - For each portfolio: refund yesCostBasis + noCostBasis
  - Log REFUND per user
- [ ] Clear portfolios
- [ ] Clear pool
- [ ] Track surplus (pool value - total refunds) goes to treasury

**References:** API_SPECIFICATION.md Section 4.6.6, ENGINE_LOGIC.md Section 10

---

### RESOLVE-3: Implement POST /admin/users/:id/grant-points

**As an** admin  
**I want** to grant points  
**So that** I can reward users or correct errors

**Endpoint:** `POST /v1/admin/users/:id/grant-points`

**Request:**
```json
{
  "amount": "5000000",
  "reason": "Contest winner reward"
}
```

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Validate user exists
- [ ] Validate amount > 0
- [ ] Add to user balance
- [ ] Log to point_grants table
- [ ] Record admin who granted
- [ ] Return new balance

**References:** API_SPECIFICATION.md Section 4.6.7

---

### RESOLVE-4: Create Resolution UI

**As an** admin  
**I want** a resolution interface  
**So that** I can resolve markets safely

**Acceptance Criteria:**
- [ ] Resolution modal/page
- [ ] YES/NO outcome selection
- [ ] Evidence/notes text field
- [ ] Show affected users count
- [ ] Show total payout amount
- [ ] Confirmation dialog before submit
- [ ] Success feedback with stats

---

### RESOLVE-5: Create Point Grant Form

**As an** admin  
**I want** a points grant form  
**So that** I can give users points

**Acceptance Criteria:**
- [ ] User selector (search by email)
- [ ] Amount input
- [ ] Reason field (required)
- [ ] Show user's current balance
- [ ] Preview new balance
- [ ] Submit with confirmation

---

### ADMIN-7: Implement GET /admin/users

**As an** admin  
**I want** to list all users  
**So that** I can manage the user base

**Endpoint:** `GET /v1/admin/users`

**Query Params:**
- `search` - filter by email
- `role` - filter by role
- `page`, `pageSize`

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Return paginated user list
- [ ] Include id, email, role, balance, isActive, createdAt

**References:** API_SPECIFICATION.md Section 4.6.8

---

### ADMIN-8: Implement GET /admin/users/:id

**As an** admin  
**I want** to view user details  
**So that** I can see user activity

**Endpoint:** `GET /v1/admin/users/:id`

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Return user profile
- [ ] Include stats: totalTrades, totalVolume, activePositions, pointsGranted

**References:** API_SPECIFICATION.md Section 4.6.9

---

### ADMIN-9: Create Users Management Table

**As an** admin  
**I want** a users management view  
**So that** I can see all users

**Acceptance Criteria:**
- [ ] Table with all users
- [ ] Columns: Email, Role, Balance, Active, Created, Actions
- [ ] Search by email
- [ ] Filter by role
- [ ] Action: Grant Points button
- [ ] Pagination

---

### AUTH-9: Implement OAuth Callback Endpoint

**As a** backend developer  
**I want** OAuth callback handling  
**So that** email verification and OAuth work

**Endpoint:** `GET /v1/auth/callback`

**Query Params:**
- `token_hash` - from email link
- `type` - email or signup

**Acceptance Criteria:**
- [ ] Verify OTP with Supabase
- [ ] Redirect to frontend on success
- [ ] Handle errors gracefully

**References:** API_SPECIFICATION.md Section 4.1.4

---

## Epic 11: Real-Time Updates (WebSocket)

**Goal:** Live price updates and trade notifications.

### WS-1: Set Up Fastify WebSocket Server

**As a** backend developer  
**I want** WebSocket support  
**So that** I can push real-time updates

**Acceptance Criteria:**
- [ ] Register @fastify/websocket plugin
- [ ] Create `/ws` endpoint
- [ ] Validate session from cookies
- [ ] Reject connection if not authenticated (or allow public for prices)
- [ ] Send "connected" message on success
- [ ] Handle ping/pong for keepalive

**Connection URL:** `wss://api.example.com/ws`

**References:** WEBSOCKET_PROTOCOL.md Sections 1-2, 9.1

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
- [ ] Subscribe message: `{ type: "subscribe", channel: "market:abc" }`
- [ ] Unsubscribe message: `{ type: "unsubscribe", channel: "..." }`
- [ ] Confirm subscription: `{ type: "subscribed", channel: "..." }`
- [ ] Auto-subscribe user to their user channel
- [ ] Enforce authorization (can't subscribe to other users)
- [ ] Max 50 subscriptions per connection
- [ ] Max 5 connections per user

**References:** WEBSOCKET_PROTOCOL.md Sections 4, 6

---

### WS-3: Broadcast Price Updates After Trades

**As a** user  
**I want** live price updates  
**So that** I see current market prices

**Message Type:** `price_update`

**Acceptance Criteria:**
- [ ] After every trade, broadcast to `market:{marketId}`
- [ ] Include: yesPrice, noPrice, yesQty, noQty
- [ ] Include: lastTradePrice, lastTradeSide, lastTradeSize
- [ ] Include: volume24h
- [ ] Timestamp in ISO 8601

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
- [ ] Send to `user:{userId}` after trade completes
- [ ] Include full trade details
- [ ] Include new balance
- [ ] Include new position

**Also broadcast:**
- `balance_update` - when balance changes
- `resolution_payout` - when user receives payout
- `points_granted` - when admin grants points

**References:** WEBSOCKET_PROTOCOL.md Section 5.3

---

### WS-5: Create useWebSocket Hook

**As a** frontend developer  
**I want** WebSocket management  
**So that** components receive live updates

**Acceptance Criteria:**
- [ ] Create `src/hooks/useWebSocket.ts`
- [ ] Connect with session cookie
- [ ] Auto-reconnect with exponential backoff
- [ ] Ping every 30 seconds
- [ ] Handle disconnection states
- [ ] Subscribe/unsubscribe methods
- [ ] Custom message handler callback

**References:** FRONTEND_STATE.md Section 5, WEBSOCKET_PROTOCOL.md Section 9.3

---

### WS-6: Update TanStack Query Cache from WebSocket

**As a** frontend developer  
**I want** cache updates from WebSocket  
**So that** UI stays in sync

**Acceptance Criteria:**
- [ ] On `price_update`: Update market detail cache
- [ ] On `balance_update`: Update auth/me cache
- [ ] On `trade_confirmed`: Invalidate portfolio queries
- [ ] On `market_state`: Invalidate market queries
- [ ] Use `queryClient.setQueryData` for instant updates
- [ ] Use `queryClient.invalidateQueries` for refetch

**References:** FRONTEND_STATE.md Section 5.1

---

### WS-7: Show Live Price Updates

**As a** user  
**I want** real-time prices  
**So that** I see the latest odds

**Acceptance Criteria:**
- [ ] Subscribe to market channel on detail page
- [ ] Update ProbabilityBar when prices change
- [ ] Update TradeForm prices
- [ ] Animate price changes
- [ ] Unsubscribe on unmount

---

## Epic 12: Webhooks (Optional/Future)

**Goal:** External integrations can receive event notifications.

### WEBHOOK-1: Implement Webhook System

**As an** integrator  
**I want** webhook notifications  
**So that** I can build integrations

**Events:**
- `market.activated` - Market goes live
- `market.resolved` - Outcome decided
- `market.cancelled` - Market cancelled
- `trade.executed` - Trade completed
- `payout.completed` - Resolution payout done

**Acceptance Criteria:**
- [ ] Webhook registration endpoint (admin)
- [ ] Event payload with signature (HMAC-SHA256)
- [ ] Retry logic for failed deliveries
- [ ] Webhook log for debugging

**References:** API_SPECIFICATION.md Section 7

---

## Additional Cross-Cutting Requirements

### Security Requirements (from EDGE_CASES.md)

- [ ] All monetary calculations use BigInt (no floats)
- [ ] Floor rounding on user outputs
- [ ] Ceiling rounding on fees
- [ ] k-invariant never decreases
- [ ] Rate limiting: 30 req/min for trades
- [ ] Session validation on every request
- [ ] Idempotency keys for all mutations

### Performance Requirements (from SYSTEM_DESIGN.md)

- [ ] Support 10,000 concurrent WebSocket connections
- [ ] API latency p50 < 50ms
- [ ] API latency p99 < 200ms
- [ ] Price update latency < 100ms

### Monitoring Requirements (from SYSTEM_DESIGN.md)

- [ ] Log all trades to audit trail
- [ ] Track k-invariant per market
- [ ] Alert on k decrease
- [ ] Alert on high error rate (>5%)
- [ ] Alert on rapid price movement (>20% in 1 minute)

---

## Story Sizing Guide

| Size | Points | Description |
|------|--------|-------------|
| XS | 1 | Simple config, single function |
| S | 2 | Single endpoint or component |
| M | 3 | Complex endpoint or feature |
| L | 5 | Multi-part feature |
| XL | 8 | Large feature with many parts |

---

## Summary by Epic

| Epic | Stories | Description |
|------|---------|-------------|
| 0 | 6 | Project Setup |
| 1 | 9 | Authentication |
| 2 | 5 | User Profile & Balance |
| 3 | 6 | Markets Listing |
| 4 | 6 | Market Detail |
| 5 | 7 | Trading Engine |
| 6 | 7 | Trading UI |
| 7 | 4 | Mint & Merge |
| 8 | 6 | Portfolio |
| 9 | 9 | Admin Markets |
| 10 | 5 | Resolution & Points |
| 11 | 7 | WebSocket |
| 12 | 1 | Webhooks (Future) |
| **Total** | **78** | |

---

*Document Version: 1.0 | Total Stories: 78*
