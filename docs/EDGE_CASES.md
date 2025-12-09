# Edge Cases & Safety Protocols

**Version:** 3.1  
**Platform:** Supabase (Database + Auth)  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Trading Edge Cases](#2-trading-edge-cases)
3. [Pool & Liquidity Edge Cases](#3-pool--liquidity-edge-cases)
4. [Concurrency Edge Cases](#4-concurrency-edge-cases)
5. [User Account Edge Cases](#5-user-account-edge-cases)
6. [Market Lifecycle Edge Cases](#6-market-lifecycle-edge-cases)
7. [Resolution Edge Cases](#7-resolution-edge-cases)
8. [System Safety Protocols](#8-system-safety-protocols)
9. [Attack Vectors & Mitigations](#9-attack-vectors--mitigations)
10. [Circuit Breakers](#10-circuit-breakers)

---

## 1. Overview

This document catalogs all identified edge cases and their handling protocols. Each edge case includes:
- **Scenario:** Description of the edge case
- **Risk:** Potential impact if unhandled
- **Mitigation:** How the system handles it
- **Implementation:** Code/validation reference

---

## 2. Trading Edge Cases

### 2.1 Buying with Zero Balance

**Scenario:** User attempts to buy shares with insufficient points.

**Risk:** Negative balance, insolvency.

**Mitigation:**
```typescript
// Check performed before any trade execution
if (user.balance < amountIn) {
  throw new Error('INSUFFICIENT_BALANCE');
}
```

**Validation:** Pre-check balance before deducting. Transaction rolls back on any failure.

---

### 2.2 Selling More Shares Than Owned

**Scenario:** User attempts to sell 100 shares but only owns 50.

**Risk:** Negative share holdings, counterfeiting.

**Mitigation:**
```typescript
const currentShares = side === 'YES' ? portfolio.yesQty : portfolio.noQty;

if (currentShares < sharesIn) {
  throw new Error(`INSUFFICIENT_SHARES: Have ${currentShares}, need ${sharesIn}`);
}
```

**Validation:** Check holdings before sell execution.

---

### 2.3 Trade Amount Below Minimum

**Scenario:** User attempts to trade $0.0001 (below minimum).

**Risk:** Dust accumulation, fee exploitation.

**Mitigation:**
```typescript
const MIN_TRADE_SIZE = 1000n; // $0.001

if (amountIn < MIN_TRADE_SIZE) {
  throw new Error('MINIMUM_TRADE_SIZE: Trade must be at least 1000 MicroPoints');
}
```

**Validation:** Reject trades below 1000 MicroPoints ($0.001).

---

### 2.4 Slippage Exceeds Tolerance

**Scenario:** User expects 100 shares but price moved, would only receive 80.

**Risk:** Poor user experience, unexpected losses.

**Mitigation:**
```typescript
if (sharesOut < minSharesOut) {
  throw new Error(`SLIPPAGE_EXCEEDED: Expected min ${minSharesOut}, got ${sharesOut}`);
}
```

**Validation:** `minSharesOut` parameter required on all buy/sell operations.

---

### 2.5 Trade on Inactive Market

**Scenario:** User tries to buy shares on a paused or resolved market.

**Risk:** Invalid trades, double payouts.

**Mitigation:**
```typescript
const market = await tx.query.markets.findFirst({
  where: eq(markets.id, marketId),
});

if (market.status !== 'ACTIVE') {
  throw new Error(`MARKET_NOT_ACTIVE: Market is ${market.status}`);
}
```

**Validation:** Check market status at beginning of every trade.

---

### 2.6 Integer Overflow

**Scenario:** Extremely large trade amounts cause BigInt overflow.

**Risk:** Calculation errors, exploitation.

**Mitigation:**
```typescript
const MAX_TRADE_AMOUNT = 10n ** 18n; // 1 trillion Points

if (amountIn > MAX_TRADE_AMOUNT) {
  throw new Error('AMOUNT_TOO_LARGE');
}
```

**Validation:** Cap maximum trade size.

---

### 2.7 Conflicting Positions (Buying Opposite Side)

**Scenario:** User holds YES shares but wants to buy NO.

**Risk:** Confusion about position, inefficient capital usage.

**Mitigation:** **Automatic Netting Protocol**
- System detects opposite position
- Executes fee-free exit of opposite position
- Combines proceeds with new capital
- Executes single entry trade

See [ENGINE_LOGIC.md - Netting Protocol](./ENGINE_LOGIC.md#7-netting-protocol).

---

## 3. Pool & Liquidity Edge Cases

### 3.1 Empty Pool (Zero Liquidity)

**Scenario:** Pool has 0 YES or 0 NO tokens.

**Risk:** Division by zero, infinite prices.

**Mitigation:**
```typescript
if (yesQty <= 0n || noQty <= 0n) {
  throw new Error('POOL_EMPTY: Cannot trade in empty pool');
}
```

**Prevention:** Genesis protocol ensures pools are never created empty.

---

### 3.2 Extreme Price (99.99% / 0.01%)

**Scenario:** Heavy buying pushes price to 0.9999 (nearly certain).

**Risk:** Price can't reach 1.0, mathematical edge cases.

**Mitigation:**
1. **Warning at 95%:** UI displays high-risk warning
2. **No hard cap:** Let market find equilibrium
3. **Monitor for manipulation:** Alert admin on rapid price movements

```typescript
const prices = calculatePrices(pool);
if (prices.yesPrice > 0.95 * PRICE_PRECISION || prices.noPrice > 0.95 * PRICE_PRECISION) {
  emitWarning('EXTREME_PRICE', { marketId, prices });
}
```

---

### 3.3 k-Invariant Decrease

**Scenario:** Bug causes k to decrease after a trade.

**Risk:** Insolvency, arbitrage extraction.

**Mitigation:**
```typescript
const kBefore = poolYes * poolNo;
// ... execute trade ...
const kAfter = newPoolYes * newPoolNo;

if (kAfter < kBefore) {
  throw new Error('INVARIANT_VIOLATION: k decreased after swap');
}
```

**Validation:** Every trade verifies k >= k_before.

---

### 3.4 Pool Drain Attack

**Scenario:** Attacker tries to drain all liquidity from one side.

**Risk:** Market becomes non-functional.

**Mitigation:**
1. **Price curve protects:** Exponentially increasing cost prevents full drain
2. **Fee injection:** LP fees increase k over time
3. **Monitoring:** Alert on pools with >98% imbalance

---

### 3.5 Rounding Accumulation

**Scenario:** Many small trades accumulate rounding errors.

**Risk:** Eventual insolvency due to "dust leakage."

**Mitigation:**
1. **Floor user outputs:** Users always receive floor(calculation)
2. **Ceiling fees:** House always receives ceil(fee)
3. **LP fee injection:** Any dust stays in pool

```typescript
// Ceiling division for fees
const fee = (amount * FEE_RATE_BP + BP_DIVISOR - 1n) / BP_DIVISOR;

// Floor is automatic with BigInt division
const sharesOut = outputPool - newOutputPool; // Truncates decimal
```

---

## 4. Concurrency Edge Cases

### 4.1 Race Condition on Same Pool

**Scenario:** Two users trade simultaneously, both read same pool state.

**Risk:** One trade overwrites the other, incorrect final state.

**Mitigation:** **Optimistic Locking**
```typescript
const updateResult = await tx
  .update(liquidityPools)
  .set({
    yesQty: newYesQty,
    noQty: newNoQty,
    versionId: versionBefore + 1,
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(liquidityPools.id, marketId),
      eq(liquidityPools.versionId, versionBefore) // Only if version matches
    )
  );

if (updateResult.rowCount === 0) {
  throw new Error('OPTIMISTIC_LOCK_FAIL');
}
```

**Resolution:** Failed trade should be retried by client.

---

### 4.2 Double-Spend Attack

**Scenario:** User submits same trade twice rapidly.

**Risk:** Balance deducted once but shares credited twice.

**Mitigation:** **Idempotency Keys**
```typescript
if (idempotencyKey) {
  const existing = await tx.query.tradeLedger.findFirst({
    where: eq(tradeLedger.idempotencyKey, idempotencyKey),
  });
  if (existing) {
    throw new Error('IDEMPOTENCY_CONFLICT');
  }
}
```

**API Requirement:** Clients should send unique idempotency keys.

---

### 4.3 Simultaneous Resolution and Trade

**Scenario:** Admin resolves market while user is mid-trade.

**Risk:** User trade succeeds on resolved market.

**Mitigation:**
1. Market status check at trade start
2. Transaction isolation (`REPEATABLE READ`)
3. Resolution transaction locks market row first

---

### 4.4 Concurrent Balance Modifications

**Scenario:** User trades in two markets simultaneously, both deduct balance.

**Risk:** Overdraft if both succeed.

**Mitigation:**
```typescript
// Always check and deduct balance atomically
const user = await tx.query.users.findFirst({
  where: eq(users.id, userId),
});

if (user.balance < amountIn) {
  throw new Error('INSUFFICIENT_BALANCE');
}

// Deduct immediately in same transaction
await tx.update(users)
  .set({ balance: user.balance - amountIn })
  .where(eq(users.id, userId));
```

---

## 5. User Account Edge Cases

### 5.0 Supabase Auth Session Edge Cases

**Scenario:** Session expires mid-operation or is tampered with.

**Risk:** Unauthorized access or operation failure mid-transaction.

**Mitigation:**
1. **Always use `getUser()` on server** - validates JWT with Supabase Auth server
2. **Never trust `getSession()`** - doesn't validate signature server-side
3. **Session validation before every protected operation**

```typescript
// CORRECT: Always validate session
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  throw new Error('UNAUTHORIZED');
}

// WRONG: Never do this on server
const { data: { session } } = await supabase.auth.getSession(); // Unvalidated!
```

---

### 5.0.1 Concurrent Login/Logout

**Scenario:** User logs out while a trade is in progress.

**Risk:** Trade completes for logged-out user.

**Mitigation:**
- Session is validated at the start of each request
- Long-running operations should re-validate mid-operation
- Database transactions are independent of session state once started

---

### 5.0.2 User Deleted from Supabase Auth

**Scenario:** Admin deletes user from Supabase Auth while they have active positions.

**Risk:** Orphaned positions, accounting inconsistency.

**Mitigation:**
- **Soft delete** users instead of hard delete (set `is_active = false`)
- If hard delete needed, handle cleanup in Drizzle transaction:

```typescript
// src/services/admin.service.ts
export async function deleteUser(userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Check for active positions
    const activePositions = await tx.query.portfolios.findMany({
      where: and(
        eq(portfolios.userId, userId),
        or(
          gt(portfolios.yesShares, 0n),
          gt(portfolios.noShares, 0n)
        )
      ),
    });

    if (activePositions.length > 0) {
      throw new Error('USER_HAS_ACTIVE_POSITIONS');
    }

    // 2. Soft delete user record
    await tx
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // 3. Delete from Supabase Auth (optional, after soft delete)
    // await supabaseAdmin.auth.admin.deleteUser(userId);
  });
}
```

**Note:** Positions remain in portfolios table for audit trail. Resolved markets still pay out to the associated user record.

---

### 5.1 Negative Balance

**Scenario:** Bug allows balance to go negative.

**Risk:** Insolvency, accounting errors.

**Mitigation:**
1. **Database constraint:** `CHECK (balance >= 0)`
2. **Application check:** Verify before every deduction
3. **Monitoring:** Alert on any negative balance

```sql
ALTER TABLE users ADD CONSTRAINT users_balance_non_negative CHECK (balance >= 0);
```

---

### 5.2 Registration Bonus Exploitation

**Scenario:** User creates multiple accounts to farm registration bonuses.

**Risk:** Inflation of points, unfair advantage.

**Mitigation:**
1. **Email verification:** Required before bonus granted
2. **Device fingerprinting:** Flag suspicious registrations
3. **IP rate limiting:** Max 3 registrations per IP per day
4. **Manual review:** Flag accounts with suspicious patterns

---

### 5.3 Admin Account Compromise

**Scenario:** Admin credentials are stolen.

**Risk:** Market manipulation, unauthorized point grants.

**Mitigation:**
1. **MFA required:** All admin accounts
2. **Audit logging:** All admin actions logged
3. **Limits on point grants:** Max single grant, daily limit
4. **Role separation:** No single admin can resolve + grant

---

### 5.4 Treasury Account Depletion

**Scenario:** Treasury account has insufficient balance for operations.

**Risk:** Genesis/resolution failures.

**Mitigation:**
1. **Monitor treasury balance:** Alert when < $1000
2. **Genesis uses house liquidity:** Doesn't require treasury balance
3. **Resolution funded by pool:** Winners paid from pool, not treasury

---

## 6. Market Lifecycle Edge Cases

### 6.1 Market Created Without Liquidity

**Scenario:** Market record exists but no liquidity pool.

**Risk:** Division by zero on price queries.

**Mitigation:**
- Genesis is atomic: market + pool created together
- Cannot activate market without pool

```typescript
// Genesis transaction
await tx.insert(markets).values({ id: marketId, ... });
await tx.insert(liquidityPools).values({ 
  id: marketId, // Same ID
  yesQty: seedAmount,
  noQty: seedAmount,
  ...
});
```

---

### 6.2 Market Closes While Trades Pending

**Scenario:** Market `closesAt` passes while user is mid-trade.

**Risk:** Trade succeeds after market should be closed.

**Mitigation:**
```typescript
// Behavior depends on close_behavior setting
if (market.closeBehavior === 'auto') {
  // Auto-close markets: block immediately
  if (market.closesAt && market.closesAt < new Date()) {
    throw new Error('MARKET_CLOSED: Past closing time');
  }
} else if (market.closeBehavior === 'auto_with_buffer') {
  // Buffer markets: block after buffer expires
  const bufferEnd = new Date(market.closesAt.getTime() + market.bufferMinutes * 60000);
  if (bufferEnd < new Date()) {
    throw new Error('MARKET_CLOSED: Buffer period expired');
  }
}
// 'manual' close_behavior: no automatic blocking (admin closes)
```

**Market Close Behavior System** (See SYSTEM_DESIGN.md Section 5.5):

Markets have a `close_behavior` field that determines how they transition:

| `close_behavior` | Behavior When `closes_at` Passes | Use Case |
|-----------------|----------------------------------|----------|
| `'auto'` | Immediately transition to PAUSED | Crypto prices, weather, exact-time events |
| `'manual'` | No auto-transition; admin closes | Soccer (added time), elections, awards |
| `'auto_with_buffer'` | Transition after `buffer_minutes` | Basketball (30 min OT buffer), football |

**Why Manual Close for Sports?**

Events like soccer have variable end times:
- Regular time: 90 minutes
- Added time: 1-15+ minutes (referee's discretion)
- Extra time: 30 minutes (in knockout matches)
- Penalty shootout: Variable

A market for "Will Team A win?" cannot auto-close at minute 90 because:
- The winning goal might come in added time (minute 94)
- Auto-closing would lock users out of trading during the decisive moment
- Users would be frustrated and the market would be inaccurate

**Required: Market Scheduler Worker** (See EPIC_10 - SCHEDULER stories)

A background worker handles close behavior:
1. For `auto` markets: Transition `ACTIVE` → `PAUSED` immediately when `closesAt` passes
2. For `auto_with_buffer` markets: Transition after buffer period expires
3. For `manual` markets: Queue admin reminder notifications
4. Alert on delayed resolutions (>24h, >48h escalations)

---

### 6.2.1 Manual Close Market - Admin Workflow

**Scenario:** Admin creates a soccer market with `close_behavior: 'manual'`.

**Expected Flow:**
1. Market `closes_at` passes (scheduled 90-minute mark)
2. Trading continues (market stays ACTIVE)
3. Admin watches the event
4. When event truly ends (after added time/extra time):
   - Admin clicks "Pause Trading" → Market becomes PAUSED
   - Admin resolves with YES/NO outcome

**Admin Dashboard Indicators:**

Markets past their `closes_at` but still ACTIVE show:
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Manual Close Markets - Action Required                    │
├─────────────────────────────────────────────────────────────┤
│ 🔵 "Will Man United win vs Liverpool?"                       │
│    closes_at: 2:30 PM (32 minutes ago)                      │
│    close_behavior: manual                                   │
│    Trading: STILL ACTIVE                                    │
│    [Pause Trading] [Resolve YES] [Resolve NO]               │
├─────────────────────────────────────────────────────────────┤
│ 🔵 "Lakers vs Celtics - Lakers win?"                        │
│    closes_at: 10:30 PM (18 minutes ago)                     │
│    close_behavior: auto_with_buffer (buffer: 30 min)        │
│    Trading: ACTIVE (buffer: 12 min remaining)               │
│    [Pause Early] [Wait for Buffer]                          │
└─────────────────────────────────────────────────────────────┘
```

---

### 6.2.2 Post-Event Betting Exploitation (Critical Edge Case)

**Scenario:** A manual-close market stays open after the event ends. Users who know the result place bets before admin closes the market.

**Example:**
1. Soccer match ends at 3:34 PM (Man United wins 2-1)
2. Admin is busy, doesn't close market until 3:50 PM
3. User sees result on TV at 3:35 PM, buys YES shares at 65¢
4. Market resolves YES → User profits unfairly

**Risk:** 
- Users exploit delayed closure to bet on known outcomes
- Honest users who bet before the event are disadvantaged
- Platform loses credibility and potentially money

**Solution: Event End Timestamp + Trade Voiding**

When resolving a manual-close market, admin specifies when the event **actually ended**. The system automatically voids all trades placed after that time.

**Resolution Flow (Updated):**

```typescript
interface ResolveMarketParams {
  marketId: string;
  resolution: 'YES' | 'NO';
  evidence: string;
  eventEndedAt: Date;  // NEW: When the event actually ended
}
```

**Step 1: Admin Resolves with Event End Time**
```
┌─────────────────────────────────────────────────────────────┐
│ Resolve Market: "Will Man United win vs Liverpool?"         │
├─────────────────────────────────────────────────────────────┤
│ Outcome:  ○ YES  ● NO  ○ Cancel                             │
│                                                             │
│ Evidence: "Final score: Liverpool 2 - Man United 1"         │
│                                                             │
│ ⏰ Event Ended At: [2024-12-15] [15:34] (required)          │
│                                                             │
│ ⚠️ 3 trades placed AFTER this time will be voided:          │
│    - user_abc: BUY YES 500 pts @ 3:35 PM                   │
│    - user_xyz: BUY YES 200 pts @ 3:41 PM                   │
│    - user_def: BUY NO 100 pts @ 3:48 PM                    │
│                                                             │
│ [Preview Voided Trades]  [Resolve & Void]                   │
└─────────────────────────────────────────────────────────────┘
```

**Step 2: System Voids Post-Event Trades**

```typescript
// Resolution with trade voiding
async function resolveMarketWithVoiding(params: ResolveMarketParams) {
  return await db.transaction(async (tx) => {
    // 1. Find trades placed AFTER event ended
    const postEventTrades = await tx.query.tradeLedger.findMany({
      where: and(
        eq(tradeLedger.marketId, params.marketId),
        gt(tradeLedger.createdAt, params.eventEndedAt),
        inArray(tradeLedger.action, ['BUY', 'SELL'])
      ),
    });

    // 2. Void each post-event trade
    for (const trade of postEventTrades) {
      await voidTrade(tx, trade, 'VOIDED_POST_EVENT');
    }

    // 3. Proceed with normal resolution for remaining trades
    await resolveMarket(tx, params);

    // 4. Notify affected users
    for (const trade of postEventTrades) {
      await queueService.add('notifications', {
        type: 'user:trade-voided',
        data: {
          userId: trade.userId,
          marketId: params.marketId,
          tradeId: trade.id,
          reason: 'Trade placed after event ended',
          refundAmount: trade.amountIn,
        },
      });
    }

    return {
      resolution: params.resolution,
      voidedTrades: postEventTrades.length,
      totalRefunded: postEventTrades.reduce((sum, t) => sum + t.amountIn, 0n),
    };
  });
}
```

**Step 3: Void Trade Logic**

```typescript
// Void a trade and refund the user
async function voidTrade(
  tx: Transaction,
  trade: TradeLedgerEntry,
  reason: string
) {
  // 1. Reverse portfolio changes
  if (trade.action === 'BUY') {
    // Remove shares that were bought
    await tx.update(portfolios)
      .set({
        yesQty: sql`yes_qty - ${trade.side === 'YES' ? trade.amountOut : 0n}`,
        noQty: sql`no_qty - ${trade.side === 'NO' ? trade.amountOut : 0n}`,
        yesCostBasis: sql`yes_cost_basis - ${trade.side === 'YES' ? trade.amountIn : 0n}`,
        noCostBasis: sql`no_cost_basis - ${trade.side === 'NO' ? trade.amountIn : 0n}`,
      })
      .where(and(
        eq(portfolios.userId, trade.userId),
        eq(portfolios.marketId, trade.marketId)
      ));

    // Refund points to user
    await tx.update(users)
      .set({ balance: sql`balance + ${trade.amountIn}` })
      .where(eq(users.id, trade.userId));
  }
  // Similar logic for SELL trades...

  // 2. Log the voiding
  await tx.insert(tradeLedger).values({
    userId: trade.userId,
    marketId: trade.marketId,
    action: 'VOID',
    side: trade.side,
    amountIn: trade.amountOut,  // Reverse: what they got
    amountOut: trade.amountIn,  // Reverse: what they paid (refund)
    sharesBefore: trade.sharesAfter,
    sharesAfter: trade.sharesBefore,
    feePaid: 0n,
    originalTradeId: trade.id,  // Reference to voided trade
    voidReason: reason,
  });
}
```

**Database Schema Addition:**

```sql
-- Add to trade_ledger for voiding support
ALTER TABLE trade_ledger ADD COLUMN original_trade_id UUID REFERENCES trade_ledger(id);
ALTER TABLE trade_ledger ADD COLUMN void_reason VARCHAR(100);

-- Add to markets for event end tracking
ALTER TABLE markets ADD COLUMN event_ended_at TIMESTAMPTZ;

-- Update action enum
ALTER TABLE trade_ledger DROP CONSTRAINT ledger_action_valid;
ALTER TABLE trade_ledger ADD CONSTRAINT ledger_action_valid CHECK (
  action IN ('BUY', 'SELL', 'MINT', 'MERGE', 'NET_SELL', 'GENESIS_MINT', 
             'RESOLUTION_PAYOUT', 'REFUND', 'DEPOSIT', 'WITHDRAW', 'VOID')
);
```

**User Notification:**

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Trade Voided                                              │
├─────────────────────────────────────────────────────────────┤
│ Your trade on "Will Man United win?" has been voided.       │
│                                                             │
│ Reason: Trade placed after the event ended                  │
│ Original trade: BUY YES @ 3:35 PM                          │
│ Event ended: 3:34 PM                                        │
│                                                             │
│ Refund: 500 Points returned to your balance                 │
│                                                             │
│ This is standard practice to ensure fair markets.           │
│ Trades placed after an event concludes cannot be honored.   │
└─────────────────────────────────────────────────────────────┘
```

**Prevention Measures:**

| Measure | Description |
|---------|-------------|
| **UI Warning** | Show "Event may have ended" banner for markets past `closes_at` |
| **Rate Limit** | Reduce trade frequency for markets past `closes_at` |
| **Higher Fees** | Optional: Charge higher fees for trades past `closes_at` |
| **Delay Execution** | Add 30-second delay for trades past `closes_at` (gives admin time) |
| **Admin Alerts** | Urgent notifications when trades occur on overdue markets |

**UI Warning for Markets Past closes_at:**

```
┌─────────────────────────────────────────────────────────────┐
│ ⚽ Will Manchester United win?                              │
│                                                             │
│ ⚠️ SCHEDULED END TIME HAS PASSED                            │
│ This event may have already concluded.                      │
│ Trades placed after the event ends will be voided.          │
│                                                             │
│ [YES: 65¢]  [NO: 35¢]                                       │
│                                                             │
│ Last updated: 3:32 PM | Scheduled end: 3:30 PM             │
└─────────────────────────────────────────────────────────────┘
```

---

### 6.3 Orphaned Positions After Market Deletion

**Scenario:** Admin deletes market with active positions.

**Risk:** Users lose shares with no recourse.

**Mitigation:**
- **No hard delete:** Markets can only be resolved or cancelled
- **Cancellation triggers refund:** All positions refunded

---

### 6.4 Re-Resolution Attempt

**Scenario:** Admin tries to resolve an already-resolved market.

**Risk:** Double payouts.

**Mitigation:**
```typescript
if (market.status === 'RESOLVED' || market.status === 'CANCELLED') {
  throw new Error('MARKET_ALREADY_FINAL: Cannot change resolution');
}
```

---

## 7. Resolution Edge Cases

### 7.1 No Holders at Resolution

**Scenario:** Market resolves but no one holds any shares.

**Risk:** Wasted processing, edge case errors.

**Mitigation:**
```typescript
const holders = await tx.query.portfolios.findMany({
  where: eq(portfolios.marketId, marketId),
});

if (holders.length === 0) {
  // Just mark resolved, no payouts needed
  await tx.update(markets).set({ status: 'RESOLVED', ... });
  return { totalWinners: 0, totalPayout: 0n };
}
```

---

### 7.2 Insufficient Pool for Payouts

**Scenario:** Pool somehow has less than needed to pay winners.

**Risk:** Incomplete payouts.

**Mitigation:**
1. **Mathematically impossible:** CPMM guarantees sufficient collateral
2. **Validation anyway:** Check pool value >= total winning shares
3. **House backstop:** Treasury covers any shortfall (shouldn't happen)

---

### 7.3 Ambiguous Resolution

**Scenario:** Event outcome is genuinely unclear.

**Risk:** User disputes, legal issues.

**Mitigation:**
1. **Cancellation option:** Admin cancels instead of resolving
2. **Refund protocol:** All users get cost basis back
3. **Clear resolution criteria:** In market description

---

### 7.4 Delayed Resolution

**Scenario:** Admin forgets to resolve market for weeks.

**Risk:** User funds locked, poor experience.

**Mitigation:**
1. **Background Scheduler (Required):** See EPIC_10 - SCHEDULER-3
   - Auto-alert admins at 24h, 48h escalation levels
   - Dashboard widget showing markets awaiting resolution
   - Email/Slack notifications for critical delays
2. **Dashboard Visibility:** Prominent widget showing pending resolutions with urgency indicators
3. **User-initiated resolution:** (Future) Allow users to trigger resolution with proof
4. **Auto-extend:** If no resolution, market auto-extends (requires admin approval)

**Alert Escalation:**
| Time Since Close | Alert Level | Action |
|-----------------|-------------|--------|
| 0-24 hours | Info | Dashboard indicator |
| 24-48 hours | Warning | Email to admins |
| 48+ hours | Critical | SMS/Slack + red dashboard warning |

---

## 8. System Safety Protocols

### 8.1 The Floor Rule

**All rounding must favor the house.**

| Operation | Rounding | Beneficiary |
|-----------|----------|-------------|
| User receives shares | Floor (down) | House |
| User receives points | Floor (down) | House |
| Fee calculation | Ceiling (up) | House |
| Pool share calculation | Ceiling (up) | Pool |

### 8.2 Atomic Operations

**All state changes must be atomic.**

Every trading operation follows this pattern:
```typescript
await db.transaction(async (tx) => {
  // 1. Validate preconditions
  // 2. Calculate new state
  // 3. Verify invariants
  // 4. Update all tables atomically
  // 5. Log to audit trail
});
```

### 8.3 Audit Trail

**Every state change must be logged.**

The `trade_ledger` captures:
- User ID
- Market ID
- Action type
- Input/output amounts
- Fees paid
- Pool state before/after
- Timestamp

---

## 9. Attack Vectors & Mitigations

### 9.1 Dust Attack

**Vector:** Spam tiny trades to exploit rounding errors.

**Mitigation:**
1. Minimum trade size: 1000 MicroPoints
2. Rate limiting: 30 trades/minute
3. Floor on outputs, ceiling on fees

### 9.2 Sandwich Attack

**Vector:** Front-run user trade, back-run to profit from price movement.

**Mitigation:**
1. Slippage protection: `minSharesOut` required
2. No public mempool (unlike blockchain)
3. Batch processing: Consider for high-volume

### 9.3 Price Manipulation

**Vector:** Whale moves price with large trade, profits on reversal.

**Mitigation:**
1. Fee: 2% makes round-trip expensive
2. Monitoring: Alert on >20% price movement in 1 minute
3. Pause capability: Admin can pause suspicious markets

### 9.4 Sybil Attack (Multi-Account)

**Vector:** Create multiple accounts for bonuses or voting.

**Mitigation:**
1. Email verification required
2. Device fingerprinting
3. IP rate limiting
4. Manual review for patterns

### 9.5 API Abuse

**Vector:** Script rapid trades to overwhelm system.

**Mitigation:**
1. Rate limiting: 30 req/min for trades
2. Idempotency keys required
3. Request queuing under load
4. IP blocking for abuse

---

## 10. Circuit Breakers

### 10.1 k-Invariant Monitor

**Trigger:** k decreases after any operation

**Action:**
1. Reject the transaction
2. Alert engineering immediately
3. Log all parameters for debugging

```typescript
if (newK < kBefore) {
  logger.error('CIRCUIT_BREAKER: k decreased', { 
    marketId, kBefore, newK, operation 
  });
  throw new Error('INVARIANT_VIOLATION');
}
```

### 10.2 Rapid Price Movement

**Trigger:** Price moves >30% in 5 minutes

**Action:**
1. Pause market automatically
2. Alert admin
3. Require manual review to resume

### 10.3 High Error Rate

**Trigger:** >5% of requests failing for 5 minutes

**Action:**
1. Alert engineering
2. Enable debug logging
3. Consider temporary trading pause

### 10.4 Database Connection Exhaustion

**Trigger:** Connection pool >90% utilized

**Action:**
1. Reject new requests with 503
2. Alert engineering
3. Increase pool size dynamically

### 10.5 Memory Pressure

**Trigger:** Node.js heap >80% utilized

**Action:**
1. Trigger garbage collection
2. Reject non-critical requests
3. Alert for scaling decision

---

## Summary Checklist

Before deploying, verify:

- [ ] All monetary calculations use BigInt
- [ ] Floor applied to user outputs
- [ ] Ceiling applied to fees
- [ ] Database constraints prevent negative values
- [ ] Optimistic locking on all pool updates
- [ ] Idempotency keys supported
- [ ] Minimum trade size enforced
- [ ] Market status checked before trades
- [ ] k-invariant verified after swaps
- [ ] Slippage protection required
- [ ] Rate limiting configured
- [ ] Audit trail captures all operations
- [ ] Circuit breakers active
- [ ] Monitoring and alerting configured

---

## Related Documents

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — System architecture overview
- [ENGINE_LOGIC.md](./ENGINE_LOGIC.md) — Trading engine implementation
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — Database constraints

---

*Document Version: 3.1 | Safety Review: Complete*

