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