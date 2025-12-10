# Backend AGENTS.md

Backend-specific instructions for AI agents. See also: [Root AGENTS.md](../AGENTS.md)

---

## 📁 Directory Structure

```
backend/
├── src/
│   ├── bootstrap.ts              # Entry point (loads env first!)
│   ├── main.ts                   # Fastify server setup
│   ├── domain/                   # Pure business logic (NO deps)
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── services/
│   │   ├── events/
│   │   └── errors/               # Domain error classes
│   ├── application/              # Use cases & ports
│   │   ├── ports/
│   │   │   ├── repositories/     # Repository interfaces
│   │   │   └── services/         # Service interfaces
│   │   ├── use-cases/
│   │   └── dto/
│   ├── infrastructure/           # External implementations
│   │   ├── database/
│   │   │   ├── drizzle/
│   │   │   │   └── schema.ts     # Drizzle schema
│   │   │   └── repositories/     # Repository implementations
│   │   ├── auth/
│   │   ├── events/
│   │   └── transaction/
│   ├── presentation/             # HTTP/WS layer
│   │   └── fastify/
│   │       ├── routes/
│   │       ├── middleware/
│   │       ├── plugins/
│   │       └── schemas/          # Zod validation schemas
│   └── shared/
│       ├── config/
│       │   └── env.ts            # requireEnv(), getEnv()
│       ├── container/            # DI container (Awilix)
│       ├── logger/
│       └── utils/
├── drizzle/                      # Generated migrations
├── drizzle.config.ts
└── test/
```

---

## 🚀 Entry Point

The app starts from `bootstrap.ts`, NOT `main.ts`:

```typescript
// bootstrap.ts - Loads env vars FIRST
import { loadEnv } from './shared/config/env';
loadEnv(process.cwd());

// Then imports main
import('./main.js');
```

**Why?** Ensures environment variables are loaded before any other module tries to access them.

---

## 💉 Dependency Injection (Awilix)

We use **Awilix** + **@fastify/awilix**.

### Registering Dependencies

```typescript
// src/shared/container/index.ts
import { asValue, asFunction, asClass } from 'awilix';
import { diContainer } from '@fastify/awilix';

diContainer.register({
  // Singletons (one for entire app)
  db: asFunction(() => createDatabase()).singleton(),
  
  // Repository classes
  userRepository: asClass(PostgresUserRepository).singleton(),
  
  // Scoped (one per request)
  tradingService: asClass(TradingService).scoped(),
});
```

### Using in Routes

```typescript
server.get('/users/:id', async (request) => {
  const userRepo = request.diScope.resolve('userRepository');
  return userRepo.findById(request.params.id);
});
```

### Lifetimes

| Lifetime | Use Case | Example |
|----------|----------|---------|
| `SINGLETON` | Stateless, shared | db, redis, repositories |
| `SCOPED` | Request-specific | use cases with user context |
| `TRANSIENT` | New each time | factories |

### Type Safety

Update `src/shared/container/types.ts` when adding dependencies:

```typescript
export interface AppCradle {
  db: DrizzleDB;
  userRepository: UserRepository;
  // Add new deps here
}

declare module '@fastify/awilix' {
  interface Cradle extends AppCradle {}
}
```

---

## ⚠️ Error Handling

### Error Classes

Located in `src/domain/errors/domain-error.ts`:

| Class | HTTP Status | Use Case |
|-------|-------------|----------|
| `ValidationError` | 400 | Invalid input |
| `AuthenticationError` | 401 | Not authenticated |
| `AuthorizationError` | 403 | Not authorized |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Duplicate/conflict |
| `BusinessLogicError` | 400 | Business rule violation |
| `RateLimitError` | 429 | Too many requests |

### Throwing Errors

```typescript
import { NotFoundError, BusinessLogicError } from '../../domain/errors/domain-error';

// Resource not found
if (!market) {
  throw new NotFoundError('Market', marketId);
}

// Business logic violation
if (user.balance < amount) {
  throw new BusinessLogicError(
    'Insufficient balance',
    'INSUFFICIENT_BALANCE',
    { required: amount.toString(), available: user.balance.toString() }
  );
}
```

