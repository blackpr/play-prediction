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
  "evidence": "BTC reached $102,450 at 14:32 UTC on Dec 15",
  "eventEndedAt": "2024-12-15T14:32:00Z"
}
```

**Acceptance Criteria:**
- [ ] Require admin role
- [ ] Market must be ACTIVE or PAUSED
- [ ] Set status = RESOLVED
- [ ] Set resolution = YES or NO
- [ ] Set resolvedAt timestamp
- [ ] Set eventEndedAt timestamp (required for manual-close markets)
- [ ] **Void post-event trades** (see RESOLVE-1a)
- [ ] Process all winning positions:
  - Get all portfolios for market
  - Credit winners: 1 Point per winning share
  - Log RESOLUTION_PAYOUT per user
- [ ] Clear pool (set to 0/0)
- [ ] Return payout summary including voided trades count

**Payout Logic:**
- YES wins: Users with YES shares get 1 Point per share
- NO wins: Users with NO shares get 1 Point per share
- Losers get nothing
- **Voided trades**: Users get full refund, excluded from resolution

**References:** API_SPECIFICATION.md Section 4.6.5, ENGINE_LOGIC.md Section 9, EDGE_CASES.md Section 6.2.2

---

### RESOLVE-1a: Implement Post-Event Trade Voiding

**As an** admin  
**I want** trades placed after an event ends to be automatically voided  
**So that** users cannot exploit delayed market closure

**Depends On:** RESOLVE-1

**Acceptance Criteria:**
- [ ] Add `event_ended_at` column to markets table
- [ ] Add `original_trade_id` and `void_reason` columns to trade_ledger
- [ ] Add `VOID` action type to trade_ledger
- [ ] When resolving a manual-close market:
  - [ ] Require `eventEndedAt` parameter
  - [ ] Find all trades placed AFTER `eventEndedAt`
  - [ ] For each post-event trade:
    - [ ] Reverse portfolio changes (remove shares)
    - [ ] Refund points to user
    - [ ] Log VOID action to trade_ledger
  - [ ] Exclude voided trades from resolution payout
- [ ] Notify affected users via job queue
- [ ] Return count of voided trades in response

**Void Trade Logic:**
```typescript
async function voidTrade(tx, trade, reason) {
  // 1. Reverse portfolio (remove shares bought, restore shares sold)
  // 2. Refund/deduct points from user balance
  // 3. Log VOID action with reference to original trade
  // 4. Queue user notification
}
```

**Response includes:**
```json
{
  "success": true,
  "data": {
    "resolution": "YES",
    "totalWinners": 45,
    "totalPayout": "15000000",
    "voidedTrades": {
      "count": 3,
      "totalRefunded": "800000",
      "affectedUsers": 2
    }
  }
}
```

**References:** EDGE_CASES.md Section 6.2.2

---

### RESOLVE-1b: Add Event End Time to Resolution UI

**As an** admin  
**I want** to specify when the event actually ended  
**So that** post-event trades are correctly voided

**Location:** Resolution modal/page

**Acceptance Criteria:**
- [ ] Add "Event Ended At" datetime picker (required for manual-close markets)
- [ ] Default to current time, allow backdating
- [ ] Show preview of trades that will be voided:
  - List trades placed after event_ended_at
  - Show user, action, amount, timestamp for each
  - Show total refund amount
- [ ] Confirmation dialog warns: "X trades will be voided and refunded"
- [ ] For `auto` close markets, eventEndedAt defaults to closes_at

**UI Preview:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⏰ Event Ended At: [2024-12-15] [15:34]                      │
│                                                             │
│ ⚠️ 3 trades will be voided (placed after event ended):      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ User          Action    Amount     Time                 │ │
│ │ john@...      BUY YES   500 pts    3:35 PM             │ │
│ │ jane@...      BUY YES   200 pts    3:41 PM             │ │
│ │ bob@...       BUY NO    100 pts    3:48 PM             │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Total to refund: 800 Points                                 │
└─────────────────────────────────────────────────────────────┘
```

**References:** EDGE_CASES.md Section 6.2.2

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

## Market Scheduler Jobs

> **Prerequisite:** EPIC_00 - JOBS-1 through JOBS-4 (BullMQ + Redis infrastructure)  
> **Architecture Decision:** Markets have a `closes_at` timestamp AND a `close_behavior` field. Not all markets auto-close—sports with variable end times (soccer with added time, basketball with overtime) require manual or buffered closing.

