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
  - fastify ^5.6.2
  - @fastify/cookie, @fastify/cors, @fastify/websocket, @fastify/rate-limit
  - awilix, @fastify/awilix (dependency injection)
  - drizzle-orm, postgres
  - @supabase/ssr, @supabase/supabase-js
  - zod for validation
  - tsx for development
  - vitest for testing
  - bullmq ^5.65.1, ioredis ^5.8.2 (for background job processing - see JOBS-1)
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
  - REDIS_URL (local: redis://localhost:6379)
  - WORKER_CONCURRENCY (default: 10)
  - ENABLE_WORKER (default: true)
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
**I want** complete database schema with Drizzle ORM and drizzle-kit migrations  
**So that** all tables are properly defined with version-controlled migrations

**Acceptance Criteria:**
- [x] Create Drizzle schema file with all tables:
  - `users` - User profiles with balance (extends Supabase auth.users)
  - `markets` - Binary prediction markets
  - `liquidity_pools` - CPMM pool state per market
  - `portfolios` - User positions with cost basis
  - `trade_ledger` - Immutable audit trail
  - `point_grants` - Audit trail for point grants
  > **Note:** Refresh tokens are managed by Supabase Auth internally - no custom table needed.
- [x] Define all constraints:
  - Non-negative balance/shares checks
  - Valid status/role enums
  - Resolution consistency constraints
- [x] Create all indexes per DATABASE_SCHEMA.md Section 5
- [x] Define Drizzle relations
- [x] Export inferred TypeScript types
- [x] Create migrations using drizzle-kit:
  - `npx drizzle-kit generate` - generate SQL migrations from schema changes
  - Place migrations in `backend/drizzle/` directory (configured in drizzle.config.ts)
  - `npx drizzle-kit migrate` - apply pending migrations to database
  - `npx drizzle-kit push` - push schema changes directly (dev only)
- [x] Create seed data script: `backend/src/infrastructure/database/seed.ts`

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
- [x] Initialize TanStack Start project using CLI:
  ```bash
  # Run from project root - creates frontend/ directory
  npm create @tanstack/start@latest frontend
  
  # CLI will prompt for options:
  # - Project name: frontend
  # - Add Tailwind CSS? Yes
  # - Add ESLint? Yes
  # - Package manager: npm
  ```
- [x] Configure SPA mode in `frontend/vite.config.ts`:
  ```typescript
  import { defineConfig } from 'vite'
  import { tanstackStart } from '@tanstack/react-start/plugin/vite'

  export default defineConfig({
    plugins: [
      tanstackStart({
        spa: {
          enabled: true,
        },
      }),
    ],
  })
  ```
- [x] Install additional dependencies:
  ```bash
  cd frontend
  npm install @tanstack/react-query @tanstack/react-form
  npm install recharts lucide-react
  npm install zod clsx tailwind-merge
  npm install @supabase/ssr @supabase/supabase-js
  ```
- [x] Configure API proxy for development in `frontend/vite.config.ts`:
  ```typescript
  export default defineConfig({
    plugins: [
      tanstackStart({
        spa: { enabled: true },
      }),
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:4000',
          ws: true,
        },
      },
    },
  })
  ```
- [x] Set up file-based routing structure:
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
- [x] Configure QueryClient in root route

**SPA Mode Benefits:**
- Easier deployment to CDN (static hosting)
- No SSR complexity
- Still supports server functions for API calls
- Shell prerendering for faster initial load

**CLI Reference:** https://tanstack.com/start/latest/docs/framework/react/quick-start
**SPA Mode Reference:** https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode

**References:** FRONTEND_ARCHITECTURE.md Sections 2-5

---

### SETUP-5: Configure Tailwind CSS & Base UI Components

**As a** developer  
**I want** Tailwind CSS v4 and base UI components  
**So that** I have a consistent design system

**Acceptance Criteria:**
- [x] Install and configure Tailwind CSS v4
- [x] Define color palette (dark theme):
  - Background: #0a0a0f, #12121a, #1a1a24, #22222e
  - Text: #f0f0f5, #a0a0b0, #606070
  - Accent: #3b82f6 (blue), #8b5cf6 (purple)
  - YES color: #22c55e (green)
  - NO color: #ef4444 (red)
- [x] Create base UI components:
  - Button (primary, secondary, ghost, danger, yes, no variants)
  - Input (with label, error, hint)
  - Card (default, elevated, outlined)
  - Modal (with Dialog)
  - Spinner
- [x] Create utility functions:
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
- [x] Create root package.json with workspace scripts
- [x] Configure backend dev server on port 4000
- [x] Configure frontend dev server on port 3000
- [x] Set up Vite proxy for /api -> localhost:4000
- [x] Set up Vite proxy for /ws -> ws://localhost:4000
- [x] Create comprehensive README.md with setup instructions
- [x] Document required environment variables
- [x] Create `dev` script that starts all services

**Development Scripts (root package.json):**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:db\" \"npm run dev:backend\" \"npm run dev:worker\" \"npm run dev:frontend\"",
    "dev:db": "supabase start",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:worker": "npm run worker:dev --workspace=backend",
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
- Supabase API: http://localhost:55321
- Supabase Studio: http://localhost:55323
- Inbucket (email testing): http://localhost:55324

**References:** FRONTEND_ARCHITECTURE.md Section 8

---

### SETUP-7: Configure Backend Error Handling

**As a** backend developer  
**I want** centralized error handling  
**So that** errors are handled consistently

**Acceptance Criteria:**
- [x] Create error handler middleware
- [x] Map domain errors to HTTP status codes
- [x] Return consistent error response format
- [x] Log errors appropriately (don't log expected errors)
- [x] Handle Zod validation errors
- [x] Handle unknown errors gracefully

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
- [x] Install @fastify/rate-limit or similar
- [x] Configure limits per endpoint type:
  - Public: 100 req/min per IP
  - Authenticated: 60 req/min per user
  - Trading: 30 req/min per user
  - Admin: 120 req/min per user
- [x] Return rate limit headers (X-RateLimit-*)
- [x] Return 429 with Retry-After header when exceeded

**Implementation Details:**
- Installed `@fastify/rate-limit@10.3.0` (latest version)
- **Using Redis backend for production-ready distributed rate limiting**
- Created `src/presentation/fastify/plugins/rate-limit.ts` with:
  - Rate limit plugin registration with Redis integration
  - Four predefined rate limit types (PUBLIC, AUTHENTICATED, TRADING, ADMIN)
  - Smart key generation (user ID for authenticated, IP for public)
  - Proper error response format matching API specification
  - Graceful degradation if Redis unavailable
  - Optimized Redis connection settings
- Updated `src/main.ts` to register rate limiting plugin
- Created comprehensive test suite in `test/rate-limit.test.ts`
- Created usage examples in `src/presentation/fastify/examples/rate-limit-examples.ts`
- Created documentation in `src/presentation/fastify/plugins/RATE_LIMIT.md`
- Updated error handler to properly format rate limit errors with Retry-After header
- All rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) are included in responses
- **Added REDIS_URL to .env.example and .env.local**

**Production Readiness:**
- ✅ Redis backend for distributed systems
- ✅ Horizontal scaling ready (multiple API instances share state)
- ✅ Graceful degradation on Redis failure
- ✅ Optimized for rate limiting workload

**Usage:**
```typescript
import { withRateLimit, RateLimitType } from './presentation/fastify/plugins/rate-limit';

fastify.get('/api/markets', withRateLimit(RateLimitType.PUBLIC), handler);
fastify.post('/api/trades/buy', withRateLimit(RateLimitType.TRADING), handler);
```

**References:** API_SPECIFICATION.md Section 6

---

### SETUP-9: Configure Structured Logging

**As a** backend developer  
**I want** structured JSON logging  
**So that** logs are searchable and analyzable

**Acceptance Criteria:**
- [x] Use Pino logger (Fastify default)
- [x] Log level based on environment
- [x] Include requestId in all logs
- [x] Include userId when authenticated
- [x] Never log sensitive data (passwords, tokens)
- [x] Log trade executions with amounts

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
- [x] Install Awilix + @fastify/awilix for dependency injection
- [x] Create `src/shared/container/types.ts` with TypeScript interfaces
- [x] Create `src/shared/container/index.ts` with composition root
- [x] Integrate with Fastify via `registerContainer()` in `src/main.ts`
- [x] Register database connection as singleton
- [x] Document the pattern for adding new dependencies
- [x] Enable easy mocking for unit tests via container scopes

**Library Choice: Awilix + @fastify/awilix**

We use [Awilix](https://github.com/jeffijoe/awilix) with the official [@fastify/awilix](https://github.com/fastify/fastify-awilix) plugin because:
- ✅ Battle-tested (~320k weekly downloads)
- ✅ Official Fastify plugin with first-class integration
- ✅ Request-scoped containers built-in
- ✅ Automatic resource disposal on request/app close
- ✅ No decorators required - clean, composable code
- ✅ Excellent TypeScript support

**Lifetimes:**
- `SINGLETON`: One instance for the entire application (db, redis)
- `SCOPED`: One instance per request (use cases with request context)
- `TRANSIENT`: New instance every time resolved

**Implementation:**
```typescript
// src/shared/container/types.ts - Define dependencies
export interface AppCradle {
  db: DrizzleDB;
  userRepository: UserRepository;
  tradingService: TradingService;
}

// Module augmentation for type-safe resolution
declare module '@fastify/awilix' {
  interface Cradle extends AppCradle {}
}

// src/shared/container/index.ts - Register dependencies
import { asValue, asClass } from 'awilix';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';

diContainer.register({
  db: asValue(db),
  userRepository: asClass(PostgresUserRepository).singleton(),
  tradingService: asClass(TradingService).scoped(),
});

// Usage in routes - type-safe resolution
app.get('/users/:id', async (request) => {
  const userRepo = request.diScope.resolve('userRepository');
  return userRepo.findById(request.params.id);
});
```

**Files:**
- `src/shared/container/types.ts` - TypeScript interfaces for dependencies
- `src/shared/container/index.ts` - Composition root, registration logic

**References:** BACKEND_ARCHITECTURE.md Section 8

---

## Background Job Infrastructure (BullMQ + Redis)

> **Architecture Decision:** Use BullMQ + Redis as the generic, reusable job queue infrastructure for all background processing. This is foundational infrastructure that will be used by market scheduling, notifications, analytics, and future features.

### JOBS-1: Set Up Redis Connection & BullMQ Infrastructure

**As a** backend developer  
**I want** a generic job queue infrastructure  
**So that** we can run background tasks reliably and reuse it across features

**Acceptance Criteria:**
- [ ] Add dependencies: `bullmq`, `ioredis`
- [ ] Create Redis connection utility: `src/infrastructure/redis/connection.ts`
- [ ] Create queue factory: `src/infrastructure/jobs/queue-factory.ts`
- [ ] Create worker factory: `src/infrastructure/jobs/worker-factory.ts`
- [ ] Create QueueService for adding jobs: `src/infrastructure/jobs/queue-service.ts`
- [ ] Add environment variables:
  ```bash
  REDIS_URL=redis://localhost:6379
  REDIS_PASSWORD=
  WORKER_CONCURRENCY=10
  ENABLE_WORKER=true
  ```
- [ ] Create connection health check
- [ ] Handle Redis connection errors gracefully

**Folder Structure:**
```
src/infrastructure/
├── redis/
│   └── connection.ts        # Redis client singleton
└── jobs/
    ├── queue-factory.ts     # Creates named queues
    ├── worker-factory.ts    # Creates workers with handlers
    ├── queue-service.ts     # High-level API for adding jobs
    ├── types.ts             # Job type definitions
    └── handlers/            # Job handler implementations
        ├── index.ts         # Handler registry
        ├── market.ts        # Market-related jobs
        ├── notifications.ts # Notification jobs
        └── maintenance.ts   # System maintenance jobs
```

**QueueService Interface:**
```typescript
interface QueueService {
  // Add a single job
  add<T>(queue: string, job: T, options?: JobOptions): Promise<Job>;
  
  // Add a repeatable job (cron-style)
  addRepeatable<T>(queue: string, job: T, repeat: RepeatOptions): Promise<Job>;
  
  // Remove a repeatable job
  removeRepeatable(queue: string, jobName: string): Promise<void>;
  
  // Get queue stats
  getStats(queue: string): Promise<QueueStats>;
}
```

**References:** SYSTEM_DESIGN.md Section 5.5

---

### JOBS-2: Create Worker Process Entry Point

**As a** backend developer  
**I want** a separate worker process  
**So that** background jobs don't affect API performance

**Acceptance Criteria:**
- [ ] Create worker entry point: `src/worker.ts`
- [ ] Register all job handlers on startup
- [ ] Graceful shutdown handling (finish current jobs)
- [ ] Add npm script: `"worker": "tsx src/worker.ts"`
- [ ] Add npm script: `"worker:dev": "tsx watch src/worker.ts"`
- [ ] Log job start, completion, and failures
- [ ] Emit metrics for job processing times
- [ ] Health check endpoint for worker process

**Worker Entry Point:**
```typescript
// src/worker.ts
import { createWorkers } from './infrastructure/jobs/worker-factory';
import { marketHandlers } from './infrastructure/jobs/handlers/market';
import { notificationHandlers } from './infrastructure/jobs/handlers/notifications';
import { maintenanceHandlers } from './infrastructure/jobs/handlers/maintenance';

const workers = createWorkers({
  'market-ops': marketHandlers,
  'notifications': notificationHandlers,
  'maintenance': maintenanceHandlers,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
});
```

**Development Scripts (package.json):**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:worker\"",
    "dev:api": "tsx watch src/main.ts",
    "dev:worker": "tsx watch src/worker.ts",
    "worker": "tsx src/worker.ts",
    "worker:prod": "node dist/worker.js"
  }
}
```

---

### JOBS-3: Add Job Queue to Development Environment

**As a** developer  
**I want** Redis and the worker running locally  
**So that** I can test background jobs during development

**Acceptance Criteria:**
- [ ] Add Redis to local development (Docker or Supabase self-hosted)
- [ ] Update `supabase/config.toml` or create `docker-compose.yml` for Redis
- [ ] Update root `package.json` dev script to start Redis
- [ ] Create CLI commands for job management:
  ```bash
  npm run job:trigger <queue> <jobType>  # Manually trigger a job
  npm run job:stats                       # Show queue statistics
  npm run job:clear <queue>              # Clear failed jobs
  ```
- [ ] Add BullMQ Board (optional) for visual queue management
- [ ] Document job testing workflow in README

**Docker Compose (if not using Supabase Redis):**
```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

