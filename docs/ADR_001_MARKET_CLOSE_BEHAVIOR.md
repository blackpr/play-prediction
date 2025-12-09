# ADR-001: Market Close Behavior System

**Status:** Accepted  
**Date:** December 2025  
**Decision Makers:** Engineering Team (Fullstack, Architects, Seniors, Staff, Principal)

---

## Context

The Play-Prediction Engine uses BullMQ + Redis for background job processing, including a scheduler that auto-closes markets when their `closes_at` timestamp passes. However, this approach has a critical flaw for **events with variable end times**.

### The Problem

Sports events like soccer don't have predictable end times:

| Sport | Regular Time | Variable Extensions |
|-------|-------------|---------------------|
| **Soccer** | 90 minutes | Added time: 1-15+ min, Extra time: 30 min, Penalties |
| **Basketball** | 48 minutes | Overtime: 5 min periods (unlimited) |
| **Football** | 60 minutes | Overtime: 10 min, sudden death |
| **Baseball** | 9 innings | Extra innings (unlimited) |
| **Tennis** | Best of 3/5 sets | Tiebreakers, 5th set rules vary |

**Example Scenario:**
- Market: "Will Manchester United win vs Liverpool?"
- `closes_at`: Set to 90 minutes after kickoff (2:00 PM + 90 min = 3:30 PM)
- **Problem**: The match goes to 95 minutes with added time
- **Disaster**: Market auto-closes at 3:30 PM, but the winning goal is scored at 3:34 PM
- **Result**: Users couldn't trade during the decisive moment, market reflects wrong probability

### Why This Matters

1. **User Frustration**: Users expect to trade until the event actually ends
2. **Market Accuracy**: Auto-closing early means final prices don't reflect true outcome probability
3. **Trust**: Users lose trust if they can't react to late-game events
4. **Revenue**: Missed trading volume during exciting final moments

---

## Decision

Implement a **Market Close Behavior System** with three options:

### Option 1: `auto` (Default)
- Market immediately transitions `ACTIVE → PAUSED` when `closes_at` passes
- Best for: Crypto prices, weather, elections with exact deadlines

### Option 2: `manual`
- Market stays `ACTIVE` past `closes_at`; admin must manually close
- Best for: Soccer, tennis, award shows, events with unpredictable end times

### Option 3: `auto_with_buffer`
- Market transitions `ACTIVE → PAUSED` after `closes_at + buffer_minutes`
- Best for: Basketball (30 min OT buffer), football (45 min buffer)

### Database Schema

```sql
ALTER TABLE markets 
ADD COLUMN close_behavior VARCHAR(20) NOT NULL DEFAULT 'auto',
ADD COLUMN buffer_minutes INTEGER;

-- Constraints
ALTER TABLE markets ADD CONSTRAINT markets_close_behavior_valid 
CHECK (close_behavior IN ('auto', 'manual', 'auto_with_buffer'));

ALTER TABLE markets ADD CONSTRAINT markets_buffer_valid CHECK (
  (close_behavior = 'auto_with_buffer' AND buffer_minutes IS NOT NULL AND buffer_minutes > 0)
  OR (close_behavior != 'auto_with_buffer' AND buffer_minutes IS NULL)
);
```

### Scheduler Job Logic

```typescript
// market:check-expired job
const now = new Date();

// 1. Auto-close markets (immediate)
const autoMarkets = await db.query.markets.findMany({
  where: and(
    eq(markets.status, 'ACTIVE'),
    eq(markets.closeBehavior, 'auto'),
    lt(markets.closesAt, now)
  ),
});

// 2. Auto-close with buffer (delayed)
const bufferedMarkets = await db.query.markets.findMany({
  where: and(
    eq(markets.status, 'ACTIVE'),
    eq(markets.closeBehavior, 'auto_with_buffer'),
    sql`${markets.closesAt} + (${markets.bufferMinutes} * INTERVAL '1 minute') < ${now}`
  ),
});

// 3. Manual markets - only notify admin, don't auto-close
const manualMarkets = await db.query.markets.findMany({
  where: and(
    eq(markets.status, 'ACTIVE'),
    eq(markets.closeBehavior, 'manual'),
    lt(markets.closesAt, now)
  ),
});
// → Queue reminder notifications, don't transition
```

