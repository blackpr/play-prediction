# Route Registration Consistency Fix

## Problem Identified

There were inconsistencies in how backend routes were being registered in `main.ts`:

### Before the Fix

1. **Auth Routes** (`/presentation/fastify/routes/auth/index.ts`)
   - Registered in `main.ts` with prefix: `/api`
   - Added internal prefix: `/v1/auth`
   - **Result**: Routes accessible at `/api/v1/auth/*`

2. **Users Routes** (`/presentation/fastify/routes/users/index.ts`)
   - Registered in `main.ts` with prefix: `/api`
   - Added internal prefix: `/v1/users`
   - **Result**: Routes accessible at `/api/v1/users/*`

3. **Markets Routes** (`/presentation/fastify/routes/markets/index.ts`)
   - Registered in `main.ts` with prefix: `/api/v1/markets`
   - No internal prefix (used direct HTTP method calls)
   - **Result**: Routes accessible at `/api/v1/markets/*`

4. **Portfolio Routes** (`/presentation/fastify/routes/portfolio/index.ts`)
   - Registered in `main.ts` with prefix: `/api/v1/portfolio`
   - No internal prefix
   - **Result**: Routes accessible at `/api/v1/portfolio/*`

5. **Health Routes** (`/presentation/fastify/routes/health.ts`)
   - Registered in `main.ts` with prefix: `/api`
   - Exported as `FastifyPluginAsync`
   - **Result**: Routes accessible at `/api/health`

### Issues

1. **Inconsistent Registration Pattern**: Some routes used `fastify.register()` with prefixes, others used direct HTTP method calls
2. **Double Prefixing**: Auth and users routes added their own `/v1` prefix on top of what was provided in `main.ts`
3. **Confusing Mental Model**: Developers had to check both `main.ts` AND the route module to understand the final URL

## Solution Applied

### Standardized Approach

**All route prefixes are now defined in `main.ts` only:**

```typescript
// Routes (all use /api/v1 prefix for consistency)
server.register(healthRoutes, { prefix: '/api' });
server.register(authRoutes, { prefix: '/api/v1/auth' });
server.register(usersRoutes, { prefix: '/api/v1/users' });
server.register(marketsRoutes, { prefix: '/api/v1/markets' });
server.register(portfolioRoutes, { prefix: '/api/v1/portfolio' });
```

### Changes Made

1. **`backend/src/main.ts`**
   - Updated auth routes registration from `/api` to `/api/v1/auth`
   - Updated users routes registration from `/api` to `/api/v1/users`
   - Added clarifying comment

2. **`backend/src/presentation/fastify/routes/auth/index.ts`**
   - Removed all internal `/v1/auth` prefixes from route registrations
   - Routes now registered without prefix (prefix comes from `main.ts`)

3. **`backend/src/presentation/fastify/routes/users/index.ts`**
   - Removed internal `/v1/users` prefix from route registration
   - Route now registered without prefix (prefix comes from `main.ts`)

### Final URL Structure

All routes now follow a consistent pattern:

- **Health**: `/api/health`
- **Auth**: `/api/v1/auth/*` (register, login, logout, me, callback, forgot-password, reset-password)
- **Users**: `/api/v1/users/*` (me)
- **Markets**: `/api/v1/markets/*` (list, get, price-history, trades, quote, buy, sell, mint, merge)
- **Portfolio**: `/api/v1/portfolio/*` (position, portfolio, history)

## Benefits

1. ✅ **Single Source of Truth**: All URL prefixes defined in one place (`main.ts`)
2. ✅ **Consistent Pattern**: All routes follow the same registration approach
3. ✅ **Easier Maintenance**: Developers only need to check `main.ts` to understand URL structure
4. ✅ **No Double Prefixing**: Each prefix is applied exactly once
5. ✅ **Better Developer Experience**: Clear, predictable URL structure

## Verification

The existing routes continue to work at the same URLs as before. No breaking changes to the API.