**Development URLs:**
- Redis: `redis://localhost:6379`
- BullMQ Board (optional): `http://localhost:3001/admin/queues`

---

### JOBS-4: Implement Job Monitoring & Observability

**As a** platform operator  
**I want** visibility into job queue health  
**So that** I can detect and fix issues quickly

**Acceptance Criteria:**
- [ ] Expose queue metrics:
  - `jobs_processed_total` (counter, by queue and status)
  - `jobs_processing_duration_seconds` (histogram)
  - `jobs_waiting_count` (gauge, per queue)
  - `jobs_failed_total` (counter)
- [ ] Add health check endpoint: `GET /health/worker`
- [ ] Log job failures with full context
- [ ] Alert on:
  - Job failure rate > 5%
  - Queue depth > 1000 jobs
  - Job processing time > 5 minutes
- [ ] Optional: BullMQ Board integration for admin UI

**Health Check Response:**
```json
{
  "status": "healthy",
  "queues": {
    "market-ops": { "waiting": 0, "active": 1, "failed": 0 },
    "notifications": { "waiting": 5, "active": 2, "failed": 0 },
    "maintenance": { "waiting": 0, "active": 0, "failed": 0 }
  },
  "redis": { "status": "connected", "latency": 2 }
}
```

**References:** SYSTEM_DESIGN.md Section 8

---