---

## Category Defaults

Categories inherit default `close_behavior`:

| Category | Default Behavior | Default Buffer | Rationale |
|----------|-----------------|----------------|-----------|
| Sports - Soccer | `manual` | — | Added time highly variable (1-15+ min) |
| Sports - Basketball | `auto_with_buffer` | 30 min | Overtime possible but predictable |
| Sports - Football | `auto_with_buffer` | 45 min | OT + potential delays |
| Sports - Baseball | `manual` | — | Extra innings unlimited |
| Sports - Tennis | `manual` | — | Match length unpredictable |
| Sports - Other | `auto_with_buffer` | 15 min | Conservative default |
| Crypto | `auto` | — | Exact timestamps |
| Weather | `auto` | — | End-of-day clear |
| Politics/Elections | `manual` | — | Results take hours/days |
| Entertainment | `manual` | — | Award shows unpredictable |

---

## Alternatives Considered

### Alternative 1: Always Use Large Buffers
- **Approach**: Use 60+ minute buffers for all sports
- **Rejected**: Still doesn't handle soccer (added time varies 1-15+ min) or extra time (30+ min)

### Alternative 2: External Event Data Integration
- **Approach**: Connect to sports APIs to detect when events actually end
- **Rejected**: Adds complexity, external dependencies, API costs, and latency

### Alternative 3: User-Triggered Close
- **Approach**: Let users vote when an event has ended
- **Rejected**: Manipulation risk, requires quorum logic, poor UX

### Alternative 4: Soft Close (Allow Sells Only)
- **Approach**: Block new positions but allow exits when `closes_at` passes
- **Considered for future**: Could be combined with manual close for added flexibility

---

## Consequences

### Positive
- ✅ Sports markets stay open during exciting final moments
- ✅ Users can trade on added time goals, overtime results
- ✅ Configurable per-market and per-category
- ✅ Backward compatible (default is `auto`)
- ✅ Admin has clear workflow for manual markets

### Negative
- ⚠️ Admin burden: Must manually close `manual` markets
- ⚠️ Potential for forgotten markets (mitigated by reminder notifications)
- ⚠️ Slight complexity increase in scheduler logic

### Mitigations
- **Admin Dashboard Widget**: Shows markets past `closes_at` needing attention
- **Escalating Notifications**: Reminders at 1 hour, 2 hours, then urgent alerts
- **Audit Trail**: All close actions logged

---

## Implementation

### Phase 1: Database & Schema (SCHEDULER-0)
- Add `close_behavior` and `buffer_minutes` columns
- Add constraints and indexes
- Update Drizzle schema

### Phase 2: Scheduler Jobs (SCHEDULER-2, SCHEDULER-2a)
- Update `market:check-expired` job to respect `close_behavior`
- Add `market:remind-manual-close` job for admin notifications

### Phase 3: Admin UI (ADMIN-6, SCHEDULER-4)
- Add close behavior controls to market creation form
- Add pending manual-close widget to admin dashboard

### Phase 4: Category Defaults
- Define category-to-behavior mappings
- Auto-populate on market creation

---

## References

- [SYSTEM_DESIGN.md Section 5.5](./SYSTEM_DESIGN.md) - Market Close Behavior System
- [EDGE_CASES.md Section 6.2](./EDGE_CASES.md) - Market Closes While Trades Pending
- [EPIC_10 SCHEDULER Stories](./stories/EPIC_10_ADMIN___RESOLUTION___POINTS.md) - Scheduler implementation
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Schema updates

---

*ADR-001 | Market Close Behavior System | December 2025*