### SCHEDULER-0: Add Close Behavior Fields to Markets Table

**As a** backend developer  
**I want** markets to have configurable close behavior  
**So that** sports events with variable end times don't auto-close prematurely

**Depends On:** SETUP-3

**Acceptance Criteria:**
- [ ] Add Drizzle schema migration for new fields:
  ```typescript
  // In markets table schema
  closeBehavior: varchar('close_behavior', { length: 20 })
    .notNull()
    .default('auto'), // 'auto' | 'manual' | 'auto_with_buffer'
  bufferMinutes: integer('buffer_minutes'), // Only used when close_behavior = 'auto_with_buffer'
  ```
- [ ] Generate migration: `npx drizzle-kit generate`
- [ ] Apply migration: `npx drizzle-kit migrate`
- [ ] Update TypeScript types

**Close Behavior Options:**

| Value | Behavior | Use Case |
|-------|----------|----------|
| `'auto'` | Auto-transition to PAUSED when `closes_at` passes | Crypto prices, weather, exact-time events |
| `'manual'` | No auto-transition; admin must close | Soccer (added time), elections, awards |
| `'auto_with_buffer'` | Transition `buffer_minutes` after `closes_at` | Basketball (OT buffer), football |

**Database Schema Change:**
```sql
ALTER TABLE markets 
ADD COLUMN close_behavior VARCHAR(20) NOT NULL DEFAULT 'auto',
ADD COLUMN buffer_minutes INTEGER;

-- Add check constraint
ALTER TABLE markets ADD CONSTRAINT markets_close_behavior_check 
CHECK (close_behavior IN ('auto', 'manual', 'auto_with_buffer'));

-- Buffer only valid with auto_with_buffer
ALTER TABLE markets ADD CONSTRAINT markets_buffer_check
CHECK (
  (close_behavior = 'auto_with_buffer' AND buffer_minutes IS NOT NULL AND buffer_minutes > 0)
  OR (close_behavior != 'auto_with_buffer' AND buffer_minutes IS NULL)
);
```

**References:** SYSTEM_DESIGN.md Section 5.5

---

### SCHEDULER-1: Register Market Lifecycle Jobs

**As a** platform operator  
**I want** market lifecycle jobs registered on application startup  
**So that** markets are automatically managed without manual intervention

**Depends On:** EPIC_00 - JOBS-1, JOBS-2, SCHEDULER-0

**Acceptance Criteria:**
- [ ] Create job handlers: `src/infrastructure/jobs/handlers/market.ts`
- [ ] Register repeatable jobs on worker startup:
  - `market:check-expired` - every 1 minute
  - `market:activate-scheduled` - every 1 minute
  - `market:remind-manual-close` - every 15 minutes
- [ ] Jobs must be idempotent (re-running produces same result)
- [ ] Add to worker handler registry

**Job Handler Skeleton:**
```typescript
// src/infrastructure/jobs/handlers/market.ts
import { Job } from 'bullmq';

export const marketHandlers = {
  'market:check-expired': async (job: Job) => {
    // Implementation in SCHEDULER-2
  },
  'market:activate-scheduled': async (job: Job) => {
    // Implementation in SCHEDULER-5
  },
  'market:remind-manual-close': async (job: Job) => {
    // Implementation in SCHEDULER-2a
  },
};
```

**References:** SYSTEM_DESIGN.md Section 5.6

---

### SCHEDULER-2: Implement Auto-Close Markets Job (Close Behavior Aware)

**As a** platform operator  
**I want** markets to respect their `close_behavior` setting when `closes_at` passes  
**So that** sports events with variable end times don't auto-close prematurely

**Job Name:** `market:check-expired`  
**Queue:** `market-ops`  
**Schedule:** Every 1 minute (repeatable)

**Acceptance Criteria:**
- [ ] Implement handler in `src/infrastructure/jobs/handlers/market.ts`
- [ ] Handle each `close_behavior` type differently:

**For `close_behavior = 'auto'`:**
- [ ] Query: `status = 'ACTIVE' AND closes_at < NOW() AND close_behavior = 'auto'`
- [ ] Immediately transition `ACTIVE` → `PAUSED`
- [ ] Emit WebSocket event: `market:closed`

