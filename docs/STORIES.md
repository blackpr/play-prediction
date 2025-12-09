# Play Prediction - User Stories & Implementation Tasks

**Version:** 1.3  
**Last Updated:** December 9, 2025

This document contains detailed user stories organized by Epic. Each story references the relevant specification documents and includes acceptance criteria.

> **Completeness Check:** This document has been reviewed against all specification documents (SYSTEM_DESIGN.md, API_SPECIFICATION.md, DATABASE_SCHEMA.md, ENGINE_LOGIC.md, FRONTEND_ARCHITECTURE.md, FRONTEND_COMPONENTS.md, FRONTEND_STATE.md, WEBSOCKET_PROTOCOL.md, BACKEND_ARCHITECTURE.md, EDGE_CASES.md) to ensure comprehensive coverage.
>
> **Review Date:** December 9, 2025 - Verified complete coverage including authentication flows, trading engine, admin management, real-time updates, and edge case handling. Added SETUP-14 (DI Container) and AUTH-12 (Email Templates) based on architecture review. See `REVIEW_NOTES.md` for detailed analysis.

---

## Epic 0: Project Setup

**Goal:** Foundation for both backend and frontend projects.

### SETUP-1: Initialize Backend Project

**As a** developer  
**I want** a properly configured backend project  
**So that** I can build the API with TypeScript, Fastify, and Drizzle ORM

**Acceptance Criteria:**
- [x] Create `backend/` directory with package.json
- [x] Configure TypeScript with strict mode (tsconfig.json)
- [x] Install dependencies:
  - fastify ^4.28.1
  - @fastify/cookie, @fastify/cors, @fastify/websocket
  - drizzle-orm, postgres
  - @supabase/ssr, @supabase/supabase-js
  - zod for validation
  - tsx for development
  - vitest for testing
- [x] Set up folder structure per BACKEND_ARCHITECTURE.md:
  ```
  src/
  ├── domain/           # Pure business logic
  ├── application/      # Use cases & ports
  ├── infrastructure/   # Database, auth implementations
  ├── presentation/     # Fastify routes
  └── shared/           # Config, logger, utils
  ```
- [x] Create drizzle.config.ts

**References:** BACKEND_ARCHITECTURE.md Section 2

---

### SETUP-2: Configure Supabase Project with CLI

**As a** developer  
**I want** Supabase configured with CLI for local development  
**So that** I can develop locally without affecting production

**Acceptance Criteria:**
- [ ] Install Supabase CLI globally (`npm i -g supabase`)
- [ ] Initialize Supabase in project root: `supabase init`
- [ ] Create `supabase/config.toml` with project configuration
- [ ] Set up local development environment:
  - `supabase start` - starts local PostgreSQL, Auth, Storage, Studio
  - `supabase stop` - stops local services
  - `supabase status` - shows local service URLs and keys
