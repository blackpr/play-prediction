# Backend Architecture

**Version:** 1.0  
**Pattern:** Domain-Driven Design + Hexagonal Architecture  
**Language:** TypeScript  
**Runtime:** Node.js 20+  
**Last Updated:** December 2025

> **Framework Agnostic:** The business logic is completely decoupled from the HTTP framework. Swapping Fastify for Express, Hono, or any other framework only requires changes to the `presentation` layer.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Layer Responsibilities](#3-layer-responsibilities)
4. [Domain Layer](#4-domain-layer)
5. [Application Layer](#5-application-layer)
6. [Infrastructure Layer](#6-infrastructure-layer)
7. [Presentation Layer](#7-presentation-layer)
8. [Dependency Injection](#8-dependency-injection)
9. [Testing Strategy](#9-testing-strategy)
10. [Framework Swapping Guide](#10-framework-swapping-guide)

---

## 1. Architecture Overview

### 1.1 Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Fastify Routes  │  │ WebSocket       │  │ CLI Commands    │             │
│  │ (HTTP Adapter)  │  │ (WS Adapter)    │  │ (CLI Adapter)   │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         USE CASES (Services)                         │   │
│  │  ExecuteTrade │ CreateMarket │ ResolveMarket │ AuthenticateUser     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                          ┌─────────┴─────────┐                             │
│                          │    PORTS (Interfaces)                           │
│                          │  IMarketRepo │ IUserRepo │ ITradeRepo           │
│                          └─────────┬─────────┘                             │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                           DOMAIN LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ENTITIES & VALUE OBJECTS                        │   │
│  │  Market │ User │ Trade │ Portfolio │ MicroPoints │ ShareQuantity    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DOMAIN SERVICES                               │   │
│  │  CPMMEngine │ FeeCalculator │ NettingService │ SettlementService    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                        INFRASTRUCTURE LAYER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ DrizzleMarketRepo│ │DrizzleUserRepo  │  │ DrizzleTradeRepo│             │
│  │ (DB Adapter)    │  │ (DB Adapter)    │  │ (DB Adapter)    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│  ┌─────────────────┐  ┌─────────────────┐                                  │
│  │ SupabaseAuth    │  │ EventEmitter    │                                  │
│  │ (Auth Adapter)  │  │ (Event Adapter) │                                  │
│  └─────────────────┘  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Dependency Rule

**Dependencies only point inward:**
- Presentation → Application → Domain ← Infrastructure
- Domain layer has ZERO external dependencies
- Application layer defines interfaces (ports) that infrastructure implements

---

## 2. Project Structure

```
src/
├── domain/                      # Pure business logic (NO external deps)
│   ├── entities/
│   │   ├── market.ts
│   │   ├── user.ts
│   │   ├── trade.ts
│   │   ├── portfolio.ts
│   │   └── liquidity-pool.ts
│   │
│   ├── value-objects/
│   │   ├── micro-points.ts
│   │   ├── share-quantity.ts
│   │   ├── market-id.ts
│   │   ├── user-id.ts
│   │   ├── probability.ts
│   │   └── fee-breakdown.ts
│   │
│   ├── services/
│   │   ├── cpmm-engine.ts       # Core AMM math
│   │   ├── fee-calculator.ts
│   │   ├── netting-service.ts
│   │   └── settlement-service.ts
│   │
│   ├── events/
│   │   ├── domain-event.ts
│   │   ├── trade-executed.ts
│   │   ├── market-resolved.ts
│   │   └── market-created.ts
│   │
│   └── errors/
│       ├── domain-error.ts
│       ├── insufficient-balance.ts
│       ├── market-not-active.ts
│       ├── slippage-exceeded.ts
│       └── invariant-violated.ts
│
├── application/                 # Use cases & orchestration
│   ├── ports/                   # Interfaces (contracts)
│   │   ├── repositories/
│   │   │   ├── market-repository.ts
│   │   │   ├── user-repository.ts
│   │   │   ├── portfolio-repository.ts
│   │   │   └── trade-repository.ts
│   │   │
│   │   ├── services/
│   │   │   ├── auth-service.ts
│   │   │   ├── event-publisher.ts
│   │   │   └── transaction-manager.ts
│   │   │
│   │   └── index.ts             # Re-exports all ports
│   │
│   ├── use-cases/
│   │   ├── trading/
│   │   │   ├── execute-trade.ts
│   │   │   ├── execute-sell.ts
│   │   │   └── get-quote.ts
│   │   │
│   │   ├── markets/
│   │   │   ├── create-market.ts
│   │   │   ├── get-market.ts
│   │   │   ├── list-markets.ts
│   │   │   ├── resolve-market.ts
│   │   │   └── cancel-market.ts
│   │   │
│   │   ├── portfolio/
│   │   │   ├── get-portfolio.ts
│   │   │   └── get-trade-history.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── login.ts
│   │   │   ├── register.ts
│   │   │   └── logout.ts
│   │   │
│   │   └── admin/
│   │       ├── grant-points.ts
│   │       ├── pause-market.ts
│   │       └── process-refunds.ts
│   │
│   └── dto/                     # Data Transfer Objects
│       ├── trade-request.ts
│       ├── trade-response.ts
│       ├── market-response.ts
│       └── portfolio-response.ts
│
├── infrastructure/              # External implementations
│   ├── database/
│   │   ├── drizzle/
│   │   │   ├── client.ts        # Drizzle + Supabase connection
│   │   │   ├── schema.ts        # Drizzle schema definitions
│   │   │   └── migrations/
│   │   │
│   │   └── repositories/
│   │       ├── drizzle-market-repository.ts
│   │       ├── drizzle-user-repository.ts
│   │       ├── drizzle-portfolio-repository.ts
│   │       └── drizzle-trade-repository.ts
│   │
│   ├── auth/
│   │   └── supabase-auth-service.ts
│   │
│   ├── events/
│   │   └── in-memory-event-publisher.ts
│   │
│   └── transaction/
│       └── drizzle-transaction-manager.ts
│
├── presentation/                # HTTP/WS layer (Framework-specific)
│   ├── fastify/                 # Can be swapped entirely
│   │   ├── server.ts
│   │   ├── plugins/
│   │   │   ├── auth.ts
│   │   │   ├── error-handler.ts
│   │   │   └── cors.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── markets.routes.ts
│   │   │   ├── trading.routes.ts
│   │   │   ├── portfolio.routes.ts
│   │   │   └── admin.routes.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── require-auth.ts
│   │   │   ├── require-admin.ts
│   │   │   └── rate-limit.ts
│   │   │
│   │   └── schemas/             # Request/Response validation (Zod)
│   │       ├── auth.schema.ts
│   │       ├── markets.schema.ts
│   │       ├── trading.schema.ts
│   │       └── common.schema.ts
│   │
│   └── websocket/
│       ├── ws-server.ts
│       └── handlers/
│           ├── price-updates.ts
│           └── trade-notifications.ts
│
├── shared/                      # Cross-cutting concerns
│   ├── config/
│   │   └── index.ts
│   ├── logger/
│   │   └── index.ts
│   └── utils/
│       └── bigint-helpers.ts
│
└── main.ts                      # Composition root
```

---

## 3. Layer Responsibilities

### 3.1 Summary Table

| Layer | Contains | Dependencies | Can Import From |
|-------|----------|--------------|-----------------|
| **Domain** | Entities, Value Objects, Domain Services, Domain Events | NONE | Nothing |
| **Application** | Use Cases, Ports (interfaces), DTOs | Domain | Domain only |
| **Infrastructure** | Repository implementations, External services | Application, Domain | Application, Domain |
| **Presentation** | Routes, Controllers, Middleware, Validation | Application | Application only |

### 3.2 Key Rules

1. **Domain** is pure TypeScript - no imports from `node_modules` except type utilities
2. **Application** defines interfaces (ports) - never concrete implementations
3. **Infrastructure** implements the ports defined in Application
4. **Presentation** is thin - only maps HTTP to use cases

---

## 4. Domain Layer

### 4.1 Value Objects

Value objects are immutable and validated on construction:

```typescript
// src/domain/value-objects/micro-points.ts

export class MicroPoints {
  private readonly _value: bigint

  private constructor(value: bigint) {
    this._value = value
  }

  static fromPoints(points: number): MicroPoints {
    if (points < 0) {
      throw new InvalidAmountError('Points cannot be negative')
    }
    return new MicroPoints(BigInt(Math.floor(points * 1_000_000)))
  }

  static fromMicro(micro: bigint): MicroPoints {
    if (micro < 0n) {
      throw new InvalidAmountError('MicroPoints cannot be negative')
    }
    return new MicroPoints(micro)
  }

  static zero(): MicroPoints {
    return new MicroPoints(0n)
  }

  get value(): bigint {
    return this._value
  }

  get asPoints(): number {
    return Number(this._value) / 1_000_000
  }

  add(other: MicroPoints): MicroPoints {
    return new MicroPoints(this._value + other._value)
  }

  subtract(other: MicroPoints): MicroPoints {
    const result = this._value - other._value
    if (result < 0n) {
      throw new InsufficientBalanceError('Insufficient balance')
    }
    return new MicroPoints(result)
  }

  multiply(factor: bigint): MicroPoints {
    return new MicroPoints(this._value * factor)
  }

  isGreaterThan(other: MicroPoints): boolean {
    return this._value > other._value
  }

  isZero(): boolean {
    return this._value === 0n
  }

  equals(other: MicroPoints): boolean {
    return this._value === other._value
  }
}
```

```typescript
// src/domain/value-objects/share-quantity.ts

export class ShareQuantity {
  private readonly _value: bigint

  private constructor(value: bigint) {
    this._value = value
  }

  static of(value: bigint): ShareQuantity {
    if (value < 0n) {
      throw new InvalidQuantityError('Share quantity cannot be negative')
    }
    return new ShareQuantity(value)
  }

  static zero(): ShareQuantity {
    return new ShareQuantity(0n)
  }

  get value(): bigint {
    return this._value
  }

  add(other: ShareQuantity): ShareQuantity {
    return new ShareQuantity(this._value + other._value)
  }

  subtract(other: ShareQuantity): ShareQuantity {
    const result = this._value - other._value
    if (result < 0n) {
      throw new InsufficientSharesError('Insufficient shares')
    }
    return new ShareQuantity(result)
  }

  isZero(): boolean {
    return this._value === 0n
  }

  isGreaterThan(other: ShareQuantity): boolean {
    return this._value > other._value
  }
}
```

### 4.2 Entities

Entities have identity and mutable state:

```typescript
// src/domain/entities/market.ts

import { MarketId } from '../value-objects/market-id'
import { MicroPoints } from '../value-objects/micro-points'
import { MarketNotActiveError } from '../errors/market-not-active'

export type MarketStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'RESOLVED' | 'CANCELLED'
export type MarketOutcome = 'YES' | 'NO' | null

export interface MarketProps {
  id: MarketId
  question: string
  description: string
  status: MarketStatus
  outcome: MarketOutcome
  closesAt: Date
  createdAt: Date
  resolvedAt: Date | null
  creatorId: string
  versionId: number
}

export class Market {
  private props: MarketProps

  constructor(props: MarketProps) {
    this.props = { ...props }
  }

  get id(): MarketId {
    return this.props.id
  }

  get question(): string {
    return this.props.question
  }

  get status(): MarketStatus {
    return this.props.status
  }

  get outcome(): MarketOutcome {
    return this.props.outcome
  }

  get versionId(): number {
    return this.props.versionId
  }

  get closesAt(): Date {
    return this.props.closesAt
  }

  isActive(): boolean {
    return this.props.status === 'ACTIVE'
  }

  isResolved(): boolean {
    return this.props.status === 'RESOLVED'
  }

  isCancelled(): boolean {
    return this.props.status === 'CANCELLED'
  }

  canTrade(): boolean {
    return this.isActive() && new Date() < this.props.closesAt
  }

  assertCanTrade(): void {
    if (!this.canTrade()) {
      throw new MarketNotActiveError(this.props.id.value)
    }
  }

  activate(): void {
    if (this.props.status !== 'PENDING') {
      throw new InvalidStateTransitionError('Can only activate PENDING markets')
    }
    this.props.status = 'ACTIVE'
    this.props.versionId++
  }

  pause(): void {
    if (this.props.status !== 'ACTIVE') {
      throw new InvalidStateTransitionError('Can only pause ACTIVE markets')
    }
    this.props.status = 'PAUSED'
    this.props.versionId++
  }

  resolve(outcome: 'YES' | 'NO'): void {
    if (this.props.status !== 'ACTIVE' && this.props.status !== 'PAUSED') {
      throw new InvalidStateTransitionError('Cannot resolve market in current state')
    }
    this.props.status = 'RESOLVED'
    this.props.outcome = outcome
    this.props.resolvedAt = new Date()
    this.props.versionId++
  }

  cancel(): void {
    if (this.props.status === 'RESOLVED') {
      throw new InvalidStateTransitionError('Cannot cancel resolved market')
    }
    this.props.status = 'CANCELLED'
    this.props.versionId++
  }

  toSnapshot(): MarketProps {
    return { ...this.props }
  }
}
```

### 4.3 Domain Services

Pure business logic with no external dependencies:

```typescript
// src/domain/services/cpmm-engine.ts

import { MicroPoints } from '../value-objects/micro-points'
import { ShareQuantity } from '../value-objects/share-quantity'
import { InvariantViolatedError } from '../errors/invariant-violated'

export interface PoolState {
  yesShares: bigint
  noShares: bigint
}

export interface SwapResult {
  sharesOut: ShareQuantity
  newPoolState: PoolState
  priceImpact: number
}

export interface SellResult {
  pointsOut: MicroPoints
  newPoolState: PoolState
}

/**
 * CPMM Engine - Pure mathematical operations
 * No database, no external services, just math
 */
export class CPMMEngine {
  /**
   * Calculate shares received when buying with given input
   * Uses floor rounding (favors protocol)
   */
  static calculateBuyShares(
    pool: PoolState,
    side: 'YES' | 'NO',
    inputMicro: bigint
  ): SwapResult {
    const { yesShares, noShares } = pool
    const k = yesShares * noShares

    // Validate invariant
    if (k <= 0n) {
      throw new InvariantViolatedError('Pool invariant is zero or negative')
    }

    let sharesOut: bigint
    let newYes: bigint
    let newNo: bigint

    if (side === 'YES') {
      // Buying YES: add to NO pool, calculate YES out
      newNo = noShares + inputMicro
      newYes = k / newNo // Floor division (BigInt default)
      sharesOut = yesShares - newYes
    } else {
      // Buying NO: add to YES pool, calculate NO out
      newYes = yesShares + inputMicro
      newNo = k / newYes // Floor division
      sharesOut = noShares - newNo
    }

    // Validate new k >= old k (invariant protection)
    const newK = newYes * newNo
    if (newK < k) {
      throw new InvariantViolatedError('Swap would decrease invariant')
    }

    // Calculate price impact
    const oldPrice = side === 'YES'
      ? Number(noShares) / Number(yesShares + noShares)
      : Number(yesShares) / Number(yesShares + noShares)
    const newPrice = side === 'YES'
      ? Number(newNo) / Number(newYes + newNo)
      : Number(newYes) / Number(newYes + newNo)
    const priceImpact = Math.abs(newPrice - oldPrice) / oldPrice

    return {
      sharesOut: ShareQuantity.of(sharesOut),
      newPoolState: { yesShares: newYes, noShares: newNo },
      priceImpact
    }
  }

  /**
   * Calculate points received when selling shares
   * Uses floor rounding (favors protocol)
   */
  static calculateSellPoints(
    pool: PoolState,
    side: 'YES' | 'NO',
    sharesToSell: bigint
  ): SellResult {
    const { yesShares, noShares } = pool
    const k = yesShares * noShares

    let pointsOut: bigint
    let newYes: bigint
    let newNo: bigint

    if (side === 'YES') {
      // Selling YES: add to YES pool, calculate NO out
      newYes = yesShares + sharesToSell
      newNo = k / newYes // Floor division
      pointsOut = noShares - newNo
    } else {
      // Selling NO: add to NO pool, calculate YES out
      newNo = noShares + sharesToSell
      newYes = k / newNo // Floor division
      pointsOut = yesShares - newYes
    }

    // Validate invariant
    const newK = newYes * newNo
    if (newK < k) {
      throw new InvariantViolatedError('Sell would decrease invariant')
    }

    return {
      pointsOut: MicroPoints.fromMicro(pointsOut),
      newPoolState: { yesShares: newYes, noShares: newNo }
    }
  }

  /**
   * Get current prices from pool state
   */
  static getPrices(pool: PoolState): { yes: number; no: number } {
    const total = pool.yesShares + pool.noShares
    return {
      yes: Number(pool.noShares) / Number(total),
      no: Number(pool.yesShares) / Number(total)
    }
  }

  /**
   * Validate pool state
   */
  static validatePool(pool: PoolState): void {
    if (pool.yesShares <= 0n || pool.noShares <= 0n) {
      throw new InvariantViolatedError('Pool shares must be positive')
    }
  }
}
```

```typescript
// src/domain/services/fee-calculator.ts

import { MicroPoints } from '../value-objects/micro-points'

export interface FeeBreakdown {
  grossAmount: MicroPoints
  vaultFee: MicroPoints      // 1.0% to treasury
  liquidityFee: MicroPoints  // 1.0% to pool
  netAmount: MicroPoints     // Amount after fees
  totalFeeRate: number       // 0.02 (2%)
}

/**
 * Fee Calculator - Uses ceiling rounding for fees (favors protocol)
 */
export class FeeCalculator {
  private static readonly VAULT_FEE_BPS = 100n      // 1.00%
  private static readonly LIQUIDITY_FEE_BPS = 100n  // 1.00%
  private static readonly BPS_DENOMINATOR = 10000n

  /**
   * Calculate fees for BUY operation (fees taken from input)
   */
  static calculateBuyFees(inputMicro: bigint): FeeBreakdown {
    const gross = MicroPoints.fromMicro(inputMicro)

    // Ceiling division: (a + b - 1) / b
    const vaultFee = MicroPoints.fromMicro(
      this.ceilDiv(inputMicro * this.VAULT_FEE_BPS, this.BPS_DENOMINATOR)
    )
    const liquidityFee = MicroPoints.fromMicro(
      this.ceilDiv(inputMicro * this.LIQUIDITY_FEE_BPS, this.BPS_DENOMINATOR)
    )

    const totalFees = vaultFee.add(liquidityFee)
    const netAmount = gross.subtract(totalFees)

    return {
      grossAmount: gross,
      vaultFee,
      liquidityFee,
      netAmount,
      totalFeeRate: 0.02
    }
  }

  /**
   * Calculate fees for SELL operation (fees taken from output)
   */
  static calculateSellFees(outputMicro: bigint): FeeBreakdown {
    const gross = MicroPoints.fromMicro(outputMicro)

    const vaultFee = MicroPoints.fromMicro(
      this.ceilDiv(outputMicro * this.VAULT_FEE_BPS, this.BPS_DENOMINATOR)
    )
    const liquidityFee = MicroPoints.fromMicro(
      this.ceilDiv(outputMicro * this.LIQUIDITY_FEE_BPS, this.BPS_DENOMINATOR)
    )

    const totalFees = vaultFee.add(liquidityFee)
    const netAmount = gross.subtract(totalFees)

    return {
      grossAmount: gross,
      vaultFee,
      liquidityFee,
      netAmount,
      totalFeeRate: 0.02
    }
  }

  /**
   * Ceiling division for BigInt
   */
  private static ceilDiv(a: bigint, b: bigint): bigint {
    return (a + b - 1n) / b
  }
}
```

### 4.4 Domain Errors

```typescript
// src/domain/errors/domain-error.ts

export abstract class DomainError extends Error {
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// src/domain/errors/insufficient-balance.ts
export class InsufficientBalanceError extends DomainError {
  readonly code = 'INSUFFICIENT_BALANCE'

  constructor(required: bigint, available: bigint) {
    super(`Insufficient balance: required ${required}, available ${available}`)
  }
}

// src/domain/errors/market-not-active.ts
export class MarketNotActiveError extends DomainError {
  readonly code = 'MARKET_NOT_ACTIVE'

  constructor(marketId: string) {
    super(`Market ${marketId} is not active for trading`)
  }
}

// src/domain/errors/slippage-exceeded.ts
export class SlippageExceededError extends DomainError {
  readonly code = 'SLIPPAGE_EXCEEDED'

  constructor(expected: bigint, actual: bigint) {
    super(`Slippage exceeded: expected min ${expected}, got ${actual}`)
  }
}

// src/domain/errors/invariant-violated.ts
export class InvariantViolatedError extends DomainError {
  readonly code = 'INVARIANT_VIOLATED'
}
```

---

## 5. Application Layer

### 5.1 Ports (Interfaces)

```typescript
// src/application/ports/repositories/market-repository.ts

import { Market } from '../../../domain/entities/market'
import { MarketId } from '../../../domain/value-objects/market-id'

export interface MarketFilters {
  status?: Market['status']
  creatorId?: string
  closesAfter?: Date
  closesBefore?: Date
}

export interface PaginationOptions {
  limit: number
  offset: number
}

export interface IMarketRepository {
  findById(id: MarketId): Promise<Market | null>
  findByIdForUpdate(id: MarketId): Promise<Market | null>  // Pessimistic lock
  findMany(filters: MarketFilters, pagination: PaginationOptions): Promise<Market[]>
  count(filters: MarketFilters): Promise<number>
  save(market: Market): Promise<void>
  update(market: Market, expectedVersion: number): Promise<boolean>  // Optimistic lock
}
```

```typescript
// src/application/ports/repositories/portfolio-repository.ts

import { Portfolio } from '../../../domain/entities/portfolio'
import { MarketId } from '../../../domain/value-objects/market-id'
import { UserId } from '../../../domain/value-objects/user-id'

export interface IPortfolioRepository {
  findByUserAndMarket(userId: UserId, marketId: MarketId): Promise<Portfolio | null>
  findByUser(userId: UserId): Promise<Portfolio[]>
  findByMarket(marketId: MarketId): Promise<Portfolio[]>
  save(portfolio: Portfolio): Promise<void>
  update(portfolio: Portfolio): Promise<void>
}
```

```typescript
// src/application/ports/services/auth-service.ts

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
}

export interface IAuthService {
  validateSession(cookies: string): Promise<AuthenticatedUser | null>
  signIn(email: string, password: string): Promise<{ user: AuthenticatedUser; cookies: string[] }>
  signUp(email: string, password: string): Promise<{ user: AuthenticatedUser; cookies: string[] }>
  signOut(cookies: string): Promise<{ cookies: string[] }>
}
```

```typescript
// src/application/ports/services/transaction-manager.ts

export type TransactionCallback<T> = (tx: unknown) => Promise<T>

export interface ITransactionManager {
  execute<T>(callback: TransactionCallback<T>): Promise<T>
}
```

### 5.2 Use Cases

```typescript
// src/application/use-cases/trading/execute-trade.ts

import { IMarketRepository } from '../../ports/repositories/market-repository'
import { IPortfolioRepository } from '../../ports/repositories/portfolio-repository'
import { IUserRepository } from '../../ports/repositories/user-repository'
import { ITradeRepository } from '../../ports/repositories/trade-repository'
import { ILiquidityPoolRepository } from '../../ports/repositories/liquidity-pool-repository'
import { ITransactionManager } from '../../ports/services/transaction-manager'
import { IEventPublisher } from '../../ports/services/event-publisher'
import { CPMMEngine } from '../../../domain/services/cpmm-engine'
import { FeeCalculator } from '../../../domain/services/fee-calculator'
import { NettingService } from '../../../domain/services/netting-service'
import { MicroPoints } from '../../../domain/value-objects/micro-points'
import { MarketId } from '../../../domain/value-objects/market-id'
import { UserId } from '../../../domain/value-objects/user-id'
import { TradeExecuted } from '../../../domain/events/trade-executed'
import { SlippageExceededError } from '../../../domain/errors/slippage-exceeded'
import { InsufficientBalanceError } from '../../../domain/errors/insufficient-balance'

export interface ExecuteTradeInput {
  userId: string
  marketId: string
  side: 'YES' | 'NO'
  amountMicro: bigint
  minSharesAccepted: bigint
}

export interface ExecuteTradeOutput {
  tradeId: string
  sharesReceived: bigint
  averagePrice: number
  fees: {
    vault: bigint
    liquidity: bigint
    total: bigint
  }
  newPrices: {
    yes: number
    no: number
  }
}

export class ExecuteTradeUseCase {
  constructor(
    private readonly marketRepo: IMarketRepository,
    private readonly userRepo: IUserRepository,
    private readonly portfolioRepo: IPortfolioRepository,
    private readonly poolRepo: ILiquidityPoolRepository,
    private readonly tradeRepo: ITradeRepository,
    private readonly txManager: ITransactionManager,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(input: ExecuteTradeInput): Promise<ExecuteTradeOutput> {
    const userId = UserId.of(input.userId)
    const marketId = MarketId.of(input.marketId)

    return this.txManager.execute(async (tx) => {
      // 1. Load and validate market
      const market = await this.marketRepo.findByIdForUpdate(marketId)
      if (!market) {
        throw new MarketNotFoundError(input.marketId)
      }
      market.assertCanTrade()

      // 2. Load user and validate balance
      const user = await this.userRepo.findById(userId)
      if (!user) {
        throw new UserNotFoundError(input.userId)
      }
      
      const inputAmount = MicroPoints.fromMicro(input.amountMicro)
      if (user.balance.value < inputAmount.value) {
        throw new InsufficientBalanceError(inputAmount.value, user.balance.value)
      }

      // 3. Load pool state
      const pool = await this.poolRepo.findByMarket(marketId)
      if (!pool) {
        throw new PoolNotFoundError(input.marketId)
      }

      // 4. Load user's portfolio for netting
      const portfolio = await this.portfolioRepo.findByUserAndMarket(userId, marketId)

      // 5. Execute netting if user has opposing position
      const oppositeSide = input.side === 'YES' ? 'NO' : 'YES'
      const opposingShares = portfolio 
        ? (oppositeSide === 'YES' ? portfolio.yesShares : portfolio.noShares)
        : 0n

      let netInput = input.amountMicro
      let nettingCredit = 0n

      if (opposingShares > 0n) {
        const nettingResult = NettingService.calculate(
          inputAmount,
          opposingShares,
          pool.getState()
        )
        netInput = nettingResult.remainingInput.value
        nettingCredit = nettingResult.exitCredit.value
      }

      // 6. Calculate fees (only on non-netted portion)
      const feeBreakdown = FeeCalculator.calculateBuyFees(netInput)

      // 7. Execute CPMM swap
      const swapResult = CPMMEngine.calculateBuyShares(
        pool.getState(),
        input.side,
        feeBreakdown.netAmount.value
      )

      // 8. Validate slippage
      if (swapResult.sharesOut.value < input.minSharesAccepted) {
        throw new SlippageExceededError(input.minSharesAccepted, swapResult.sharesOut.value)
      }

      // 9. Update all entities
      user.deductBalance(inputAmount)
      if (nettingCredit > 0n) {
        user.addBalance(MicroPoints.fromMicro(nettingCredit))
      }

      pool.updateState(swapResult.newPoolState)
      pool.addLiquidityFee(feeBreakdown.liquidityFee)

      if (portfolio) {
        portfolio.addShares(input.side, swapResult.sharesOut)
        if (opposingShares > 0n) {
          portfolio.deductShares(oppositeSide, ShareQuantity.of(opposingShares))
        }
        portfolio.updateCostBasis(input.side, inputAmount)
      } else {
        // Create new portfolio
        const newPortfolio = Portfolio.create({
          userId,
          marketId,
          initialShares: swapResult.sharesOut,
          side: input.side,
          costBasis: inputAmount
        })
        await this.portfolioRepo.save(newPortfolio)
      }

      // 10. Create trade record
      const trade = Trade.create({
        userId,
        marketId,
        side: input.side,
        direction: 'BUY',
        sharesAmount: swapResult.sharesOut.value,
        pointsAmount: input.amountMicro,
        vaultFee: feeBreakdown.vaultFee.value,
        liquidityFee: feeBreakdown.liquidityFee.value,
        priceAtTrade: CPMMEngine.getPrices(swapResult.newPoolState)[input.side.toLowerCase()]
      })

      // 11. Persist changes
      await this.userRepo.update(user)
      await this.poolRepo.update(pool)
      if (portfolio) {
        await this.portfolioRepo.update(portfolio)
      }
      await this.tradeRepo.save(trade)

      // 12. Update market version (optimistic lock)
      const updated = await this.marketRepo.update(market, market.versionId - 1)
      if (!updated) {
        throw new ConcurrentModificationError('Market was modified by another transaction')
      }

      // 13. Publish domain event
      await this.eventPublisher.publish(new TradeExecuted({
        tradeId: trade.id.value,
        marketId: input.marketId,
        userId: input.userId,
        side: input.side,
        shares: swapResult.sharesOut.value,
        newPrices: CPMMEngine.getPrices(swapResult.newPoolState)
      }))

      return {
        tradeId: trade.id.value,
        sharesReceived: swapResult.sharesOut.value,
        averagePrice: Number(input.amountMicro) / Number(swapResult.sharesOut.value),
        fees: {
          vault: feeBreakdown.vaultFee.value,
          liquidity: feeBreakdown.liquidityFee.value,
          total: feeBreakdown.vaultFee.value + feeBreakdown.liquidityFee.value
        },
        newPrices: CPMMEngine.getPrices(swapResult.newPoolState)
      }
    })
  }
}
```

---

## 6. Infrastructure Layer

### 6.1 Repository Implementation

```typescript
// src/infrastructure/database/repositories/drizzle-market-repository.ts

import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '../drizzle/client'
import { markets } from '../drizzle/schema'
import { Market } from '../../../domain/entities/market'
import { MarketId } from '../../../domain/value-objects/market-id'
import { IMarketRepository, MarketFilters, PaginationOptions } from '../../../application/ports/repositories/market-repository'

export class DrizzleMarketRepository implements IMarketRepository {
  async findById(id: MarketId): Promise<Market | null> {
    const [row] = await db
      .select()
      .from(markets)
      .where(eq(markets.id, id.value))
      .limit(1)

    return row ? this.toDomain(row) : null
  }

  async findByIdForUpdate(id: MarketId): Promise<Market | null> {
    // Use raw SQL for SELECT FOR UPDATE
    const [row] = await db.execute(
      sql`SELECT * FROM ${markets} WHERE id = ${id.value} FOR UPDATE`
    )

    return row ? this.toDomain(row) : null
  }

  async findMany(filters: MarketFilters, pagination: PaginationOptions): Promise<Market[]> {
    const conditions = []

    if (filters.status) {
      conditions.push(eq(markets.status, filters.status))
    }
    if (filters.creatorId) {
      conditions.push(eq(markets.creatorId, filters.creatorId))
    }
    if (filters.closesAfter) {
      conditions.push(gte(markets.closesAt, filters.closesAfter))
    }
    if (filters.closesBefore) {
      conditions.push(lte(markets.closesAt, filters.closesBefore))
    }

    const rows = await db
      .select()
      .from(markets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(markets.createdAt)

    return rows.map(row => this.toDomain(row))
  }

  async count(filters: MarketFilters): Promise<number> {
    const conditions = []

    if (filters.status) {
      conditions.push(eq(markets.status, filters.status))
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(markets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return result.count
  }

  async save(market: Market): Promise<void> {
    const snapshot = market.toSnapshot()
    await db.insert(markets).values({
      id: snapshot.id.value,
      question: snapshot.question,
      description: snapshot.description,
      status: snapshot.status,
      outcome: snapshot.outcome,
      closesAt: snapshot.closesAt,
      createdAt: snapshot.createdAt,
      resolvedAt: snapshot.resolvedAt,
      creatorId: snapshot.creatorId,
      versionId: snapshot.versionId
    })
  }

  async update(market: Market, expectedVersion: number): Promise<boolean> {
    const snapshot = market.toSnapshot()
    const result = await db
      .update(markets)
      .set({
        status: snapshot.status,
        outcome: snapshot.outcome,
        resolvedAt: snapshot.resolvedAt,
        versionId: snapshot.versionId
      })
      .where(
        and(
          eq(markets.id, snapshot.id.value),
          eq(markets.versionId, expectedVersion)
        )
      )

    return result.rowCount > 0
  }

  private toDomain(row: typeof markets.$inferSelect): Market {
    return new Market({
      id: MarketId.of(row.id),
      question: row.question,
      description: row.description,
      status: row.status as Market['status'],
      outcome: row.outcome as Market['outcome'],
      closesAt: row.closesAt,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      creatorId: row.creatorId,
      versionId: row.versionId
    })
  }
}
```

### 6.2 Auth Service Implementation

```typescript
// src/infrastructure/auth/supabase-auth-service.ts

import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { IAuthService, AuthenticatedUser } from '../../application/ports/services/auth-service'

export class SupabaseAuthService implements IAuthService {
  private createClient(cookies: string) {
    const cookieStore: Record<string, string> = {}
    const setCookies: string[] = []

    return {
      client: createServerClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return parseCookieHeader(cookies)
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore[name] = value
                setCookies.push(serializeCookieHeader(name, value, options))
              })
            }
          }
        }
      ),
      getCookies: () => setCookies
    }
  }

  async validateSession(cookies: string): Promise<AuthenticatedUser | null> {
    const { client } = this.createClient(cookies)

    // IMPORTANT: Always use getUser() on server - it validates the JWT
    const { data: { user }, error } = await client.auth.getUser()

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      role: user.user_metadata?.role || 'USER'
    }
  }

  async signIn(email: string, password: string) {
    const { client, getCookies } = this.createClient('')

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw new AuthenticationError(error.message)
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        role: data.user.user_metadata?.role || 'USER'
      },
      cookies: getCookies()
    }
  }

  async signUp(email: string, password: string) {
    const { client, getCookies } = this.createClient('')

    const { data, error } = await client.auth.signUp({
      email,
      password
    })

    if (error) {
      throw new AuthenticationError(error.message)
    }

    return {
      user: {
        id: data.user!.id,
        email: data.user!.email!,
        role: 'USER'
      },
      cookies: getCookies()
    }
  }

  async signOut(cookies: string) {
    const { client, getCookies } = this.createClient(cookies)

    await client.auth.signOut()

    return { cookies: getCookies() }
  }
}
```

### 6.3 Transaction Manager

```typescript
// src/infrastructure/transaction/drizzle-transaction-manager.ts

import { db } from '../database/drizzle/client'
import { ITransactionManager, TransactionCallback } from '../../application/ports/services/transaction-manager'

export class DrizzleTransactionManager implements ITransactionManager {
  async execute<T>(callback: TransactionCallback<T>): Promise<T> {
    return db.transaction(async (tx) => {
      return callback(tx)
    }, {
      isolationLevel: 'repeatable read'
    })
  }
}
```

---

## 7. Presentation Layer

### 7.1 Fastify Routes (Thin Wrappers)

```typescript
// src/presentation/fastify/routes/trading.routes.ts

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ExecuteTradeUseCase } from '../../../application/use-cases/trading/execute-trade'
import { container } from '../../../shared/container'

// Zod v4 schemas for validation
const executeTradeSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(['YES', 'NO']),
  amountMicro: z.string().transform(BigInt),  // Accept string, convert to BigInt
  minSharesAccepted: z.string().transform(BigInt)
})

const tradeResponseSchema = z.object({
  tradeId: z.string(),
  sharesReceived: z.string(),
  averagePrice: z.number(),
  fees: z.object({
    vault: z.string(),
    liquidity: z.string(),
    total: z.string()
  }),
  newPrices: z.object({
    yes: z.number(),
    no: z.number()
  })
})

export async function tradingRoutes(fastify: FastifyInstance) {
  const executeTradeUseCase = container.resolve(ExecuteTradeUseCase)

  fastify.post('/trade', {
    preHandler: [fastify.authenticate],  // Auth middleware
    schema: {
      body: executeTradeSchema,
      response: { 200: tradeResponseSchema }
    }
  }, async (request, reply) => {
    const body = executeTradeSchema.parse(request.body)
    const userId = request.user.id  // From auth middleware

    const result = await executeTradeUseCase.execute({
      userId,
      marketId: body.marketId,
      side: body.side,
      amountMicro: body.amountMicro,
      minSharesAccepted: body.minSharesAccepted
    })

    // Convert BigInt to string for JSON serialization
    return reply.send({
      tradeId: result.tradeId,
      sharesReceived: result.sharesReceived.toString(),
      averagePrice: result.averagePrice,
      fees: {
        vault: result.fees.vault.toString(),
        liquidity: result.fees.liquidity.toString(),
        total: result.fees.total.toString()
      },
      newPrices: result.newPrices
    })
  })
}
```

### 7.2 Auth Middleware

```typescript
// src/presentation/fastify/middleware/require-auth.ts

import { FastifyRequest, FastifyReply } from 'fastify'
import { IAuthService } from '../../../application/ports/services/auth-service'
import { container } from '../../../shared/container'

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string
      email: string
      role: 'USER' | 'ADMIN'
    }
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authService = container.resolve<IAuthService>('IAuthService')

  const cookies = request.headers.cookie ?? ''
  const user = await authService.validateSession(cookies)

  if (!user) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    })
  }

  request.user = user
}
```

### 7.3 Error Handler

```typescript
// src/presentation/fastify/plugins/error-handler.ts

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../../../domain/errors/domain-error'

const ERROR_STATUS_MAP: Record<string, number> = {
  'INSUFFICIENT_BALANCE': 400,
  'MARKET_NOT_ACTIVE': 400,
  'SLIPPAGE_EXCEEDED': 400,
  'INVARIANT_VIOLATED': 500,
  'MARKET_NOT_FOUND': 404,
  'USER_NOT_FOUND': 404,
  'CONCURRENT_MODIFICATION': 409,
  'UNAUTHORIZED': 401,
  'FORBIDDEN': 403
}

export function errorHandler(
  error: FastifyError | DomainError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the error
  request.log.error(error)

  // Handle domain errors
  if (error instanceof DomainError) {
    const status = ERROR_STATUS_MAP[error.code] || 400
    return reply.status(status).send({
      error: error.code,
      message: error.message
    })
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: (error as any).issues
    })
  }

  // Handle Fastify errors
  if ((error as FastifyError).statusCode) {
    return reply.status((error as FastifyError).statusCode!).send({
      error: error.name,
      message: error.message
    })
  }

  // Unknown errors
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  })
}
```

### 7.4 Server Composition

```typescript
// src/presentation/fastify/server.ts

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { errorHandler } from './plugins/error-handler'
import { requireAuth } from './middleware/require-auth'
import { authRoutes } from './routes/auth.routes'
import { marketRoutes } from './routes/markets.routes'
import { tradingRoutes } from './routes/trading.routes'
import { portfolioRoutes } from './routes/portfolio.routes'
import { adminRoutes } from './routes/admin.routes'

export async function createServer() {
  const fastify = Fastify({
    logger: true
  })

  // Global plugins
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL,
    credentials: true
  })

  // Decorators
  fastify.decorate('authenticate', requireAuth)

  // Error handler
  fastify.setErrorHandler(errorHandler)

  // Routes
  await fastify.register(authRoutes, { prefix: '/v1/auth' })
  await fastify.register(marketRoutes, { prefix: '/v1/markets' })
  await fastify.register(tradingRoutes, { prefix: '/v1/trading' })
  await fastify.register(portfolioRoutes, { prefix: '/v1/portfolio' })
  await fastify.register(adminRoutes, { prefix: '/v1/admin' })

  return fastify
}
```

---

## 8. Dependency Injection

### 8.1 Container Setup

```typescript
// src/shared/container.ts

type Constructor<T> = new (...args: any[]) => T
type Factory<T> = () => T

class Container {
  private singletons = new Map<string, any>()
  private factories = new Map<string, Factory<any>>()

  registerSingleton<T>(token: string, instance: T): void {
    this.singletons.set(token, instance)
  }

  registerFactory<T>(token: string, factory: Factory<T>): void {
    this.factories.set(token, factory)
  }

  resolve<T>(token: string | Constructor<T>): T {
    const key = typeof token === 'string' ? token : token.name

    // Check singletons first
    if (this.singletons.has(key)) {
      return this.singletons.get(key)
    }

    // Check factories
    if (this.factories.has(key)) {
      return this.factories.get(key)!()
    }

    throw new Error(`No binding found for ${key}`)
  }
}

export const container = new Container()
```

### 8.2 Composition Root

```typescript
// src/main.ts

import { container } from './shared/container'

// Infrastructure
import { DrizzleMarketRepository } from './infrastructure/database/repositories/drizzle-market-repository'
import { DrizzleUserRepository } from './infrastructure/database/repositories/drizzle-user-repository'
import { DrizzlePortfolioRepository } from './infrastructure/database/repositories/drizzle-portfolio-repository'
import { DrizzleLiquidityPoolRepository } from './infrastructure/database/repositories/drizzle-liquidity-pool-repository'
import { DrizzleTradeRepository } from './infrastructure/database/repositories/drizzle-trade-repository'
import { SupabaseAuthService } from './infrastructure/auth/supabase-auth-service'
import { DrizzleTransactionManager } from './infrastructure/transaction/drizzle-transaction-manager'
import { InMemoryEventPublisher } from './infrastructure/events/in-memory-event-publisher'

// Use Cases
import { ExecuteTradeUseCase } from './application/use-cases/trading/execute-trade'
import { CreateMarketUseCase } from './application/use-cases/markets/create-market'
import { ResolveMarketUseCase } from './application/use-cases/markets/resolve-market'

// Presentation
import { createServer } from './presentation/fastify/server'

async function bootstrap() {
  // Register infrastructure (singletons)
  container.registerSingleton('IMarketRepository', new DrizzleMarketRepository())
  container.registerSingleton('IUserRepository', new DrizzleUserRepository())
  container.registerSingleton('IPortfolioRepository', new DrizzlePortfolioRepository())
  container.registerSingleton('ILiquidityPoolRepository', new DrizzleLiquidityPoolRepository())
  container.registerSingleton('ITradeRepository', new DrizzleTradeRepository())
  container.registerSingleton('IAuthService', new SupabaseAuthService())
  container.registerSingleton('ITransactionManager', new DrizzleTransactionManager())
  container.registerSingleton('IEventPublisher', new InMemoryEventPublisher())

  // Register use cases (factories - create new instance per request if needed)
  container.registerSingleton(ExecuteTradeUseCase.name, new ExecuteTradeUseCase(
    container.resolve('IMarketRepository'),
    container.resolve('IUserRepository'),
    container.resolve('IPortfolioRepository'),
    container.resolve('ILiquidityPoolRepository'),
    container.resolve('ITradeRepository'),
    container.resolve('ITransactionManager'),
    container.resolve('IEventPublisher')
  ))

  container.registerSingleton(CreateMarketUseCase.name, new CreateMarketUseCase(
    container.resolve('IMarketRepository'),
    container.resolve('ILiquidityPoolRepository'),
    container.resolve('ITransactionManager')
  ))

  container.registerSingleton(ResolveMarketUseCase.name, new ResolveMarketUseCase(
    container.resolve('IMarketRepository'),
    container.resolve('IPortfolioRepository'),
    container.resolve('IUserRepository'),
    container.resolve('ITransactionManager'),
    container.resolve('IEventPublisher')
  ))

  // Start server
  const server = await createServer()
  await server.listen({ port: 3000, host: '0.0.0.0' })
  console.log('Server running on http://localhost:3000')
}

bootstrap().catch(console.error)
```

---

## 9. Testing Strategy

### 9.1 Domain Tests (Unit)

```typescript
// tests/domain/services/cpmm-engine.test.ts

import { describe, it, expect } from 'vitest'
import { CPMMEngine } from '../../../src/domain/services/cpmm-engine'

describe('CPMMEngine', () => {
  describe('calculateBuyShares', () => {
    it('should calculate YES shares correctly', () => {
      const pool = { yesShares: 1000000n, noShares: 1000000n }
      const result = CPMMEngine.calculateBuyShares(pool, 'YES', 100000n)

      expect(result.sharesOut.value).toBeGreaterThan(0n)
      expect(result.newPoolState.yesShares).toBeLessThan(pool.yesShares)
      expect(result.newPoolState.noShares).toBeGreaterThan(pool.noShares)
    })

    it('should preserve invariant', () => {
      const pool = { yesShares: 1000000n, noShares: 1000000n }
      const oldK = pool.yesShares * pool.noShares

      const result = CPMMEngine.calculateBuyShares(pool, 'YES', 100000n)
      const newK = result.newPoolState.yesShares * result.newPoolState.noShares

      expect(newK).toBeGreaterThanOrEqual(oldK)
    })
  })
})
```

### 9.2 Application Tests (Integration)

```typescript
// tests/application/use-cases/execute-trade.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { ExecuteTradeUseCase } from '../../../src/application/use-cases/trading/execute-trade'
import { InMemoryMarketRepository } from '../../mocks/in-memory-market-repository'
import { InMemoryUserRepository } from '../../mocks/in-memory-user-repository'
// ... other mocks

describe('ExecuteTradeUseCase', () => {
  let useCase: ExecuteTradeUseCase
  let marketRepo: InMemoryMarketRepository
  let userRepo: InMemoryUserRepository

  beforeEach(() => {
    marketRepo = new InMemoryMarketRepository()
    userRepo = new InMemoryUserRepository()
    // ... setup other mocks
    
    useCase = new ExecuteTradeUseCase(
      marketRepo,
      userRepo,
      // ... other dependencies
    )
  })

  it('should execute a trade successfully', async () => {
    // Setup test data
    await marketRepo.save(createTestMarket())
    await userRepo.save(createTestUser({ balance: 1000000n }))

    const result = await useCase.execute({
      userId: 'user-1',
      marketId: 'market-1',
      side: 'YES',
      amountMicro: 100000n,
      minSharesAccepted: 1n
    })

    expect(result.sharesReceived).toBeGreaterThan(0n)
  })
})
```

### 9.3 Presentation Tests (E2E)

```typescript
// tests/presentation/trading.routes.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../src/presentation/fastify/server'

describe('Trading Routes', () => {
  let server: Awaited<ReturnType<typeof createServer>>

  beforeAll(async () => {
    server = await createServer()
  })

  afterAll(async () => {
    await server.close()
  })

  it('POST /v1/trading/trade should require authentication', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/trading/trade',
      payload: {
        marketId: 'test-market',
        side: 'YES',
        amountMicro: '100000',
        minSharesAccepted: '1'
      }
    })

    expect(response.statusCode).toBe(401)
  })
})
```

---

## 10. Framework Swapping Guide

### 10.1 Switching to Express

To swap Fastify for Express, create a new presentation adapter:

```typescript
// src/presentation/express/server.ts

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/error-handler'
import { requireAuth } from './middleware/require-auth'
import { tradingRouter } from './routes/trading.routes'
import { marketRouter } from './routes/markets.routes'

export function createExpressServer() {
  const app = express()

  app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  // Routes - same use cases, different HTTP adapter
  app.use('/v1/trading', requireAuth, tradingRouter)
  app.use('/v1/markets', marketRouter)

  app.use(errorHandler)

  return app
}
```

```typescript
// src/presentation/express/routes/trading.routes.ts

import { Router } from 'express'
import { z } from 'zod'
import { ExecuteTradeUseCase } from '../../../application/use-cases/trading/execute-trade'
import { container } from '../../../shared/container'

const router = Router()
const executeTradeSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(['YES', 'NO']),
  amountMicro: z.string().transform(BigInt),
  minSharesAccepted: z.string().transform(BigInt)
})

router.post('/trade', async (req, res, next) => {
  try {
    const body = executeTradeSchema.parse(req.body)
    const useCase = container.resolve(ExecuteTradeUseCase)

    const result = await useCase.execute({
      userId: req.user.id,  // From auth middleware
      ...body
    })

    res.json({
      tradeId: result.tradeId,
      sharesReceived: result.sharesReceived.toString(),
      // ... rest of response
    })
  } catch (error) {
    next(error)
  }
})

export { router as tradingRouter }
```

### 10.2 Switching to Hono

```typescript
// src/presentation/hono/server.ts

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ExecuteTradeUseCase } from '../../application/use-cases/trading/execute-trade'
import { container } from '../../shared/container'

const app = new Hono()

app.use('*', cors({ origin: process.env.FRONTEND_URL, credentials: true }))

const tradeSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(['YES', 'NO']),
  amountMicro: z.string(),
  minSharesAccepted: z.string()
})

app.post('/v1/trading/trade', 
  authMiddleware,
  zValidator('json', tradeSchema),
  async (c) => {
    const body = c.req.valid('json')
    const userId = c.get('userId')
    const useCase = container.resolve(ExecuteTradeUseCase)

    const result = await useCase.execute({
      userId,
      marketId: body.marketId,
      side: body.side,
      amountMicro: BigInt(body.amountMicro),
      minSharesAccepted: BigInt(body.minSharesAccepted)
    })

    return c.json({ /* response */ })
  }
)

export default app
```

### 10.3 Key Points for Framework Swapping

| What Changes | What Stays The Same |
|--------------|---------------------|
| `src/presentation/` folder | `src/domain/` (all business logic) |
| Route handlers | `src/application/` (all use cases) |
| Middleware implementations | `src/infrastructure/` (all data access) |
| Request/Response mapping | Value objects, entities, domain services |
| Server configuration | Repository implementations |
| Error serialization | Transaction management |

**Steps to swap frameworks:**

1. Create new `src/presentation/{framework}/` folder
2. Implement routes that call the same use cases
3. Implement auth middleware using `IAuthService`
4. Implement error handler mapping `DomainError` to HTTP responses
5. Update `src/main.ts` to use new server
6. Delete old presentation folder

**Zero changes required in:**
- Domain layer
- Application layer
- Infrastructure layer
- Use case logic
- Business rules
- Database access

---

## Summary

This architecture provides:

1. **Framework Independence:** Swap Fastify for Express/Hono/anything by only changing the presentation layer
2. **Testability:** Domain logic can be tested without mocks; use cases with simple in-memory implementations
3. **Maintainability:** Clear boundaries make the codebase easier to understand and modify
4. **Scalability:** Use cases can be extracted to microservices if needed
5. **Type Safety:** TypeScript interfaces ensure contracts between layers

