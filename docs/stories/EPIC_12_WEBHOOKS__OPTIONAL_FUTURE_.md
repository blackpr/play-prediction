## Epic 12: Webhooks (Optional/Future)

**Goal:** External integrations can receive event notifications.

### WEBHOOK-1: Implement Webhook System

**As an** integrator  
**I want** webhook notifications  
**So that** I can build integrations

**Events:**
- `market.activated` - Market goes live
- `market.resolved` - Outcome decided
- `market.cancelled` - Market cancelled
- `trade.executed` - Trade completed
- `payout.completed` - Resolution payout done

**Acceptance Criteria:**
- [ ] Webhook registration endpoint (admin)
- [ ] Event payload with signature (HMAC-SHA256)
- [ ] Retry logic for failed deliveries
- [ ] Webhook log for debugging

**References:** API_SPECIFICATION.md Section 7

---

## Additional Cross-Cutting Requirements

### Security Requirements (from EDGE_CASES.md)

- [ ] All monetary calculations use BigInt (no floats)
- [ ] Floor rounding on user outputs
- [ ] Ceiling rounding on fees
- [ ] k-invariant never decreases
- [ ] Rate limiting: 30 req/min for trades
- [ ] Session validation on every request
- [ ] Idempotency keys for all mutations

### Performance Requirements (from SYSTEM_DESIGN.md)

- [ ] Support 10,000 concurrent WebSocket connections
- [ ] API latency p50 < 50ms
- [ ] API latency p99 < 200ms
- [ ] Price update latency < 100ms

### Monitoring Requirements (from SYSTEM_DESIGN.md)

- [ ] Log all trades to audit trail
- [ ] Track k-invariant per market
- [ ] Alert on k decrease
- [ ] Alert on high error rate (>5%)
- [ ] Alert on rapid price movement (>20% in 1 minute)

---

## Story Sizing Guide

| Size | Points | Description |
|------|--------|-------------|
| XS | 1 | Simple config, single function |
| S | 2 | Single endpoint or component |
| M | 3 | Complex endpoint or feature |
| L | 5 | Multi-part feature |
| XL | 8 | Large feature with many parts |

---

## Summary by Epic

| Epic | Stories | Description |
|------|---------|-------------|
| 0 | 14 | Project Setup (infrastructure, Supabase CLI, testing, CI/CD, DI container) |
| 1 | 12 | Authentication (login, register, session, password reset, email templates) |
| 2 | 14 | User Profile & Balance (UI components, accessibility, error handling) |
| 3 | 8 | Markets Listing (search, filter, categories) |
| 4 | 9 | Market Detail (chart, metadata, time intervals, recent trades) |
| 5 | 7 | Trading Engine (CPMM, fees, validation) |
| 6 | 10 | Trading UI (form, slippage, price impact, confirmation) |
| 7 | 4 | Mint & Merge (netting protocol) |
| 8 | 7 | Portfolio (positions, P&L, history, empty states) |
| 9 | 9 | Admin - Market Management (CRUD, skewed genesis, images) |
| 10 | 16 | Admin - Resolution, Points, Users, Audit (resolve, cancel, grant, users, audit log, categories) |
| 11 | 11 | WebSocket (connection, channels, reconnect, updates) |
| 12 | 1 | Webhooks (Future) |
| **Total** | **122** | |

---

## Implementation Priority

### Phase 1: Foundation (MVP Core)
1. Epic 0 (SETUP-1 through SETUP-6) - Project setup with Supabase CLI
2. Epic 1 (AUTH-1 through AUTH-4) - Backend auth
3. Epic 5 (TRADE-1 through TRADE-7) - Trading engine
4. Epic 3 (MARKET-1, MARKET-2) - Markets API

### Phase 2: Basic UI
1. Epic 0 (SETUP-7 through SETUP-13) - Infrastructure, testing & CI/CD
2. Epic 1 (AUTH-5 through AUTH-9) - Frontend auth
3. Epic 3 (MARKET-3 through MARKET-8) - Markets UI
4. Epic 2 (USER-1 through USER-5) - User profile

### Phase 3: Trading Flow
1. Epic 4 (DETAIL-1 through DETAIL-8) - Market detail page
2. Epic 6 (TRADEUI-1 through TRADEUI-7) - Core trading UI
3. Epic 7 (MINT-1 through MINT-4) - Mint & merge
4. Epic 8 (PORT-1 through PORT-7) - Portfolio

### Phase 4: Admin & Resolution
1. Epic 9 (ADMIN-1 through ADMIN-9) - Admin market management
2. Epic 10 (RESOLVE-1 through RESOLVE-5, ADMIN-14 through ADMIN-24, SCHEDULER-1 through SCHEDULER-7) - Resolution, points, user management, audit, scheduler worker

### Phase 5: Real-Time & Polish
1. Epic 11 (WS-1 through WS-8) - WebSocket real-time updates
2. Epic 6 (TRADEUI-8 through TRADEUI-10) - Price impact, slippage, confirmations
3. Epic 2 (USER-6 through USER-14) - UI polish, accessibility, error handling
4. Epic 1 (AUTH-10, AUTH-11) - Password reset, session handling

### Phase 6: Advanced Features (Optional)
1. Epic 12 - Webhooks
2. Admin advanced: Categories management (ADMIN-23), audit log viewer (ADMIN-22)

---

*Document Version: 1.3 | Total Stories: 122 | Last Reviewed: December 9, 2025*