- [ ] Create .env.example with all required variables:
  - SUPABASE_URL (local: http://localhost:54321)
  - SUPABASE_ANON_KEY (from `supabase status`)
  - SUPABASE_SERVICE_ROLE_KEY (from `supabase status`)
  - DATABASE_URL (local: postgresql://postgres:postgres@localhost:54322/postgres)
- [ ] Create .env.local for local development with CLI-generated keys
- [ ] Document Supabase Studio access (http://localhost:54323)
- [ ] Configure connection pooling settings for production

**Local Services (via `supabase start`):**
- PostgreSQL: localhost:54322
- API: localhost:54321
- Studio: localhost:54323
- Inbucket (email): localhost:54324

**References:** SYSTEM_DESIGN.md Section 2.2, DATABASE_SCHEMA.md Section 4.2-4.4

---

### SETUP-3: Create Database Schema & Migrations

**As a** developer  
**I want** complete database schema with Drizzle ORM and drizzle-kit migrations  
**So that** all tables are properly defined with version-controlled migrations

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
- [ ] Create migrations using drizzle-kit:
  - `npx drizzle-kit generate` - generate SQL migrations from schema changes
  - Place migrations in `backend/drizzle/` directory (configured in drizzle.config.ts)
  - `npx drizzle-kit migrate` - apply pending migrations to database
  - `npx drizzle-kit push` - push schema changes directly (dev only)
- [ ] Create seed data script: `backend/src/infrastructure/database/seed.ts`

**Migration Workflow:**
```bash
# After modifying Drizzle schema, generate migration
npx drizzle-kit generate

# Review generated SQL in backend/drizzle/<timestamp>_*.sql

# Apply migrations to local database
npx drizzle-kit migrate

# Or push directly during development (bypasses migration files)
npx drizzle-kit push

# View database in Drizzle Studio
npx drizzle-kit studio
```

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
- [ ] Create comprehensive README.md with setup instructions
- [ ] Document required environment variables
- [ ] Create `dev` script that starts all services

**Development Scripts (root package.json):**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:db\" \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:db": "supabase start",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "db:generate": "npm run db:generate --workspace=backend",
    "db:migrate": "npm run db:migrate --workspace=backend",
    "db:push": "npm run db:push --workspace=backend",
    "db:studio": "npm run db:studio --workspace=backend",
    "stop": "supabase stop"
  }
}
```

**Local Development URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Supabase API: http://localhost:54321
- Supabase Studio: http://localhost:54323
- Inbucket (email testing): http://localhost:54324

**References:** FRONTEND_ARCHITECTURE.md Section 8

---

### SETUP-7: Configure Backend Error Handling

**As a** backend developer  
**I want** centralized error handling  
**So that** errors are handled consistently

**Acceptance Criteria:**
- [ ] Create error handler middleware
- [ ] Map domain errors to HTTP status codes
- [ ] Return consistent error response format
- [ ] Log errors appropriately (don't log expected errors)
- [ ] Handle Zod validation errors
- [ ] Handle unknown errors gracefully

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

**References:** API_SPECIFICATION.md Section 5

---

### SETUP-8: Configure Rate Limiting

**As a** backend developer  
**I want** rate limiting on API endpoints  
**So that** the system is protected from abuse

**Acceptance Criteria:**
- [ ] Install @fastify/rate-limit or similar
- [ ] Configure limits per endpoint type:
  - Public: 100 req/min per IP
  - Authenticated: 60 req/min per user
  - Trading: 30 req/min per user
  - Admin: 120 req/min per user
- [ ] Return rate limit headers (X-RateLimit-*)
- [ ] Return 429 with Retry-After header when exceeded

**References:** API_SPECIFICATION.md Section 6

---

### SETUP-9: Configure Structured Logging

**As a** backend developer  
**I want** structured JSON logging  
**So that** logs are searchable and analyzable

**Acceptance Criteria:**
- [ ] Use Pino logger (Fastify default)
- [ ] Log level based on environment
- [ ] Include requestId in all logs
- [ ] Include userId when authenticated
- [ ] Never log sensitive data (passwords, tokens)
- [ ] Log trade executions with amounts

**Log Format:**
```json
{
  "level": "info",
  "time": "2024-12-09T10:30:00Z",
  "requestId": "req_abc123",
  "userId": "user_xyz",
  "msg": "Trade executed",
  "marketId": "mkt_123",
  "action": "BUY"
}
```

**References:** SYSTEM_DESIGN.md Section 8.3

---

### SETUP-10: Implement Health Check Endpoint

**As a** DevOps engineer  
**I want** a health check endpoint  
**So that** I can monitor system health

**Endpoint:** `GET /health`

**Acceptance Criteria:**
- [ ] Public endpoint (no auth required)
- [ ] Check database connectivity
- [ ] Check Supabase auth connectivity
- [ ] Return overall status
- [ ] Return component statuses
- [ ] Fast response (<100ms)

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-09T10:30:00Z",
  "components": {
    "database": { "status": "healthy", "latency": 5 },
    "auth": { "status": "healthy", "latency": 10 }
  }
}
```

---

### SETUP-11: Configure Test Infrastructure

**As a** developer  
**I want** test infrastructure configured  
**So that** I can write and run tests

**Acceptance Criteria:**
- [ ] Configure Vitest for backend
- [ ] Use local Supabase for integration tests (`supabase start`)
- [ ] Create test utilities for common patterns:
  - `createTestUser()` - creates user with Supabase auth
  - `createTestMarket()` - creates market with liquidity
  - `cleanupTestData()` - removes test data after each test
- [ ] Configure code coverage reporting
- [ ] Add test scripts to package.json
- [ ] Create example unit test (domain logic)
- [ ] Create example integration test (with local Supabase)
- [ ] Set up GitHub Actions to run tests with Supabase CLI

**Scripts:**
```json
{
  "test": "vitest",
  "test:coverage": "vitest --coverage",
  "test:ui": "vitest --ui",
  "test:integration": "supabase start && vitest run --config vitest.integration.config.ts && supabase stop"
}
```

**Test Environment:**
- Unit tests: Mock Supabase client, test domain logic in isolation
- Integration tests: Use local Supabase via CLI, real database operations
- E2E tests: Full stack with local services

**References:** BACKEND_ARCHITECTURE.md Section 9

---

### SETUP-12: Implement Circuit Breakers

**As a** system administrator  
**I want** circuit breakers on critical operations  
**So that** the system fails safely under stress

**Acceptance Criteria:**
- [ ] k-invariant monitor: Alert and reject if k decreases
- [ ] Rapid price movement detector: Alert if >30% in 5 minutes
- [ ] High error rate detector: Alert if >5% errors for 5 minutes
- [ ] Database connection monitor: Reject requests if pool exhausted
- [ ] Log all circuit breaker triggers
- [ ] Admin notification on trigger

**References:** EDGE_CASES.md Section 10

---

### SETUP-13: Configure CI/CD with Supabase CLI

**As a** developer  
**I want** automated CI/CD pipeline  
**So that** code is tested and deployed consistently

**Acceptance Criteria:**
- [ ] Create `.github/workflows/test.yml` for PR checks:
  - Install Supabase CLI
  - Run `supabase start` for integration tests
  - Run unit tests
  - Run integration tests
  - Check TypeScript compilation
  - Run linting
- [ ] Create `.github/workflows/deploy.yml` for deployments:
  - Deploy backend to hosting platform
  - Run `npx drizzle-kit migrate` to apply migrations
  - Deploy frontend to CDN
- [ ] Configure Supabase project linking:
  - `supabase link --project-ref <project-id>`
  - Store `SUPABASE_ACCESS_TOKEN` in GitHub secrets
- [ ] Set up staging and production environments

**GitHub Actions Example:**
```yaml
name: Test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: npm ci
      - run: npm test
      - run: supabase stop
```

---

### SETUP-14: Implement Dependency Injection Container

**As a** backend developer  
**I want** a dependency injection container  
**So that** I can manage dependencies cleanly and swap implementations

**Acceptance Criteria:**
- [ ] Create `src/shared/container.ts` with Container class
- [ ] Support singleton and factory registrations
- [ ] Create composition root in `src/main.ts`
- [ ] Register all repositories, services, and use cases
- [ ] Document the pattern for adding new dependencies
- [ ] Enable easy mocking for unit tests

**Implementation:**
```typescript
// Simple DI Container
class Container {
  private singletons = new Map<string, unknown>();
  private factories = new Map<string, () => unknown>();
  
  registerSingleton<T>(key: string, instance: T): void;
  registerFactory<T>(key: string, factory: () => T): void;
  resolve<T>(key: string): T;
}

// Usage in composition root
const container = new Container();
container.registerSingleton('db', drizzleClient);
container.registerFactory('userRepository', () => new PostgresUserRepository(container.resolve('db')));
```

**References:** BACKEND_ARCHITECTURE.md Section 8

---

## Background Job Infrastructure (BullMQ + Redis)

> **Architecture Decision:** Use BullMQ + Redis as the generic, reusable job queue infrastructure for all background processing. This is foundational infrastructure reused by market scheduling, notifications, analytics, and future features.

### JOBS-1: Set Up Redis Connection & BullMQ Infrastructure

**As a** backend developer  
**I want** a generic job queue infrastructure  
**So that** we can run background tasks reliably and reuse it across features

**Acceptance Criteria:**
- [ ] Add dependencies: `bullmq`, `ioredis`
- [ ] Create Redis connection: `src/infrastructure/redis/connection.ts`
- [ ] Create queue factory: `src/infrastructure/jobs/queue-factory.ts`
- [ ] Create worker factory: `src/infrastructure/jobs/worker-factory.ts`
- [ ] Create QueueService: `src/infrastructure/jobs/queue-service.ts`
- [ ] Add environment variables: `REDIS_URL`, `WORKER_CONCURRENCY`
- [ ] Handle Redis connection errors gracefully

**References:** SYSTEM_DESIGN.md Section 5.5

---

### JOBS-2: Create Worker Process Entry Point

**As a** backend developer  
**I want** a separate worker process  
**So that** background jobs don't affect API performance

**Acceptance Criteria:**
- [ ] Create worker entry point: `src/worker.ts`
- [ ] Register all job handlers on startup
- [ ] Graceful shutdown handling
- [ ] Add npm scripts: `worker`, `worker:dev`
- [ ] Log job start, completion, and failures

---

### JOBS-3: Add Job Queue to Development Environment

**As a** developer  
**I want** Redis running locally  
**So that** I can test background jobs during development

**Acceptance Criteria:**
- [ ] Add Redis to local development (Docker or Supabase)
- [ ] Update dev scripts to start Redis
- [ ] Create CLI commands: `job:trigger`, `job:stats`, `job:clear`
- [ ] Document job testing in README

---

### JOBS-4: Implement Job Monitoring & Observability

**As a** platform operator  
**I want** visibility into job queue health  
**So that** I can detect and fix issues quickly

**Acceptance Criteria:**
- [ ] Expose queue metrics (processed, failed, waiting)
- [ ] Health check endpoint: `GET /health/worker`
- [ ] Log job failures with context
- [ ] Alert on failure rate > 5% or queue depth > 1000

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

### AUTH-10: Implement Password Reset Flow

**As a** user  
**I want** to reset my password if I forget it  
**So that** I can regain access to my account

**Endpoints:**
- `POST /v1/auth/forgot-password` - Request reset email
- `POST /v1/auth/reset-password` - Set new password with token

**Acceptance Criteria:**
- [ ] Forgot Password: Call `supabase.auth.resetPasswordForEmail()`
- [ ] Send reset email with secure token link
- [ ] Reset Password: Validate token and update password
- [ ] Invalidate all existing sessions after password change
- [ ] Return appropriate error messages
- [ ] Rate limit: Max 3 reset requests per email per hour

**Frontend:**
- [ ] Create `/forgot-password` route
- [ ] Email input form with validation
- [ ] Success message: "Check your email for reset link"
- [ ] Create `/reset-password` route (with token in URL)
- [ ] New password + confirm password inputs
- [ ] Password strength requirements display
- [ ] Success message + redirect to login

**References:** EDGE_CASES.md Section 5

---

### AUTH-11: Handle Session Expiration

**As a** user  
**I want** graceful handling when my session expires  
**So that** I don't lose my work and can re-authenticate

**Acceptance Criteria:**
- [ ] Detect 401 responses from API
- [ ] Show session expiry modal/notification
- [ ] Preserve current URL for redirect after re-login
- [ ] Clear stale cache data
- [ ] Redirect to login with return URL
- [ ] On WebSocket: Handle SESSION_EXPIRED close code (4000)

**References:** WEBSOCKET_PROTOCOL.md Section 7.2, EDGE_CASES.md Section 5.0

---

### AUTH-12: Configure Email Templates

**As a** developer  
**I want** branded email templates for Supabase Auth  
**So that** users receive professional-looking emails

**Acceptance Criteria:**
- [ ] Configure Supabase email templates in project settings
- [ ] Design welcome/verification email template
- [ ] Design password reset email template
- [ ] Test email delivery with Inbucket locally
- [ ] Verify email links work correctly
- [ ] Include branding (logo, colors)
- [ ] Mobile-responsive email layout

**Email Templates to Configure:**
1. **Confirm Signup** - Sent after registration
2. **Reset Password** - Sent on forgot password
3. **Magic Link** - If implementing passwordless auth
4. **Email Change** - When user updates email

**Local Testing with Inbucket:**
- Access: http://localhost:54324
- View all emails sent during local development
- Test email content and links

**References:** EDGE_CASES.md Section 5.2, Supabase Auth Email Templates

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

### USER-6: Create Landing Page

**As a** visitor  
**I want** an engaging landing page  
**So that** I understand what the platform does

**Route:** `/`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/index.tsx`
- [ ] Hero section with tagline and CTA
- [ ] Featured/trending markets section
- [ ] How it works section (3 steps)
- [ ] Call to action for registration
- [ ] Responsive design
- [ ] Animated elements (subtle)

**Sections:**
1. Hero: "Predict the Future. Trade Your Knowledge."
2. Featured Markets: Top 3 active markets
3. How It Works: Register → Browse → Trade
4. CTA: Get Started button

---

### USER-7: Create Footer Component

**As a** user  
**I want** a footer on all pages  
**So that** I can access important links

**Acceptance Criteria:**
- [ ] Create `src/components/layout/Footer.tsx`
- [ ] Logo and tagline
- [ ] Navigation links
- [ ] Social links (placeholder)
- [ ] Copyright notice
- [ ] Responsive layout (stacked on mobile)

---

### USER-8: Create Toast Notification System

**As a** user  
**I want** toast notifications  
**So that** I get feedback on my actions

**Acceptance Criteria:**
- [ ] Create `src/components/ui/Toast.tsx`
- [ ] Create toast context/provider
- [ ] Support variants: success, error, warning, info
- [ ] Auto-dismiss after 5 seconds
- [ ] Manual dismiss button
- [ ] Stack multiple toasts
- [ ] Position: bottom-right

**Usage:**
```typescript
const toast = useToast()
toast.success('Trade executed successfully!')
toast.error('Insufficient balance')
```

---

### USER-9: Create Loading Skeleton Components

**As a** user  
**I want** loading skeletons  
**So that** I see placeholder content while data loads

**Acceptance Criteria:**
- [ ] Create `src/components/ui/Skeleton.tsx`
- [ ] Create `src/components/market/MarketCardSkeleton.tsx`
- [ ] Create `src/components/portfolio/PositionCardSkeleton.tsx`
- [ ] Pulse animation
- [ ] Match dimensions of real components

---

### USER-10: Create 404 Not Found Page

**As a** user  
**I want** a friendly 404 page  
**So that** I'm not confused when I hit a broken link

**Route:** Catch-all route

**Acceptance Criteria:**
- [ ] Clear "Page Not Found" message
- [ ] Link back to home
- [ ] Link to markets
- [ ] Consistent with site design

---

### USER-11: Create Mobile Navigation

**As a** mobile user  
**I want** a mobile-friendly navigation  
**So that** I can navigate on small screens

**Acceptance Criteria:**
- [ ] Hamburger menu icon on mobile
- [ ] Slide-out drawer or dropdown menu
- [ ] All navigation links accessible
- [ ] Balance displayed in mobile nav
- [ ] Close on navigation
- [ ] Close on outside click

---

### USER-12: Create Error Boundary Component

**As a** user  
**I want** graceful error handling  
**So that** the app doesn't crash completely on errors

**Acceptance Criteria:**
- [ ] Create `src/components/ErrorBoundary.tsx`
- [ ] Catch JavaScript errors in component tree
- [ ] Display friendly error message
- [ ] Provide "Try Again" / "Go Home" buttons
- [ ] Log errors to monitoring service (optional)
- [ ] Preserve navigation ability
- [ ] Different styles for different error types

**References:** FRONTEND_STATE.md Section 8

---

### USER-13: Implement Accessibility (a11y) Standards

**As a** user with accessibility needs  
**I want** the application to be fully accessible  
**So that** I can use it with assistive technologies

**Acceptance Criteria:**
- [ ] All interactive elements keyboard navigable
- [ ] Proper focus management on modals
- [ ] ARIA labels on all buttons and inputs
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announcements for dynamic content
- [ ] Skip to main content link
- [ ] Form error announcements
- [ ] Trade confirmation announced to screen readers

---

### USER-14: Create Network Status Indicator

**As a** user  
**I want** to know when I'm offline or have connectivity issues  
**So that** I understand why actions might fail

**Acceptance Criteria:**
- [ ] Detect online/offline status
- [ ] Show banner when offline
- [ ] Queue actions while offline (optional)
- [ ] Show reconnection status
- [ ] Different indicator from WebSocket status

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

### MARKET-7: Add Market Search

**As a** user  
**I want** to search markets by title  
**So that** I can find specific markets quickly

**Acceptance Criteria:**
- [ ] Search input in markets page header
- [ ] Debounce search input (300ms)
- [ ] Update URL search params with query
- [ ] Search server-side (not client filter)
- [ ] Clear search button
- [ ] Show "No results" message when empty

---

### MARKET-8: Add Category Filter

**As a** user  
**I want** to filter markets by category  
**So that** I can browse specific topics

**Acceptance Criteria:**
- [ ] Category chips/pills below search
- [ ] "All" option to clear filter
- [ ] Combine with status filter
- [ ] Update URL search params
- [ ] Categories fetched from backend or defined in config

**Default Categories:**
- Sports, Politics, Crypto, Technology, Entertainment, Weather, Other

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

### DETAIL-7: Add Price Chart Time Interval Selector

**As a** user  
**I want** to select different time intervals for the price chart  
**So that** I can analyze short-term and long-term trends

**Acceptance Criteria:**
- [ ] Interval buttons: 1H, 24H, 7D, 30D, All
- [ ] Update chart data when interval changes
- [ ] Remember user preference (localStorage)
- [ ] Loading state while fetching new data
- [ ] Disable intervals with insufficient data

**References:** API_SPECIFICATION.md Section 4.3.3

---

### DETAIL-8: Show Market Creator Info

**As a** user  
**I want** to see who created the market  
**So that** I can assess the market's credibility

**Acceptance Criteria:**
- [ ] Display creator's display name or "Admin"
- [ ] Show creation date
- [ ] Admin badge if created by admin
- [ ] Link to view creator's other markets (optional)

---

### DETAIL-9: Create Recent Trades Component

**As a** user  
**I want** to see recent trades in the market  
**So that** I can gauge market activity and trends

**Acceptance Criteria:**
- [ ] Create `src/components/market/RecentTrades.tsx`
- [ ] List last 10-20 trades
- [ ] Show time, side (YES/NO), amount, and price
- [ ] Color code by side (Green/Red)
- [ ] Animate new trades entering the list
- [ ] Update in real-time via WebSocket

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

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

### TRADEUI-8: Show Price Impact Warning

**As a** user  
**I want** to be warned about high price impact  
**So that** I don't accidentally make unfavorable trades

**Acceptance Criteria:**
- [ ] Calculate price impact from quote
- [ ] Show warning when impact > 1%
- [ ] Show strong warning when impact > 5%
- [ ] Block or require confirmation when impact > 10%
- [ ] Explain price impact in tooltip
- [ ] Suggest smaller trade size

**References:** ENGINE_LOGIC.md Section 5, EDGE_CASES.md Section 3.2

---

### TRADEUI-9: Add Slippage Tolerance Settings

**As a** user  
**I want** to configure my slippage tolerance  
**So that** I can control trade execution parameters

**Acceptance Criteria:**
- [ ] Slippage tolerance setting (0.5%, 1%, 2%, custom)
- [ ] Store preference in localStorage
- [ ] Use setting to calculate minSharesOut/minAmountOut
- [ ] Show estimated slippage in trade preview
- [ ] Warning if slippage setting is very high

**References:** API_SPECIFICATION.md Section 4.4.1

---

### TRADEUI-10: Add Trade Confirmation Modal

**As a** user  
**I want** to confirm large trades before execution  
**So that** I don't accidentally make significant trades

**Acceptance Criteria:**
- [ ] Show confirmation modal for trades > threshold (e.g., 100 Points)
- [ ] Display full trade details
- [ ] Show price impact and fees
- [ ] Require explicit confirmation
- [ ] Optional "Don't show again" checkbox for session

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

### PORT-7: Create Empty State Components

**As a** user  
**I want** helpful empty states  
**So that** I know what to do when I have no data

**Acceptance Criteria:**
- [ ] Empty portfolio: "You don't have any positions yet"
- [ ] Empty trade history: "No trades yet"
- [ ] CTA button linking to markets page
- [ ] Illustration/icon for visual appeal
- [ ] Different message for filtered empty results

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

### ADMIN-5: Create Admin Dashboard Content

**As an** admin  
**I want** a dashboard with key metrics  
**So that** I can monitor platform health

**Route:** `/admin` (dashboard section)

**Acceptance Criteria:**
- [ ] Total users count
- [ ] Active markets count
- [ ] 24h trading volume
- [ ] Recent trades list (last 10)
- [ ] Markets pending resolution
- [ ] Quick action buttons (Create Market, Grant Points)
- [ ] Auto-refresh data every 60 seconds

**Metrics Cards:**
```
[ Total Users: 1,234 ]  [ Active Markets: 12 ]
[ 24h Volume: $15,000 ] [ Pending Resolution: 3 ]
```

---

### ADMIN-6: Create Market Creation Form

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

### ADMIN-7: Create Markets Management Table

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

### ADMIN-8: Implement Skewed Genesis Option

**As an** admin  
**I want** to create markets with non-50/50 starting probabilities  
**So that** I can seed markets closer to expected outcomes

**Endpoint:** `POST /v1/admin/markets` (additional parameter)

**Request Addition:**
```json
{
  "initialYesPrice": 0.75
}
```

**Acceptance Criteria:**
- [ ] Accept optional `initialYesPrice` parameter (0.01-0.99)
- [ ] Calculate appropriate YES/NO quantities for target price
- [ ] Validate price is within allowed range
- [ ] Display initial probability in creation form
- [ ] Preview shows expected starting prices

**References:** ENGINE_LOGIC.md Section 8 (genesisMarketSkewed)

---

### ADMIN-9: Implement Market Image Upload

**As an** admin  
**I want** to upload images for markets  
**So that** markets have visual appeal

**Acceptance Criteria:**
- [ ] Image upload component in market creation form
- [ ] Accept JPEG, PNG, WebP formats
- [ ] Max file size: 5MB
- [ ] Image preview before upload
- [ ] Store in Supabase Storage
- [ ] Generate and store public URL
- [ ] Image optimization/resize (optional)

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

### ADMIN-14: Implement GET /admin/users

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

### ADMIN-15: Implement GET /admin/users/:id

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

### ADMIN-16: Create Users Management Table

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

### ADMIN-17: Implement Market Edit Endpoint

**As an** admin  
**I want** to edit market details  
**So that** I can fix typos or update information before activation

**Endpoint:** `PATCH /v1/admin/markets/:id`

**Request:**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "category": "New Category",
  "imageUrl": "https://new-url.com/image.jpg",
  "closesAt": "2024-12-15T23:59:59Z"
}
```

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Only allow editing DRAFT markets
- [ ] Validate all fields
- [ ] Cannot change market ID
- [ ] Log edit action
- [ ] Return updated market

**Errors:**
- MARKET_NOT_FOUND (404)
- MARKET_NOT_EDITABLE (400) - if not DRAFT status

---

### ADMIN-18: Create Market Edit Form

**As an** admin  
**I want** a form to edit existing markets  
**So that** I can correct information before going live

**Acceptance Criteria:**
- [ ] Pre-populate form with existing market data
- [ ] Only available for DRAFT markets
- [ ] Same validation as creation form
- [ ] Show diff/changes before submit
- [ ] Success feedback after save

---

### ADMIN-19: Implement Admin Stats Endpoint

**As an** admin  
**I want** platform statistics  
**So that** I can view them on the dashboard

**Endpoint:** `GET /v1/admin/stats`

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Return aggregated statistics:
  - Total users count
  - Active users (traded in last 7 days)
  - Active markets count
  - Pending resolution count
  - 24h trading volume
  - Total trading volume
- [ ] Cache results for 1 minute

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1234,
      "activeLastWeek": 456
    },
    "markets": {
      "total": 50,
      "active": 12,
      "pendingResolution": 3,
      "resolved": 30,
      "cancelled": 5
    },
    "volume": {
      "total": "50000000000",
      "last24h": "1500000000"
    }
  }
}
```

---

### ADMIN-20: Implement GET /admin/markets Endpoint

**As an** admin  
**I want** to list all markets with admin details  
**So that** I can manage them effectively

**Endpoint:** `GET /v1/admin/markets`

**Query Params:**
- `status` - filter by any status including DRAFT
- `page`, `pageSize`
- `search` - search by title

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Include DRAFT markets (not visible to public)
- [ ] Include creation info (who created, when)
- [ ] Include holder count per market
- [ ] Include total volume per market
- [ ] Paginated response

**Response includes per market:**
```json
{
  "id": "mkt_abc",
  "title": "...",
  "status": "DRAFT",
  "createdBy": { "id": "...", "email": "admin@..." },
  "holdersCount": 45,
  "totalVolume": "5000000",
  "pool": { "yesQty": "...", "noQty": "..." }
}
```

---

### ADMIN-21: Implement Admin Audit Log

**As an** admin  
**I want** to view an audit log of all admin actions  
**So that** I can track changes and ensure accountability

**Endpoint:** `GET /v1/admin/audit-log`

**Query Params:**
- `adminId` - filter by admin user
- `action` - filter by action type
- `startDate`, `endDate`
- `page`, `pageSize`

**Actions to Log:**
- Market created
- Market activated/paused/resumed
- Market resolved/cancelled
- Points granted
- User role changed
- Market edited

**Acceptance Criteria:**
- [ ] Log all admin actions with timestamp
- [ ] Include admin user who performed action
- [ ] Include affected entity (market/user ID)
- [ ] Include before/after values where applicable
- [ ] Paginated, filterable response
- [ ] Immutable audit trail

**References:** EDGE_CASES.md Section 5.5

---

### ADMIN-22: Create Audit Log Viewer

**As an** admin  
**I want** a UI to browse the audit log  
**So that** I can review admin activity

**Acceptance Criteria:**
- [ ] Table with audit entries
- [ ] Columns: Timestamp, Admin, Action, Target, Details
- [ ] Filter by date range
- [ ] Filter by admin user
- [ ] Filter by action type
- [ ] Export to CSV option
- [ ] Pagination

---

### ADMIN-23: Implement Categories Management

**As an** admin  
**I want** to manage market categories  
**So that** I can organize markets effectively

**Endpoints:**
- `GET /v1/admin/categories` - List all categories
- `POST /v1/admin/categories` - Create category
- `PATCH /v1/admin/categories/:id` - Update category
- `DELETE /v1/admin/categories/:id` - Soft delete category

**Acceptance Criteria:**
- [ ] Require admin role for all operations
- [ ] Categories have: id, name, slug, description, sortOrder, isActive
- [ ] Cannot delete category with active markets
- [ ] UI for category CRUD operations

---

### ADMIN-24: Implement Market Close Time Extension

**As an** admin  
**I want** to extend a market's close time  
**So that** I can handle delayed event outcomes

**Endpoint:** `PATCH /v1/admin/markets/:id/extend`

**Request:**
```json
{
  "newClosesAt": "2024-12-20T23:59:59Z",
  "reason": "Event delayed due to weather"
}
```

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Market must be ACTIVE
- [ ] New time must be in the future
- [ ] New time must be after current closesAt
- [ ] Notify market subscribers via WebSocket
- [ ] Log extension in audit trail

**References:** EDGE_CASES.md Section 7.4

---

## Market Scheduler Worker

> **Architecture Decision:** Markets have a `closes_at` timestamp, but runtime checks alone are insufficient. A background worker is required to automatically transition market status and alert admins.

### SCHEDULER-1: Implement Market Scheduler Infrastructure

**As a** platform operator  
**I want** a background scheduler/worker system  
**So that** market lifecycle events happen automatically

**Acceptance Criteria:**
- [ ] Choose scheduler technology (node-cron, BullMQ+Redis, pg_cron, or Supabase Edge Functions)
- [ ] Implement job idempotency
- [ ] Add job execution logging
- [ ] Handle job failures with retries
- [ ] Create health check endpoint for worker process

**References:** SYSTEM_DESIGN.md Section 5.5, EDGE_CASES.md Section 6.2

---

### SCHEDULER-2: Implement Auto-Close Markets Job

**As a** platform operator  
**I want** markets to auto-close when `closes_at` passes  
**So that** users cannot trade on expired markets

**Job:** `checkExpiredMarkets` (every 1 minute)

**Acceptance Criteria:**
- [ ] Query markets WHERE `status = 'ACTIVE' AND closes_at < NOW()`
- [ ] Transition expired markets: `ACTIVE` → `PAUSED`
- [ ] Log state transition in audit trail
- [ ] Emit WebSocket event: `market:closed`
- [ ] Notify admins about newly closed markets
- [ ] Job must be idempotent

---

### SCHEDULER-3: Implement Pending Resolution Alerts

**As an** admin  
**I want** alerts about markets awaiting resolution  
**So that** user funds aren't locked indefinitely

**Job:** `alertPendingResolution` (every 1 hour)

**Acceptance Criteria:**
- [ ] Query paused markets closed > 24 hours ago
- [ ] Send escalated notifications (24h, 48h levels)
- [ ] Dashboard widget showing pending resolutions

---

### SCHEDULER-4: Implement Admin Dashboard - Pending Resolutions Widget

**As an** admin  
**I want** a dashboard widget for pending resolutions  
**So that** I can quickly see what needs attention

**Acceptance Criteria:**
- [ ] Widget sorted by urgency (oldest first)
- [ ] Show market title, time since closed, holder count, value locked
- [ ] Color coding: Green (<24h), Yellow (24-48h), Red (>48h)
- [ ] One-click access to resolution form

---

### SCHEDULER-5: Implement Scheduled Market Activation

**As an** admin  
**I want** to schedule markets to activate automatically  
**So that** I can prepare markets in advance

**Acceptance Criteria:**
- [ ] Add `activates_at` column to markets table
- [ ] Scheduler job activates markets when `activates_at < NOW()`
- [ ] Admin can override and manually activate earlier
- [ ] UI shows countdown to activation

---

### SCHEDULER-6: Implement Cleanup Job for Expired Tokens

**As a** platform operator  
**I want** expired tokens cleaned up automatically  
**So that** the database doesn't grow indefinitely

**Job:** `cleanupExpiredTokens` (daily 3 AM UTC)

**Acceptance Criteria:**
- [ ] Delete refresh_tokens WHERE `expires_at < NOW() - INTERVAL '7 days'`
- [ ] Log number of tokens deleted

---

### SCHEDULER-7: Add Worker to Development Environment

**As a** developer  
**I want** the scheduler to run in development  
**So that** I can test scheduled jobs locally

**Acceptance Criteria:**
- [ ] Update `npm run dev:backend` to include scheduler
- [ ] Add environment variable `ENABLE_SCHEDULER=true/false`
- [ ] Add CLI commands to manually trigger jobs for testing

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
- [ ] On `market_resolved`: Invalidate market queries and portfolio
- [ ] Use `queryClient.setQueryData` for instant updates
- [ ] Use `queryClient.invalidateQueries` for refetch

**References:** FRONTEND_STATE.md Section 5.1, WEBSOCKET_PROTOCOL.md Section 5.2

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

### WS-8: Show Connection Status Indicator

**As a** user  
**I want** to see my connection status  
**So that** I know if real-time data is working

**Acceptance Criteria:**
- [ ] Connection status indicator in header
- [ ] States: Connected (green), Connecting (yellow), Disconnected (red)
- [ ] Tooltip with status details
- [ ] Reconnection attempt indicator
- [ ] Manual reconnect button when disconnected

---

### WS-9: Handle Live Trade Broadcasts

**As a** user  
**I want** to see trades happen in real-time  
**So that** the market feels alive

**Acceptance Criteria:**
- [ ] Listen for `trade` messages on market channel
- [ ] Update RecentTrades component list
- [ ] Flash/highlight the new trade
- [ ] Limit list size (keep last 20-50) in state
- [ ] Handle high frequency updates efficiently

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

---

### WS-10: Handle New Market Notifications

**As a** user  
**I want** to know when new markets are created  
**So that** I can be one of the first to trade

**Acceptance Criteria:**
- [ ] Listen for `new_market` messages on global channel
- [ ] Show toast notification with market title
- [ ] Option to click toast to go to market
- [ ] Add to markets list cache if on markets page

**References:** WEBSOCKET_PROTOCOL.md Section 5.4

---

### WS-11: Handle Market State Updates

**As a** user  
**I want** the UI to react to market state changes  
**So that** I don't try to trade on closed markets

**Acceptance Criteria:**
- [ ] Listen for `market_state` and `market_resolved` messages
- [ ] Update market status badge immediately
- [ ] Disable TradeForm if paused/resolved
- [ ] Show resolution banner if resolved
- [ ] Refresh market data to get full state

**References:** WEBSOCKET_PROTOCOL.md Section 5.2

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
| 0 | 18 | Project Setup (infrastructure, Supabase CLI, testing, CI/CD, DI container, **BullMQ job queue**) |
| 1 | 12 | Authentication (login, register, session, password reset, email templates) |
| 2 | 14 | User Profile & Balance (UI components, accessibility, error handling) |
| 3 | 8 | Markets Listing (search, filter, categories) |
| 4 | 9 | Market Detail (chart, metadata, time intervals, recent trades) |
| 5 | 7 | Trading Engine (CPMM, fees, validation) |
| 6 | 10 | Trading UI (form, slippage, price impact, confirmation) |
| 7 | 4 | Mint & Merge (netting protocol) |
| 8 | 7 | Portfolio (positions, P&L, history, empty states) |
| 9 | 9 | Admin - Market Management (CRUD, skewed genesis, images) |
| 10 | 23 | Admin - Resolution, Points, Users, Audit, **Scheduler Worker** (resolve, cancel, grant, users, audit log, categories, auto-close markets) |
| 11 | 11 | WebSocket (connection, channels, reconnect, updates) |
| 12 | 1 | Webhooks (Future) |
| **Total** | **133** | |

---

## Implementation Priority

### Phase 1: Foundation (MVP Core)
1. Epic 0 (SETUP-1 through SETUP-6) - Project setup with Supabase CLI
2. Epic 0 (JOBS-1 through JOBS-4) - **BullMQ + Redis job queue infrastructure**
3. Epic 1 (AUTH-1 through AUTH-4) - Backend auth
4. Epic 5 (TRADE-1 through TRADE-7) - Trading engine
5. Epic 3 (MARKET-1, MARKET-2) - Markets API

### Phase 2: Basic UI
1. Epic 0 (SETUP-7 through SETUP-13) - Infrastructure, testing & CI/CD
2. Epic 1 (AUTH-5 through AUTH-9) - Frontend auth
3. Epic 3 (MARKET-3 through MARKET-8) - Markets UI
4. Epic 2 (USER-1 through USER-5) - User profile

### Phase 3: Trading Flow
1. Epic 4 (DETAIL-1 through DETAIL-8) - Market detail page
2. Epic 6 (TRADEUI-1 through TRADEUI-7) - Core trading UI
3. Epic 7 (MINT-1 through MINT-4) - Mint & merge
4. Epic 8 (PORT-1 through PORT-7) - Portfolio

### Phase 4: Admin & Resolution
1. Epic 9 (ADMIN-1 through ADMIN-9) - Admin market management
2. Epic 10 (RESOLVE-1 through RESOLVE-5, ADMIN-14 through ADMIN-24) - Resolution, points, user management, audit
3. Epic 10 (SCHEDULER-1 through SCHEDULER-7) - **Market Scheduler Worker** (auto-close markets, pending resolution alerts)

### Phase 5: Real-Time & Polish
1. Epic 11 (WS-1 through WS-8) - WebSocket real-time updates
2. Epic 6 (TRADEUI-8 through TRADEUI-10) - Price impact, slippage, confirmations
3. Epic 2 (USER-6 through USER-14) - UI polish, accessibility, error handling
4. Epic 1 (AUTH-10, AUTH-11) - Password reset, session handling

### Phase 6: Advanced Features (Optional)
1. Epic 12 - Webhooks
2. Admin advanced: Categories management (ADMIN-23), audit log viewer (ADMIN-22)

---

*Document Version: 1.5 | Total Stories: 133 | Last Reviewed: December 9, 2025*
