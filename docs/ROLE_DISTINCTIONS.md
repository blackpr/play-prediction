# Role Distinctions

## Admin vs Treasury

### Admin Role (`role: 'admin'`)
**Purpose**: Human administrators who manage the platform

**Permissions**:
- ✅ Create markets (`POST /admin/markets`)
- ✅ Manage market lifecycle (activate, pause, resume)
- ✅ Resolve markets
- ✅ Grant points to users
- ✅ Access BullMQ dashboard (`/admin/queues`)
- ✅ View system metrics and logs

**Use Cases**:
- Platform operators
- Content moderators
- Customer support leads

---

### Treasury Role (`role: 'treasury'`)
**Purpose**: System account for automated operations

**Permissions**:
- ❌ **NOT** an admin - cannot access admin endpoints
- ✅ Holds genesis liquidity for new markets
- ✅ Receives LP shares from market creation
- ✅ System-level operations only

**Use Cases**:
- Genesis liquidity provider
- Market maker for initial pools
- System reserve account

**Important**: Treasury is queried dynamically by role, not hardcoded by ID. This allows flexibility in treasury account management.

---

## Why Keep Them Separate?

1. **Security**: Treasury account should never have admin privileges
2. **Audit Trail**: Clear separation between human actions (admin) and system actions (treasury)
3. **Accounting**: Treasury balance represents system liquidity, not admin funds
4. **Access Control**: Treasury doesn't need (and shouldn't have) access to admin dashboards

---

## Implementation

### Auth Middleware
```typescript
// backend/src/presentation/fastify/middleware/auth.ts

export async function requireAdmin(request, reply) {
  await requireAuth(request, reply);
  
  if (reply.sent) return;
  
  // Only users with role='admin' can access
  if (request.user && request.user.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
}
```

### Treasury Lookup
```typescript
// backend/src/application/use-cases/admin/create-market.use-case.ts

// Query for treasury user dynamically
const treasuryUser = await this.deps.userRepository.findByRole('treasury');
if (!treasuryUser) {
  throw new NotFoundError('Treasury User', 'No user with role "treasury" found');
}
```

---

## Protected Endpoints

### Admin-Only Routes
- `POST /api/v1/admin/markets` - Create market
- `PATCH /api/v1/admin/markets/:id/activate` - Activate market
- `PATCH /api/v1/admin/markets/:id/pause` - Pause market
- `PATCH /api/v1/admin/markets/:id/resume` - Resume market
- `POST /api/v1/admin/markets/:id/resolve` - Resolve market
- `POST /api/v1/admin/users/:id/grant-points` - Grant points
- `GET /admin/queues/*` - BullMQ dashboard (all routes)

### Public Routes (No Auth)
- `GET /api/v1/markets` - List markets
- `GET /api/v1/markets/:id` - Get market details
- `GET /api/health` - Health check

### Authenticated Routes (Any logged-in user)
- `POST /api/v1/markets/:id/buy` - Buy shares
- `POST /api/v1/markets/:id/sell` - Sell shares
- `GET /api/v1/portfolio` - View portfolio
