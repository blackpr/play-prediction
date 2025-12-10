# Documentation AGENTS.md

Guide for AI agents navigating and updating project documentation. See also: [Root AGENTS.md](../AGENTS.md)

---

## 📚 Documentation Map

### Core Documents

| Document | Content | When to Reference |
|----------|---------|-------------------|
| [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) | Architecture, economic model, CPMM rules | Understanding system behavior |
| [`BACKEND_ARCHITECTURE.md`](./BACKEND_ARCHITECTURE.md) | Code organization, hexagonal/DDD patterns | Backend structure decisions |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | Drizzle schema, tables, constraints | Database changes |
| [`API_SPECIFICATION.md`](./API_SPECIFICATION.md) | REST API endpoints, request/response formats | API implementation |
| [`ENGINE_LOGIC.md`](./ENGINE_LOGIC.md) | CPMM math, trading operations, formulas | Trading logic |
| [`WEBSOCKET_PROTOCOL.md`](./WEBSOCKET_PROTOCOL.md) | Real-time communication protocol | WebSocket features |
| [`EDGE_CASES.md`](./EDGE_CASES.md) | Edge case handling, safety protocols | Error scenarios |

### Frontend Documents

| Document | Content |
|----------|---------|
| [`FRONTEND_ARCHITECTURE.md`](./FRONTEND_ARCHITECTURE.md) | TanStack Start setup, routing |
| [`FRONTEND_COMPONENTS.md`](./FRONTEND_COMPONENTS.md) | UI components, design system |
| [`FRONTEND_STATE.md`](./FRONTEND_STATE.md) | State management patterns |

### Architecture Decisions

| Document | Content |
|----------|---------|
| [`ADR_001_MARKET_CLOSE_BEHAVIOR.md`](./ADR_001_MARKET_CLOSE_BEHAVIOR.md) | Market closing logic for sports events |

---

## 📖 User Stories

Located in `docs/stories/`:

| Epic | Content |
|------|---------|
| [`00_INTRODUCTION.md`](./stories/00_INTRODUCTION.md) | Story structure overview |
| [`EPIC_00_PROJECT_SETUP.md`](./stories/EPIC_00_PROJECT_SETUP.md) | Infrastructure, DI, testing |
| [`EPIC_01_AUTHENTICATION.md`](./stories/EPIC_01_AUTHENTICATION.md) | Auth flows |
| [`EPIC_02_USER_PROFILE___BALANCE.md`](./stories/EPIC_02_USER_PROFILE___BALANCE.md) | User management |
| [`EPIC_03_MARKETS_LISTING.md`](./stories/EPIC_03_MARKETS_LISTING.md) | Market list views |
| [`EPIC_04_MARKET_DETAIL.md`](./stories/EPIC_04_MARKET_DETAIL.md) | Market detail page |
| [`EPIC_05_TRADING_ENGINE__CORE_.md`](./stories/EPIC_05_TRADING_ENGINE__CORE_.md) | CPMM implementation |
| [`EPIC_06_TRADING_UI.md`](./stories/EPIC_06_TRADING_UI.md) | Trading interface |
| [`EPIC_07_MINT___MERGE.md`](./stories/EPIC_07_MINT___MERGE.md) | Mint/merge operations |
| [`EPIC_08_PORTFOLIO.md`](./stories/EPIC_08_PORTFOLIO.md) | Portfolio management |
| [`EPIC_09_ADMIN___MARKET_MANAGEMENT.md`](./stories/EPIC_09_ADMIN___MARKET_MANAGEMENT.md) | Admin market controls |
| [`EPIC_10_ADMIN___RESOLUTION___POINTS.md`](./stories/EPIC_10_ADMIN___RESOLUTION___POINTS.md) | Resolution, points grants |
| [`EPIC_11_REAL_TIME_UPDATES__WEBSOCKET_.md`](./stories/EPIC_11_REAL_TIME_UPDATES__WEBSOCKET_.md) | WebSocket integration |
| [`EPIC_12_WEBHOOKS__OPTIONAL_FUTURE_.md`](./stories/EPIC_12_WEBHOOKS__OPTIONAL_FUTURE_.md) | Webhook system |

---

## 🔑 Key Concepts

### Virtual Points System

- Users receive welcome bonus on registration (10 Points = 10,000,000 MicroPoints)
- Points **cannot be withdrawn** or exchanged for real currency
- Admins can grant additional points

### The 3 Immutable Rules

| Rule | Name | Description |
|------|------|-------------|
| **Rule 1** | Conservation of Mass | Shares only created by minting (1 YES + 1 NO for 1 Point) |
| **Rule 2** | Exclusivity | Users cannot hold conflicting positions |
| **Rule 3** | The Floor Rule | Payouts round DOWN, fees round UP |

### The Golden Equation

```
P_YES + P_NO = 1.0

P_YES = NO_qty / (YES_qty + NO_qty)
P_NO = YES_qty / (YES_qty + NO_qty)
```

### Market States

```
DRAFT → ACTIVE ⇄ PAUSED → RESOLVED
                 ↓
              CANCELLED
```

---

## 📝 Updating Documentation

### When to Update

- **New feature** → Update relevant spec doc + add story
- **API change** → Update `API_SPECIFICATION.md`
- **Schema change** → Update `DATABASE_SCHEMA.md`
- **Architecture decision** → Create ADR document

### Document Style

- Use Markdown tables for structured data
- Include code examples with TypeScript
- Keep version numbers updated
- Add "Last Updated" dates

### Story Format

```markdown
### STORY-ID: Title

**As a** [role]
**I want** [action]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] Criteria 1
- [ ] Criteria 2

**References:** [Related docs]
```

---

## 🔍 Quick Lookup

### Need to understand...

| Topic | Read |
|-------|------|
| How trading works | `ENGINE_LOGIC.md` |
| API endpoints | `API_SPECIFICATION.md` |
| Database tables | `DATABASE_SCHEMA.md` |
| Market lifecycle | `SYSTEM_DESIGN.md` Section 4 |
| Error handling | `EDGE_CASES.md` |
| Frontend routing | `FRONTEND_ARCHITECTURE.md` |
| WebSocket messages | `WEBSOCKET_PROTOCOL.md` |

### Need to implement...

| Feature | Start with |
|---------|------------|
| New API endpoint | `API_SPECIFICATION.md` + Epic story |
| Trading operation | `ENGINE_LOGIC.md` |
| UI component | `FRONTEND_COMPONENTS.md` |
| Background job | `SYSTEM_DESIGN.md` Section 5.5 |
| Market close behavior | `ADR_001_MARKET_CLOSE_BEHAVIOR.md` |

---

*See also: [Root AGENTS.md](../AGENTS.md) | [Backend AGENTS.md](../backend/AGENTS.md) | [Frontend AGENTS.md](../frontend/AGENTS.md)*
