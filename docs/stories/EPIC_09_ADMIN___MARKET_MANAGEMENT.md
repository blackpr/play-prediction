## Epic 9: Admin - Market Management

**Goal:** Admins can create and manage markets.

### ADMIN-1: Implement Admin Role Check

**As a** backend developer  
**I want** admin middleware  
**So that** admin endpoints are protected

**Acceptance Criteria:**
- [x] Check user.role === 'admin'
- [x] Return 403 FORBIDDEN if not admin
- [x] Apply to all /admin routes
- [x] Verify protection of sensitive sidecars:
  - [x] BullMQ Board (`/admin/queues`)

**References:** API_SPECIFICATION.md Section 2.5

**Implementation Notes:**
- `requireAdmin` middleware already existed in `backend/src/presentation/fastify/middleware/auth.ts`
- Applied to all admin routes via `onRequest` hook in `backend/src/presentation/fastify/routes/admin/index.ts`
- Verified with curl: non-admin users receive 403 FORBIDDEN

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
  "seedLiquidity": "10000000",
  "closeBehavior": "auto",
  "bufferMinutes": null
}
```

**Close Behavior Options:**

| Value | Use Case | Example |
|-------|----------|---------|
| `"auto"` | Events with exact end times | Crypto price at specific time, weather |
| `"manual"` | Events with variable end times | Soccer (added time), elections |
| `"auto_with_buffer"` | Events with predictable extensions | Basketball (30 min for OT) |

**Acceptance Criteria:**
- [x] Require admin role
- [x] Validate minimum seed liquidity
- [x] Validate `closeBehavior` is one of: `auto`, `manual`, `auto_with_buffer`
- [x] If `closeBehavior = 'auto_with_buffer'`, require `bufferMinutes > 0`
- [x] If `closeBehavior != 'auto_with_buffer'`, reject `bufferMinutes`
- [x] Inherit default `closeBehavior` from category if not specified
- [x] Create market record (status: DRAFT)
- [x] Create liquidity_pool with 50/50 split
- [x] Grant seed shares to treasury account
- [x] Log GENESIS_MINT to trade_ledger
- [x] Return created market

**Category Close Behavior Defaults:**

| Category | Default `closeBehavior` | Default `bufferMinutes` |
|----------|------------------------|------------------------|
| Sports - Soccer | `manual` | — |
| Sports - Basketball | `auto_with_buffer` | 30 |
| Sports - Football | `auto_with_buffer` | 45 |
| Sports - Other | `auto_with_buffer` | 15 |
| Crypto | `auto` | — |
| Weather | `auto` | — |
| Politics | `manual` | — |
| Entertainment | `manual` | — |

**References:** API_SPECIFICATION.md Section 4.6.1, ENGINE_LOGIC.md Section 8, SYSTEM_DESIGN.md Section 5.5

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
- [x] Activate: DRAFT → ACTIVE
- [x] Pause: ACTIVE → PAUSED (with optional reason)
- [x] Resume: PAUSED → ACTIVE
- [x] Validate state transitions
- [x] Update market record
- [x] Log actions (via updated_at timestamp and reason)

**Implementation Notes:**
- Added `updateStatus` method to MarketRepository and Postgres implementation
- Created `ActivateMarketUseCase`, `PauseMarketUseCase`, and `ResumeMarketUseCase`
- Implemented state validation logic (e.g., prevent activating already active markets)
- Registered endpoints: `POST /admin/markets/:id/{activate,pause,resume}`
- Verified with unit tests and curl commands (invalid transitions return 400 Bad Request)

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
- [x] Protected route (require admin)
- [x] Sidebar navigation
- [x] Dashboard overview
- [x] Markets management link
- [x] Users management link

---

### ADMIN-5: Create Admin Dashboard Content

**As an** admin  
**I want** a dashboard with key metrics  
**So that** I can monitor platform health

**Route:** `/admin` (dashboard section)

**Acceptance Criteria:**
- [x] Total users count
- [x] Active markets count
- [x] 24h trading volume
- [x] Recent trades list (last 10)
- [x] Markets pending resolution
- [ ] Quick action buttons (Create Market, Grant Points)
- [x] Auto-refresh data every 60 seconds

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
- [x] Title input (required)
- [x] Description textarea (required)
- [x] Category select (affects default close behavior)
- [x] Image URL input
- [x] Closes at date picker
- [x] Seed Liquidity input
- [x] **Close Behavior Section:**
  - [x] Close behavior radio buttons: Auto / Manual / Auto with Buffer
  - [x] Show helper text explaining each option:
    - Auto: "Market will automatically pause for trading when close time passes"
    - Manual: "Trading continues until admin manually closes (use for sports with added time)"
    - Auto with Buffer: "Market pauses after close time + buffer period"
  - [x] Buffer minutes input (only visible when "Auto with Buffer" selected)
  - [x] Auto-populate defaults based on selected category
  - [x] Show warning for sports categories if "Auto" is selected
- [x] Preview before submit
- [x] Success/error feedback

**Close Behavior UI:**
```
┌─────────────────────────────────────────────────────────┐
│ Close Behavior                                          │
│                                                         │
│ ○ Auto Close                                            │
│   Market pauses immediately when close time passes.     │
│   Best for: crypto prices, weather predictions          │
│                                                         │
│ ● Manual Close (recommended for Sports - Soccer)        │
│   Trading continues until admin manually closes.        │
│   Best for: sports with added time, elections           │
│                                                         │
│ ○ Auto Close with Buffer                                │
│   Market pauses [30] minutes after close time.          │
│   Best for: basketball (overtime), football             │
│                                                         │
│ ⚠️ Soccer matches can have 1-15+ minutes of added time. │
│    Consider using "Manual Close" to avoid closing       │
│    during the final minutes of play.                    │
└─────────────────────────────────────────────────────────┘
```

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