### Creating Custom Errors

```typescript
export class InsufficientBalanceError extends BusinessLogicError {
  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient balance: required ${required}, available ${available}`,
      'INSUFFICIENT_BALANCE',
      { required: required.toString(), available: available.toString() }
    );
  }
}
```

---

## 🗄️ Database

### Schema Location

`src/infrastructure/database/drizzle/schema.ts`

### Migration Workflow

```bash
# 1. Modify schema.ts
# 2. Generate migration
npx drizzle-kit generate

# 3. Review in drizzle/<timestamp>_*.sql
# 4. Apply
npx drizzle-kit migrate
```

### Database Access

```typescript
// Get from DI container
const db = request.diScope.resolve('db');

// Query
// Query
const users = await db.select().from(users).where(eq(users.id, id));

// Transaction (Use TransactionManager in Use Cases)
// Do NOT use db.transaction() directly in Application layer.
// Inject 'transactionManager' and pass 'tx' to repositories.
await transactionManager.run(async (tx) => {
  await userRepository.save(user, tx);
  await pointGrantRepository.create(grant, tx);
});
```

---

## 🔒 Authentication

### Server-Side Only

**NEVER** use Supabase browser client. Always use `@supabase/ssr`:

```typescript
import { createServerClient } from '@supabase/ssr';

// Create client with cookie handling
const supabase = createServerClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_ANON_KEY'),
  { cookies: { ... } }
);

// Always validate with getUser() - never trust getSession()
const { data: { user } } = await supabase.auth.getUser();
```

---

## 📊 Rate Limiting

Configured in `src/presentation/fastify/plugins/rate-limit.ts`:

| Type | Limit | Window |
|------|-------|--------|
| `PUBLIC` | 100 req | 1 min |
| `AUTHENTICATED` | 60 req | 1 min |
| `TRADING` | 30 req | 1 min |
| `ADMIN` | 120 req | 1 min |

### Usage

```typescript
import { withRateLimit, RateLimitType } from './plugins/rate-limit';

server.get('/markets', withRateLimit(RateLimitType.PUBLIC), handler);
server.post('/trade', withRateLimit(RateLimitType.TRADING), handler);
```

---

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:coverage       # With coverage
npm test -- path/to/test    # Specific file
```

### Test Utilities (when implemented)

```typescript
createTestUser()      // Creates user with Supabase auth
createTestMarket()    // Creates market with liquidity
cleanupTestData()     // Removes test data
```

---

## ⏰ Background Jobs (BullMQ)

### Queues

| Queue | Purpose |
|-------|---------|
| `market-ops` | Market lifecycle |
| `notifications` | User notifications |
| `maintenance` | System housekeeping |

### Adding Jobs

```typescript
await queueService.add('market-ops', {
  type: 'check-expired',
  data: { marketId: '...' },
});

// Repeatable (cron)
await queueService.addRepeatable('maintenance', {
  type: 'cleanup-tokens',
  data: {},
}, { pattern: '0 * * * *' });
```

---

## 📝 Adding New Features

### New Route

1. Create route in `presentation/fastify/routes/`
2. Create Zod schema in `presentation/fastify/schemas/`
3. Create/use use case in `application/use-cases/`
4. Register route in `main.ts`

### New Repository

1. Define interface in `application/ports/repositories/`
   - MUST accept optional `tx?: Transaction` for atomic operations
2. Implement in `infrastructure/database/repositories/`
3. Register in `shared/container/index.ts`
4. Add type to `shared/container/types.ts`

### New Environment Variable

1. Add to `.env.example`
2. Access via `requireEnv()` or `getEnv()`
3. Document in root `AGENTS.md` if critical

---

*See also: [Root AGENTS.md](../AGENTS.md) | [System Design](../docs/SYSTEM_DESIGN.md) | [Backend Architecture](../docs/BACKEND_ARCHITECTURE.md)*
