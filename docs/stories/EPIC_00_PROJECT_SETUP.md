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
- [x] Install Supabase CLI globally (`npm i -g supabase`) or use `npx`
- [x] Initialize Supabase in project root: `supabase init`
- [x] Create `supabase/config.toml` with project configuration
- [x] Set up local development environment:
  - `supabase start` - starts local PostgreSQL, Auth, Storage, Studio
  - `supabase stop` - stops local services
  - `supabase status` - shows local service URLs and keys
- [x] Create .env.example with all required variables:
  - SUPABASE_URL (local: http://127.0.0.1:55321)
  - SUPABASE_ANON_KEY (from `supabase status`)
  - SUPABASE_SERVICE_ROLE_KEY (from `supabase status`)
  - DATABASE_URL (local: postgresql://postgres:postgres@127.0.0.1:55326/postgres)
- [x] Create .env.local for local development with CLI-generated keys
- [x] Document Supabase Studio access (http://127.0.0.1:55323)
- [x] Configure connection pooling settings for production

**Local Services (via `supabase start`):**
- PostgreSQL: 127.0.0.1:55326
- API: 127.0.0.1:55321
- Studio: 127.0.0.1:55323
- Inbucket (email): 127.0.0.1:55324

**References:** SYSTEM_DESIGN.md Section 2.2, DATABASE_SCHEMA.md Section 4.2-4.4

---

### SETUP-3: Create Database Schema & Migrations

**As a** developer  
**I want** complete database schema with Drizzle ORM and Supabase migrations  
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
- [ ] Create migrations using Supabase CLI:
  - `supabase migration new <name>` - create new migration
  - Place SQL in `supabase/migrations/` directory
  - `supabase db reset` - reset local DB and run all migrations
  - `supabase db push` - push migrations to remote (staging/prod)
- [ ] Create seed data script: `supabase/seed.sql`

**Migration Workflow:**
```bash
# Create new migration
supabase migration new create_markets_table

# Edit supabase/migrations/<timestamp>_create_markets_table.sql

# Apply to local database
supabase db reset

# Generate Drizzle types from DB
npx drizzle-kit introspect

# Push to remote when ready
supabase db push
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
    "db:reset": "supabase db reset",
    "db:migrate": "supabase migration new",
    "db:studio": "open http://localhost:54323",
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
  - Run `supabase db push` to apply migrations
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