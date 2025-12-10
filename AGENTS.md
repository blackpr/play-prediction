# AGENTS.md - AI Agent Instructions

This file contains critical rules and instructions for AI agents working on this codebase.

> **Nested Instructions:** This is a monorepo. Each package has its own `AGENTS.md` with specific guidance:
> - [`backend/AGENTS.md`](./backend/AGENTS.md) - Backend-specific patterns
> - [`frontend/AGENTS.md`](./frontend/AGENTS.md) - Frontend-specific patterns
> - [`docs/AGENTS.md`](./docs/AGENTS.md) - Documentation guidelines

---

## 🚨 Critical Rules

These rules apply **everywhere** in the codebase:

| Rule | Description |
|------|-------------|
| **Use `requireEnv()`** | Always use `requireEnv('VAR_NAME')` for required env vars, never `process.env.VAR` directly |
| **Use Drizzle-Kit** | Always use drizzle-kit for migrations, never Supabase CLI |
| **BigInt for Money** | All monetary values use `BigInt` in MicroPoints (1 Point = 1,000,000 MicroPoints) |
| **Server-Side Only** | Never use Supabase browser client, always use `@supabase/ssr` |

---

## 🔐 Environment Variables

**CRITICAL:** Never access environment variables directly with `process.env.VAR_NAME`.

```typescript
// ✅ CORRECT - Throws descriptive error if missing
import { requireEnv, getEnv } from './shared/config/env';

const databaseUrl = requireEnv('DATABASE_URL');
const port = getEnv('PORT', '4000');

// ❌ WRONG - Silent undefined, hard to debug
const databaseUrl = process.env.DATABASE_URL;
```

### Required Variables

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

---

## 🗄️ Database Migrations

**CRITICAL:** Always use drizzle-kit, never Supabase CLI for migrations.

```bash
# From backend/ directory
npx drizzle-kit generate   # Generate migration from schema
npx drizzle-kit migrate    # Apply pending migrations
npx drizzle-kit push       # Push directly (dev only)
npx drizzle-kit studio     # Open Drizzle Studio
```

### What NOT to Use

- ❌ `supabase migration new`
- ❌ `supabase db reset`
- ❌ `supabase db push`

Supabase CLI is only for:
- ✅ `supabase start/stop` - Local development
- ✅ `supabase link` - Link to remote project

---

## 🏗️ Project Structure

```
play-prediction/
├── AGENTS.md              # This file (root instructions)
├── backend/               # Fastify API + Drizzle ORM
│   ├── AGENTS.md          # Backend-specific instructions
│   └── src/
├── frontend/              # React SPA (TanStack Start)
│   └── AGENTS.md          # Frontend-specific instructions
├── docs/                  # Documentation
│   ├── AGENTS.md          # Doc navigation guide
│   └── stories/           # User stories by Epic
└── supabase/              # Supabase local config
```

### Architecture (Hexagonal/DDD)

```
Dependencies ONLY point inward:
Presentation → Application → Domain ← Infrastructure
```

| Layer | Contains | Imports From |
|-------|----------|--------------|
| **Domain** | Entities, Value Objects, Services | Nothing |
| **Application** | Use Cases, Ports (interfaces) | Domain only |
| **Infrastructure** | Repositories, External services | Application, Domain |
| **Presentation** | Routes, Middleware | Application only |

---

## 💰 Money & Pricing Rules

### MicroPoints Convention

```typescript
// 1 Point = 1,000,000 MicroPoints
const tenPoints = 10_000_000n;
const displayValue = Number(tenPoints) / 1_000_000; // 10.0
```

### The Golden Equation (CPMM)

```
P_YES + P_NO = 1.0

P_YES = noQty / (yesQty + noQty)
P_NO = yesQty / (yesQty + noQty)
```

### Rounding (The Floor Rule)

- **User payouts** → Round DOWN (floor)
- **Fee calculations** → Round UP (ceiling)

---

## 🧰 Development Commands

```bash
# Start all services
npm run dev

# Database (from backend/)
npx drizzle-kit generate     # Generate migrations
npx drizzle-kit migrate      # Apply migrations
npx drizzle-kit studio       # Open Drizzle Studio

# Supabase
supabase start               # Start local instance
supabase stop                # Stop local instance
supabase status              # Show URLs/keys

# Testing
npm test                     # Run tests
npm run test:coverage        # With coverage
```

---

## 📚 Quick Links

| Topic | File |
|-------|------|
| Backend patterns | [`backend/AGENTS.md`](./backend/AGENTS.md) |
| Frontend patterns | [`frontend/AGENTS.md`](./frontend/AGENTS.md) |
| Documentation guide | [`docs/AGENTS.md`](./docs/AGENTS.md) |
| System design | [`docs/SYSTEM_DESIGN.md`](./docs/SYSTEM_DESIGN.md) |
| API specification | [`docs/API_SPECIFICATION.md`](./docs/API_SPECIFICATION.md) |
| Database schema | [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) |

---

*Last Updated: December 2025*