**For `close_behavior = 'auto_with_buffer'`:**
- [ ] Query: `status = 'ACTIVE' AND (closes_at + buffer_minutes) < NOW() AND close_behavior = 'auto_with_buffer'`
- [ ] Transition `ACTIVE` → `PAUSED` only after buffer expires
- [ ] Emit WebSocket event: `market:closed`

**For `close_behavior = 'manual'`:**
- [ ] Do NOT auto-transition (handled by SCHEDULER-2a)
- [ ] Skip these markets in auto-close logic

- [ ] Log state transitions in audit trail
- [ ] Job must be idempotent (re-running doesn't duplicate transitions)
- [ ] Metrics: `markets_auto_closed_total` counter (with `close_behavior` label)
- [ ] Configure retry: 3 attempts with exponential backoff

**Implementation:**
```typescript
// src/infrastructure/jobs/handlers/market.ts
'market:check-expired': async (job: Job) => {
  const now = new Date();
  
  // 1. Handle 'auto' markets - close immediately
  const autoMarkets = await db.query.markets.findMany({
    where: and(
      eq(markets.status, 'ACTIVE'),
      eq(markets.closeBehavior, 'auto'),
      isNotNull(markets.closesAt),
      lt(markets.closesAt, now)
    ),
  });

  // 2. Handle 'auto_with_buffer' markets - close after buffer
  const bufferedMarkets = await db.query.markets.findMany({
    where: and(
      eq(markets.status, 'ACTIVE'),
      eq(markets.closeBehavior, 'auto_with_buffer'),
      isNotNull(markets.closesAt),
      // closes_at + buffer_minutes < now
      sql`${markets.closesAt} + (${markets.bufferMinutes} * INTERVAL '1 minute') < ${now}`
    ),
  });

  const marketsToClose = [...autoMarkets, ...bufferedMarkets];

  for (const market of marketsToClose) {
    await db.transaction(async (tx) => {
      await tx.update(markets)
        .set({ status: 'PAUSED', updatedAt: new Date() })
        .where(eq(markets.id, market.id));
      
      // Log to audit trail
      // Emit WebSocket event: market:closed
    });
  }

  // 3. 'manual' markets are NOT processed here (see SCHEDULER-2a)

  return { 
    processed: marketsToClose.length,
    auto: autoMarkets.length,
    buffered: bufferedMarkets.length,
  };
},
```

**State Transitions:**
```
close_behavior = 'auto':
  ACTIVE + closes_at < NOW() → PAUSED

close_behavior = 'auto_with_buffer':
  ACTIVE + (closes_at + buffer_minutes) < NOW() → PAUSED

close_behavior = 'manual':
  No auto-transition (admin must act)
```

**References:** EDGE_CASES.md Section 6.2, SYSTEM_DESIGN.md Section 5.5

---

### SCHEDULER-2a: Implement Manual Close Reminder Job

**As an** admin  
**I want** to be reminded about manual-close markets that are past their scheduled time  
**So that** I don't forget to close them after the event ends

**Job Name:** `market:remind-manual-close`  
**Queue:** `notifications`  
**Schedule:** Every 15 minutes (repeatable)

**Acceptance Criteria:**
- [ ] Implement handler in `src/infrastructure/jobs/handlers/notifications.ts`
- [ ] Query: `status = 'ACTIVE' AND close_behavior = 'manual' AND closes_at < NOW()`
- [ ] Group by how long past `closes_at`:
  - 0-30 min past: No notification (event likely still ongoing)
  - 30-60 min past: Dashboard indicator only
  - 1-2 hours past: Queue dashboard alert
  - 2+ hours past: Queue email/Slack notification
- [ ] Track notification history to avoid spam
- [ ] Include market details: title, closes_at, holder count, trading volume

**Implementation:**
```typescript
'market:remind-manual-close': async (job: Job) => {
  const now = new Date();
  
  const manualMarkets = await db.query.markets.findMany({
    where: and(
      eq(markets.status, 'ACTIVE'),
      eq(markets.closeBehavior, 'manual'),
      isNotNull(markets.closesAt),
      lt(markets.closesAt, now)
    ),
  });

  for (const market of manualMarkets) {
    const minutesPast = (now.getTime() - market.closesAt.getTime()) / 60000;
    
    if (minutesPast > 120) {
      // 2+ hours: Send urgent notification
      await queueService.add('notifications', {
        type: 'admin:manual-close-urgent',
        data: { marketId: market.id, minutesPast },
      });
    } else if (minutesPast > 60) {
      // 1-2 hours: Dashboard alert
      await queueService.add('notifications', {
        type: 'admin:manual-close-warning',
        data: { marketId: market.id, minutesPast },
      });
    }
    // 0-60 min: Event likely still ongoing, no action
  }

  return { checked: manualMarkets.length };
},
```

**Notification Escalation for Manual Markets:**
| Time Since `closes_at` | Alert Level | Action |
|----------------------|-------------|--------|
| 0-30 minutes | None | Event likely ongoing (added time, etc.) |
| 30-60 minutes | Info | Dashboard indicator |
| 1-2 hours | Warning | Dashboard alert + badge |
| 2+ hours | Urgent | Email/Slack notification |

**References:** SYSTEM_DESIGN.md Section 5.5

---

### SCHEDULER-3: Implement Pending Resolution Alerts

**As an** admin  
**I want** to be notified about markets awaiting resolution  
**So that** I don't forget to resolve them and users don't have funds locked

**Job Name:** `admin:alert-pending-resolution`  
**Queue:** `notifications`  
**Schedule:** Every 1 hour (repeatable)

**Acceptance Criteria:**
- [ ] Implement handler in `src/infrastructure/jobs/handlers/notifications.ts`
- [ ] Query markets WHERE `status = 'PAUSED' AND closes_at < NOW()`
- [ ] Group markets by urgency level
- [ ] For markets pending > 24 hours:
  - [ ] Queue email notification job
  - [ ] Include market details, holder count, total value locked
- [ ] Track notification history (use Redis or DB) to avoid spam
- [ ] Dashboard API endpoint for pending resolutions

**Alert Levels:**
| Time Since Close | Alert Level | Action |
|-----------------|-------------|--------|
| 0-24 hours | Info | Show in dashboard only |
| 24-48 hours | Warning | Queue `admin:send-email` job |
| 48+ hours | Critical | Queue `admin:send-urgent-alert` (Slack/SMS) |

**Implementation:**
```typescript
// src/infrastructure/jobs/handlers/notifications.ts
'admin:alert-pending-resolution': async (job: Job) => {
  const pendingMarkets = await db.query.markets.findMany({
    where: and(
      eq(markets.status, 'PAUSED'),
      isNotNull(markets.closesAt),
      lt(markets.closesAt, new Date())
    ),
  });

  const grouped = groupByUrgency(pendingMarkets);
  
  if (grouped.critical.length > 0) {
    await queueService.add('notifications', {
      type: 'admin:send-urgent-alert',
      data: { markets: grouped.critical },
    });
  }
  
  // ... handle warning and info levels
},
```

**References:** EDGE_CASES.md Section 7.4

---

### SCHEDULER-4: Implement Admin Dashboard - Pending Resolutions Widget

**As an** admin  
**I want** a dashboard widget showing markets needing resolution  
**So that** I can quickly see what needs attention

**Location:** Admin Dashboard (`/admin`)

**Acceptance Criteria:**
- [ ] Widget showing markets awaiting resolution
- [ ] Sorted by urgency (oldest first)
- [ ] Show:
  - Market title
  - Time since closed (e.g., "Closed 2 hours ago")
  - Number of holders
  - Total value locked (sum of positions)
- [ ] Color coding by urgency:
  - Green: < 24h
  - Yellow: 24-48h
  - Red: > 48h
- [ ] One-click access to resolution form
- [ ] Auto-refresh every 60 seconds

**Widget Example:**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Markets Pending Resolution (3)               │
├─────────────────────────────────────────────────┤
│ 🔴 "Will BTC hit $100k?"                        │
│    Closed 52 hours ago | 234 holders | $15,000  │
│    [Resolve] [Cancel]                           │
├─────────────────────────────────────────────────┤
│ 🟡 "Will it snow in NYC?"                       │
│    Closed 26 hours ago | 89 holders | $4,500    │
│    [Resolve] [Cancel]                           │
├─────────────────────────────────────────────────┤
│ 🟢 "Will Lakers win tonight?"                   │
│    Closed 3 hours ago | 456 holders | $28,000   │
│    [Resolve] [Cancel]                           │
└─────────────────────────────────────────────────┘
```

---

### SCHEDULER-5: Implement Scheduled Market Activation

**As an** admin  
**I want** to schedule markets to activate automatically  
**So that** I can prepare markets in advance

**Job Name:** `market:activate-scheduled`  
**Queue:** `market-ops`  
**Schedule:** Every 1 minute (repeatable)

**Enhancement to:** `POST /v1/admin/markets`

**Request Addition:**
```json
{
  "activatesAt": "2024-12-15T09:00:00Z"
}
```

**Acceptance Criteria:**
- [ ] Add migration: `activates_at` column to markets table (nullable TIMESTAMPTZ)
- [ ] Markets with `activates_at` remain in DRAFT until that time
- [ ] Implement handler in `src/infrastructure/jobs/handlers/market.ts`
- [ ] Query markets WHERE `status = 'DRAFT' AND activates_at < NOW()`
- [ ] Transition `DRAFT` → `ACTIVE` and emit WebSocket event
- [ ] Admin can override and manually activate earlier
- [ ] UI shows countdown to activation

**Implementation:**
```typescript
'market:activate-scheduled': async (job: Job) => {
  const scheduledMarkets = await db.query.markets.findMany({
    where: and(
      eq(markets.status, 'DRAFT'),
      isNotNull(markets.activatesAt),
      lt(markets.activatesAt, new Date())
    ),
  });

  for (const market of scheduledMarkets) {
    await activateMarket(market.id);
    // Emit WebSocket: market:activated
  }
  
  return { activated: scheduledMarkets.length };
},
```

---

### SCHEDULER-6: Implement Cleanup Job for Expired Tokens

**As a** platform operator  
**I want** expired refresh tokens cleaned up automatically  
**So that** the database doesn't grow indefinitely

**Job Name:** `system:cleanup-tokens`  
**Queue:** `maintenance`  
**Schedule:** Daily at 3:00 AM UTC (`0 3 * * *`)

**Acceptance Criteria:**
- [ ] Implement handler in `src/infrastructure/jobs/handlers/maintenance.ts`
- [ ] Delete refresh_tokens WHERE `expires_at < NOW() - INTERVAL '7 days'`
- [ ] Log number of tokens deleted
- [ ] Metrics: `refresh_tokens_cleaned_total` counter

**Implementation:**
```typescript
// src/infrastructure/jobs/handlers/maintenance.ts
'system:cleanup-tokens': async (job: Job) => {
  const result = await db.delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, subDays(new Date(), 7)));
  
  logger.info('Cleaned up expired tokens', { count: result.rowCount });
  return { deleted: result.rowCount };
},
```

---

### SCHEDULER-7: Register All Repeatable Jobs on Startup

**As a** platform operator  
**I want** all scheduled jobs registered automatically when the worker starts  
**So that** the system is self-configuring

**Depends On:** EPIC_00 - JOBS-2

**Acceptance Criteria:**
- [ ] Create job registration module: `src/infrastructure/jobs/register-jobs.ts`
- [ ] Register all repeatable jobs on worker startup:
  ```typescript
  const repeatableJobs = [
    { queue: 'market-ops', name: 'market:check-expired', pattern: '* * * * *' },
    { queue: 'market-ops', name: 'market:activate-scheduled', pattern: '* * * * *' },
    { queue: 'notifications', name: 'admin:alert-pending-resolution', pattern: '0 * * * *' },
    { queue: 'maintenance', name: 'system:cleanup-tokens', pattern: '0 3 * * *' },
  ];
  ```
- [ ] Idempotent registration (don't duplicate if already exists)
- [ ] Log registered jobs on startup
- [ ] CLI command to list registered jobs: `npm run job:list`

**Worker Startup:**
```typescript
// src/worker.ts
import { registerRepeatableJobs } from './infrastructure/jobs/register-jobs';

async function main() {
  await registerRepeatableJobs();
  
  const workers = createWorkers({
    'market-ops': marketHandlers,
    'notifications': notificationHandlers,
    'maintenance': maintenanceHandlers,
  });
  
  logger.info('Worker started', { queues: Object.keys(workers) });
}
```

---