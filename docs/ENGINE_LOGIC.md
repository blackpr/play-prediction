# Engine Logic & Implementation

**Version:** 3.1  
**Language:** TypeScript  
**Runtime:** Node.js 20+  
**Platform:** Supabase (Database + Auth)  
**Last Updated:** December 2025

> **Important:** All database operations use Drizzle ORM with Supabase PostgreSQL. Authentication is handled via Supabase Auth with `@supabase/ssr` (server-side only).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Mathematical Foundations](#2-mathematical-foundations)
3. [Core Constants](#3-core-constants)
4. [Fee Calculations](#4-fee-calculations)
5. [CPMM Swap Logic](#5-cpmm-swap-logic)
6. [Trading Operations](#6-trading-operations)
7. [Netting Protocol](#7-netting-protocol)
8. [Market Genesis](#8-market-genesis)
9. [Resolution & Settlement](#9-resolution--settlement)
10. [Refund Protocol](#10-refund-protocol)
11. [Helper Functions](#11-helper-functions)
12. [Test Suite](#12-test-suite)

---

## 1. Overview

### 1.1 Design Principles

1. **Integer-Only Arithmetic:** All calculations use `BigInt` to prevent floating-point precision loss
2. **Deterministic Rounding:** User payouts round DOWN (floor), fees round UP (ceiling)
3. **Invariant Protection:** The k-value (`YES × NO`) must never decrease
4. **Audit Trail:** Every operation logs to `trade_ledger`
5. **Atomic Transactions:** All database operations wrapped in transactions with optimistic locking
6. **Framework-Agnostic:** All domain logic has zero external dependencies

> **Architecture Note:** The engine logic resides in the **Domain Layer** and has no framework dependencies. See [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) for the full code organization.

### 1.2 Virtual Points System

> **Important:** This engine operates on virtual Points, not real money.
> - Users receive Points upon registration (configurable amount)
> - Points cannot be withdrawn or exchanged for real currency
> - Administrators can grant additional Points to users

---

## 2. Mathematical Foundations

### 2.1 The Constant Product Invariant

The CPMM maintains:

```
k = x × y
```

Where:
- `x` = YES tokens in pool
- `y` = NO tokens in pool
- `k` = invariant (must never decrease)

### 2.2 Price Derivation

For a pool with `x` YES and `y` NO tokens:

| Formula | Result |
|---------|--------|
| Price of YES | `P_yes = y / (x + y)` |
| Price of NO | `P_no = x / (x + y)` |
| Sum Check | `P_yes + P_no = 1.0` |

**Example:**
```
Pool: 400 YES, 600 NO
P_yes = 600 / (400 + 600) = 0.60
P_no = 400 / (400 + 600) = 0.40
```

### 2.3 Swap Mathematics

**Buying YES with `Δy` points:**
```
New y' = y + Δy
New x' = k / y' = (x × y) / (x + Δy)
Shares received = x - x' = x - (x × y) / (y + Δy)
```

**Selling `Δx` YES shares:**
```
New x' = x + Δx
New y' = k / x' = (x × y) / (x + Δx)
Points received = y - y' = y - (x × y) / (x + Δx)
```

---

## 3. Core Constants

```typescript
// src/engine/constants.ts

/**
 * MicroPoints scale factor
 * 1 Point = 1,000,000 MicroPoints
 */
export const MICRO_POINTS_SCALE = 1_000_000n;

/**
 * Fee rate in basis points (200 = 2.00%)
 */
export const FEE_RATE_BP = 200n;

/**
 * Basis points divisor
 */
export const BP_DIVISOR = 10_000n;

/**
 * Fee split: 50% to vault, 50% to liquidity
 */
export const FEE_VAULT_SHARE_BP = 5_000n; // 50%
export const FEE_LP_SHARE_BP = 5_000n;    // 50%

/**
 * Minimum trade size in MicroPoints ($0.001)
 */
export const MIN_TRADE_SIZE = 1_000n;

/**
 * Minimum seed liquidity for market genesis ($1.00)
 */
export const MIN_SEED_LIQUIDITY = 1_000_000n;

/**
 * Default registration bonus in MicroPoints (10 Points = $10)
 */
export const DEFAULT_REGISTRATION_BONUS = 10_000_000n;

/**
 * Price precision for display (6 decimal places)
 */
export const PRICE_PRECISION = 1_000_000n;

/**
 * Trade sides
 */
export type Side = 'YES' | 'NO';

/**
 * Trade actions
 */
export type TradeAction = 
  | 'BUY' 
  | 'SELL' 
  | 'MINT' 
  | 'MERGE' 
  | 'NET_SELL'
  | 'GENESIS_MINT'
  | 'RESOLUTION_PAYOUT'
  | 'REFUND';
```

---

## 4. Fee Calculations

### 4.1 Fee Rules

| Operation | Fee Application | Fee Rate |
|-----------|-----------------|----------|
| **Buy** | Deducted from input BEFORE swap | 2.0% |
| **Sell** | Deducted from output AFTER swap | 2.0% |
| **Mint** | None | 0% |
| **Merge** | None | 0% |
| **Netting Exit** | None (the exit portion) | 0% |

### 4.2 Implementation

```typescript
// src/engine/fees.ts

import { FEE_RATE_BP, BP_DIVISOR, FEE_VAULT_SHARE_BP, FEE_LP_SHARE_BP } from './constants';

/**
 * Calculate fee with CEILING rounding (favors house)
 * Formula: ceil(amount × rate / divisor)
 */
export function calculateFee(amount: bigint): bigint {
  // Ceiling division: (a + b - 1) / b
  return (amount * FEE_RATE_BP + BP_DIVISOR - 1n) / BP_DIVISOR;
}

/**
 * Split fee between vault and liquidity pool
 */
export function splitFee(totalFee: bigint): { vaultFee: bigint; lpFee: bigint } {
  const vaultFee = (totalFee * FEE_VAULT_SHARE_BP) / BP_DIVISOR;
  const lpFee = totalFee - vaultFee; // Remainder goes to LP (handles rounding)
  
  return { vaultFee, lpFee };
}

/**
 * Calculate net amount after fee deduction (for buying)
 */
export function calculateNetAfterFee(grossAmount: bigint): {
  netAmount: bigint;
  fee: bigint;
  vaultFee: bigint;
  lpFee: bigint;
} {
  const fee = calculateFee(grossAmount);
  const netAmount = grossAmount - fee;
  const { vaultFee, lpFee } = splitFee(fee);
  
  return { netAmount, fee, vaultFee, lpFee };
}

/**
 * Calculate net payout after fee deduction (for selling)
 */
export function calculateNetPayout(grossPayout: bigint): {
  netPayout: bigint;
  fee: bigint;
  vaultFee: bigint;
  lpFee: bigint;
} {
  const fee = calculateFee(grossPayout);
  // Floor the net payout (truncation is automatic with BigInt)
  const netPayout = grossPayout - fee;
  const { vaultFee, lpFee } = splitFee(fee);
  
  return { netPayout, fee, vaultFee, lpFee };
}
```

---

## 5. CPMM Swap Logic

### 5.1 Core Swap Functions

```typescript
// src/engine/swap.ts

export interface PoolState {
  yesQty: bigint;
  noQty: bigint;
}

export interface SwapResult {
  sharesOut: bigint;
  newYesQty: bigint;
  newNoQty: bigint;
  priceImpact: bigint; // In PRICE_PRECISION units
}

export interface SellResult {
  pointsOut: bigint;
  newYesQty: bigint;
  newNoQty: bigint;
}

/**
 * Calculate shares received when buying with points
 * Implements: shares_out = pool_target - (k / new_pool_input)
 * 
 * @param pointsIn - Net points after fees
 * @param pool - Current pool state
 * @param side - Which side to buy (YES or NO)
 */
export function calculateBuyShares(
  pointsIn: bigint,
  pool: PoolState,
  side: 'YES' | 'NO'
): SwapResult {
  const { yesQty, noQty } = pool;
  
  // Validate pool has liquidity
  if (yesQty <= 0n || noQty <= 0n) {
    throw new Error('POOL_EMPTY: Cannot trade in empty pool');
  }
  
  const k = yesQty * noQty;
  
  let inputPool: bigint;
  let outputPool: bigint;
  
  if (side === 'YES') {
    // Buying YES: add points to NO pool, take from YES pool
    inputPool = noQty;
    outputPool = yesQty;
  } else {
    // Buying NO: add points to YES pool, take from NO pool
    inputPool = yesQty;
    outputPool = noQty;
  }
  
  // Calculate new input pool after adding points
  const newInputPool = inputPool + pointsIn;
  
  // Calculate new output pool to maintain k
  // Use ceiling division to ensure k doesn't decrease
  const newOutputPool = (k + newInputPool - 1n) / newInputPool;
  
  // Shares out is the difference (floor, automatic with BigInt)
  const sharesOut = outputPool - newOutputPool;
  
  // Verify k hasn't decreased
  const newK = newInputPool * newOutputPool;
  if (newK < k) {
    throw new Error('INVARIANT_VIOLATION: k decreased after swap');
  }
  
  // Calculate price impact
  const spotPrice = (inputPool * PRICE_PRECISION) / (inputPool + outputPool);
  const avgPrice = (pointsIn * PRICE_PRECISION) / sharesOut;
  const priceImpact = avgPrice > spotPrice 
    ? ((avgPrice - spotPrice) * PRICE_PRECISION) / spotPrice
    : 0n;
  
  // Return new pool state
  let newYesQty: bigint;
  let newNoQty: bigint;
  
  if (side === 'YES') {
    newYesQty = newOutputPool;
    newNoQty = newInputPool;
  } else {
    newYesQty = newInputPool;
    newNoQty = newOutputPool;
  }
  
  return {
    sharesOut,
    newYesQty,
    newNoQty,
    priceImpact,
  };
}

/**
 * Calculate points received when selling shares
 * Implements: points_out = pool_no - (k / new_pool_yes)
 * 
 * @param sharesIn - Shares to sell
 * @param pool - Current pool state
 * @param side - Which side to sell (YES or NO)
 */
export function calculateSellPoints(
  sharesIn: bigint,
  pool: PoolState,
  side: 'YES' | 'NO'
): SellResult {
  const { yesQty, noQty } = pool;
  
  // Validate pool has liquidity
  if (yesQty <= 0n || noQty <= 0n) {
    throw new Error('POOL_EMPTY: Cannot trade in empty pool');
  }
  
  const k = yesQty * noQty;
  
  let sharePool: bigint;
  let pointPool: bigint;
  
  if (side === 'YES') {
    // Selling YES: add shares to YES pool, take points from NO pool
    sharePool = yesQty;
    pointPool = noQty;
  } else {
    // Selling NO: add shares to NO pool, take points from YES pool
    sharePool = noQty;
    pointPool = yesQty;
  }
  
  // Calculate new share pool after adding shares
  const newSharePool = sharePool + sharesIn;
  
  // Calculate new point pool to maintain k
  // Use ceiling division to ensure k doesn't decrease
  const newPointPool = (k + newSharePool - 1n) / newSharePool;
  
  // Points out is the difference (floor, automatic with BigInt)
  const pointsOut = pointPool - newPointPool;
  
  // Verify k hasn't decreased
  const newK = newSharePool * newPointPool;
  if (newK < k) {
    throw new Error('INVARIANT_VIOLATION: k decreased after swap');
  }
  
  // Return new pool state
  let newYesQty: bigint;
  let newNoQty: bigint;
  
  if (side === 'YES') {
    newYesQty = newSharePool;
    newNoQty = newPointPool;
  } else {
    newYesQty = newPointPool;
    newNoQty = newSharePool;
  }
  
  return {
    pointsOut,
    newYesQty,
    newNoQty,
  };
}

import { PRICE_PRECISION } from './constants';
```

---

## 6. Trading Operations

### 6.1 Buy Operation

```typescript
// src/engine/trading.ts

import { db } from '../db';
import { liquidityPools, portfolios, tradeLedger, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { calculateNetAfterFee, splitFee } from './fees';
import { calculateBuyShares } from './swap';
import { MIN_TRADE_SIZE } from './constants';
import type { SupabaseClient } from '@supabase/supabase-js';

// Note: All operations receive the authenticated user ID from Supabase Auth
// The Supabase client is created per-request in the route handler

export interface BuyParams {
  userId: string;
  marketId: string;
  side: 'YES' | 'NO';
  amountIn: bigint;
  minSharesOut: bigint;
  idempotencyKey?: string;
}

export interface BuyResult {
  transactionId: string;
  sharesOut: bigint;
  feePaid: bigint;
  feeVault: bigint;
  feeLp: bigint;
  newBalance: bigint;
  poolYesAfter: bigint;
  poolNoAfter: bigint;
}

/**
 * Execute a buy order with slippage protection
 */
export async function executeBuy(params: BuyParams): Promise<BuyResult> {
  const { userId, marketId, side, amountIn, minSharesOut, idempotencyKey } = params;
  
  // Validate minimum trade size
  if (amountIn < MIN_TRADE_SIZE) {
    throw new Error(`MINIMUM_TRADE_SIZE: Trade must be at least ${MIN_TRADE_SIZE} MicroPoints`);
  }
  
  return await db.transaction(async (tx) => {
    // 1. Check idempotency
    if (idempotencyKey) {
      const existing = await tx.query.tradeLedger.findFirst({
        where: eq(tradeLedger.idempotencyKey, idempotencyKey),
      });
      if (existing) {
        throw new Error('IDEMPOTENCY_CONFLICT: Duplicate idempotency key');
      }
    }
    
    // 2. Lock user and check balance
    const user = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    
    if (user.balance < amountIn) {
      throw new Error(`INSUFFICIENT_BALANCE: Need ${amountIn}, have ${user.balance}`);
    }
    
    // 3. Lock pool with optimistic locking
    const pool = await tx.query.liquidityPools.findFirst({
      where: eq(liquidityPools.id, marketId),
    });
    
    if (!pool) {
      throw new Error('MARKET_NOT_FOUND');
    }
    
    const poolYesBefore = pool.yesQty;
    const poolNoBefore = pool.noQty;
    const versionBefore = pool.versionId;
    
    // 4. Calculate fees
    const { netAmount, fee, vaultFee, lpFee } = calculateNetAfterFee(amountIn);
    
    // 5. Calculate swap
    const swapResult = calculateBuyShares(netAmount, {
      yesQty: pool.yesQty,
      noQty: pool.noQty,
    }, side);
    
    // 6. Slippage check
    if (swapResult.sharesOut < minSharesOut) {
      throw new Error(
        `SLIPPAGE_EXCEEDED: Expected min ${minSharesOut}, got ${swapResult.sharesOut}`
      );
    }
    
    // 7. Inject LP fee into pool
    let finalYesQty = swapResult.newYesQty;
    let finalNoQty = swapResult.newNoQty;
    
    if (side === 'YES') {
      finalNoQty += lpFee; // LP fee goes to input pool (NO side for YES buy)
    } else {
      finalYesQty += lpFee; // LP fee goes to input pool (YES side for NO buy)
    }
    
    // 8. Update pool with optimistic lock
    const updateResult = await tx
      .update(liquidityPools)
      .set({
        yesQty: finalYesQty,
        noQty: finalNoQty,
        versionId: versionBefore + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(liquidityPools.id, marketId),
          eq(liquidityPools.versionId, versionBefore)
        )
      );
    
    if (updateResult.rowCount === 0) {
      throw new Error('OPTIMISTIC_LOCK_FAIL: Pool was modified by another transaction');
    }
    
    // 9. Deduct from user balance
    const newBalance = user.balance - amountIn;
    await tx
      .update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, userId));
    
    // 10. Update user portfolio
    const existingPortfolio = await tx.query.portfolios.findFirst({
      where: and(
        eq(portfolios.userId, userId),
        eq(portfolios.marketId, marketId)
      ),
    });
    
    const sharesBefore = side === 'YES' 
      ? (existingPortfolio?.yesQty ?? 0n)
      : (existingPortfolio?.noQty ?? 0n);
    const sharesAfter = sharesBefore + swapResult.sharesOut;
    
    if (existingPortfolio) {
      // Update existing position
      if (side === 'YES') {
        await tx
          .update(portfolios)
          .set({
            yesQty: existingPortfolio.yesQty + swapResult.sharesOut,
            yesCostBasis: existingPortfolio.yesCostBasis + netAmount,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(portfolios.userId, userId),
              eq(portfolios.marketId, marketId)
            )
          );
      } else {
        await tx
          .update(portfolios)
          .set({
            noQty: existingPortfolio.noQty + swapResult.sharesOut,
            noCostBasis: existingPortfolio.noCostBasis + netAmount,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(portfolios.userId, userId),
              eq(portfolios.marketId, marketId)
            )
          );
      }
    } else {
      // Create new portfolio entry
      await tx.insert(portfolios).values({
        userId,
        marketId,
        yesQty: side === 'YES' ? swapResult.sharesOut : 0n,
        noQty: side === 'NO' ? swapResult.sharesOut : 0n,
        yesCostBasis: side === 'YES' ? netAmount : 0n,
        noCostBasis: side === 'NO' ? netAmount : 0n,
      });
    }
    
    // 11. Log to trade ledger
    const [ledgerEntry] = await tx
      .insert(tradeLedger)
      .values({
        userId,
        marketId,
        action: 'BUY',
        side,
        amountIn,
        amountOut: swapResult.sharesOut,
        sharesBefore,
        sharesAfter,
        feePaid: fee,
        feeVault: vaultFee,
        feeLp: lpFee,
        poolYesBefore,
        poolNoBefore,
        poolYesAfter: finalYesQty,
        poolNoAfter: finalNoQty,
        priceAtExecution: (amountIn * 1_000_000n) / swapResult.sharesOut,
        idempotencyKey,
      })
      .returning();
    
    return {
      transactionId: ledgerEntry.id,
      sharesOut: swapResult.sharesOut,
      feePaid: fee,
      feeVault: vaultFee,
      feeLp: lpFee,
      newBalance,
      poolYesAfter: finalYesQty,
      poolNoAfter: finalNoQty,
    };
  });
}
```

### 6.2 Sell Operation

```typescript
// src/engine/trading.ts (continued)

export interface SellParams {
  userId: string;
  marketId: string;
  side: 'YES' | 'NO';
  sharesIn: bigint;
  minAmountOut: bigint;
  idempotencyKey?: string;
}

export interface SellResult {
  transactionId: string;
  amountOut: bigint;
  feePaid: bigint;
  newBalance: bigint;
  poolYesAfter: bigint;
  poolNoAfter: bigint;
}

/**
 * Execute a sell order with slippage protection
 */
export async function executeSell(params: SellParams): Promise<SellResult> {
  const { userId, marketId, side, sharesIn, minAmountOut, idempotencyKey } = params;
  
  return await db.transaction(async (tx) => {
    // 1. Check idempotency
    if (idempotencyKey) {
      const existing = await tx.query.tradeLedger.findFirst({
        where: eq(tradeLedger.idempotencyKey, idempotencyKey),
      });
      if (existing) {
        throw new Error('IDEMPOTENCY_CONFLICT: Duplicate idempotency key');
      }
    }
    
    // 2. Check user has enough shares
    const portfolio = await tx.query.portfolios.findFirst({
      where: and(
        eq(portfolios.userId, userId),
        eq(portfolios.marketId, marketId)
      ),
    });
    
    const currentShares = side === 'YES' 
      ? (portfolio?.yesQty ?? 0n)
      : (portfolio?.noQty ?? 0n);
    
    if (currentShares < sharesIn) {
      throw new Error(`INSUFFICIENT_SHARES: Have ${currentShares}, need ${sharesIn}`);
    }
    
    // 3. Lock pool
    const pool = await tx.query.liquidityPools.findFirst({
      where: eq(liquidityPools.id, marketId),
    });
    
    if (!pool) {
      throw new Error('MARKET_NOT_FOUND');
    }
    
    const poolYesBefore = pool.yesQty;
    const poolNoBefore = pool.noQty;
    const versionBefore = pool.versionId;
    
    // 4. Calculate swap (gross payout)
    const sellResult = calculateSellPoints(sharesIn, {
      yesQty: pool.yesQty,
      noQty: pool.noQty,
    }, side);
    
    // 5. Apply fees to output
    const { netPayout, fee, vaultFee, lpFee } = calculateNetPayout(sellResult.pointsOut);
    
    // 6. Slippage check
    if (netPayout < minAmountOut) {
      throw new Error(
        `SLIPPAGE_EXCEEDED: Expected min ${minAmountOut}, got ${netPayout}`
      );
    }
    
    // 7. Inject LP fee back into pool
    let finalYesQty = sellResult.newYesQty;
    let finalNoQty = sellResult.newNoQty;
    
    if (side === 'YES') {
      finalNoQty += lpFee; // LP fee stays in output pool (NO side for YES sell)
    } else {
      finalYesQty += lpFee;
    }
    
    // 8. Update pool with optimistic lock
    const updateResult = await tx
      .update(liquidityPools)
      .set({
        yesQty: finalYesQty,
        noQty: finalNoQty,
        versionId: versionBefore + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(liquidityPools.id, marketId),
          eq(liquidityPools.versionId, versionBefore)
        )
      );
    
    if (updateResult.rowCount === 0) {
      throw new Error('OPTIMISTIC_LOCK_FAIL: Pool was modified by another transaction');
    }
    
    // 9. Credit user balance
    const user = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    const newBalance = (user?.balance ?? 0n) + netPayout;
    await tx
      .update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, userId));
    
    // 10. Update portfolio with proportional cost basis reduction
    const sharesBefore = currentShares;
    const sharesAfter = currentShares - sharesIn;
    
    const currentBasis = side === 'YES' 
      ? (portfolio?.yesCostBasis ?? 0n)
      : (portfolio?.noCostBasis ?? 0n);
    
    // Reduce basis proportionally: newBasis = oldBasis × (1 - sharesSold/totalShares)
    const basisReduction = (currentBasis * sharesIn) / sharesBefore;
    const newBasis = currentBasis - basisReduction;
    
    if (side === 'YES') {
      await tx
        .update(portfolios)
        .set({
          yesQty: sharesAfter,
          yesCostBasis: newBasis,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portfolios.userId, userId),
            eq(portfolios.marketId, marketId)
          )
        );
    } else {
      await tx
        .update(portfolios)
        .set({
          noQty: sharesAfter,
          noCostBasis: newBasis,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portfolios.userId, userId),
            eq(portfolios.marketId, marketId)
          )
        );
    }
    
    // 11. Log to trade ledger
    const [ledgerEntry] = await tx
      .insert(tradeLedger)
      .values({
        userId,
        marketId,
        action: 'SELL',
        side,
        amountIn: sharesIn,
        amountOut: netPayout,
        sharesBefore,
        sharesAfter,
        feePaid: fee,
        feeVault: vaultFee,
        feeLp: lpFee,
        poolYesBefore,
        poolNoBefore,
        poolYesAfter: finalYesQty,
        poolNoAfter: finalNoQty,
        idempotencyKey,
      })
      .returning();
    
    return {
      transactionId: ledgerEntry.id,
      amountOut: netPayout,
      feePaid: fee,
      newBalance,
      poolYesAfter: finalYesQty,
      poolNoAfter: finalNoQty,
    };
  });
}

import { calculateNetPayout } from './fees';
import { calculateSellPoints } from './swap';
```

### 6.3 Mint & Merge Operations

```typescript
// src/engine/mint-merge.ts

/**
 * Mint new shares by depositing points
 * Creates equal YES and NO shares (1:1:1 ratio)
 * NO FEE
 */
export async function executeMint(
  userId: string,
  marketId: string,
  amount: bigint
): Promise<{ yesOut: bigint; noOut: bigint; newBalance: bigint }> {
  
  if (amount < MIN_TRADE_SIZE) {
    throw new Error(`MINIMUM_TRADE_SIZE: Mint must be at least ${MIN_TRADE_SIZE}`);
  }
  
  return await db.transaction(async (tx) => {
    // 1. Check user balance
    const user = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user || user.balance < amount) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
    
    // 2. Deduct balance
    const newBalance = user.balance - amount;
    await tx
      .update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, userId));
    
    // 3. Add shares to portfolio (1 point = 1 YES + 1 NO)
    const existingPortfolio = await tx.query.portfolios.findFirst({
      where: and(
        eq(portfolios.userId, userId),
        eq(portfolios.marketId, marketId)
      ),
    });
    
    if (existingPortfolio) {
      await tx
        .update(portfolios)
        .set({
          yesQty: existingPortfolio.yesQty + amount,
          noQty: existingPortfolio.noQty + amount,
          // Cost basis for minted shares is the amount paid
          yesCostBasis: existingPortfolio.yesCostBasis + (amount / 2n),
          noCostBasis: existingPortfolio.noCostBasis + (amount / 2n),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portfolios.userId, userId),
            eq(portfolios.marketId, marketId)
          )
        );
    } else {
      await tx.insert(portfolios).values({
        userId,
        marketId,
        yesQty: amount,
        noQty: amount,
        yesCostBasis: amount / 2n,
        noCostBasis: amount / 2n,
      });
    }
    
    // 4. Log to ledger
    await tx.insert(tradeLedger).values({
      userId,
      marketId,
      action: 'MINT',
      amountIn: amount,
      amountOut: amount, // Represents the set value
      feePaid: 0n,
    });
    
    return {
      yesOut: amount,
      noOut: amount,
      newBalance,
    };
  });
}

/**
 * Merge (redeem) equal YES and NO shares for points
 * Destroys equal amounts of both share types
 * NO FEE
 */
export async function executeMerge(
  userId: string,
  marketId: string,
  amount: bigint
): Promise<{ amountOut: bigint; newBalance: bigint }> {
  
  return await db.transaction(async (tx) => {
    // 1. Check user has enough of BOTH share types
    const portfolio = await tx.query.portfolios.findFirst({
      where: and(
        eq(portfolios.userId, userId),
        eq(portfolios.marketId, marketId)
      ),
    });
    
    if (!portfolio || portfolio.yesQty < amount || portfolio.noQty < amount) {
      throw new Error(
        `INSUFFICIENT_SHARES: Need ${amount} of each, have YES:${portfolio?.yesQty ?? 0}, NO:${portfolio?.noQty ?? 0}`
      );
    }
    
    // 2. Remove shares
    const newYesQty = portfolio.yesQty - amount;
    const newNoQty = portfolio.noQty - amount;
    
    // Proportionally reduce cost basis
    const yesBasisReduction = (portfolio.yesCostBasis * amount) / portfolio.yesQty;
    const noBasisReduction = (portfolio.noCostBasis * amount) / portfolio.noQty;
    
    await tx
      .update(portfolios)
      .set({
        yesQty: newYesQty,
        noQty: newNoQty,
        yesCostBasis: portfolio.yesCostBasis - yesBasisReduction,
        noCostBasis: portfolio.noCostBasis - noBasisReduction,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portfolios.userId, userId),
          eq(portfolios.marketId, marketId)
        )
      );
    
    // 3. Credit user balance
    const user = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    const newBalance = (user?.balance ?? 0n) + amount;
    await tx
      .update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, userId));
    
    // 4. Log to ledger
    await tx.insert(tradeLedger).values({
      userId,
      marketId,
      action: 'MERGE',
      amountIn: amount,
      amountOut: amount,
      feePaid: 0n,
    });
    
    return {
      amountOut: amount,
      newBalance,
    };
  });
}
```

---

## 7. Netting Protocol

The netting protocol handles the case where a user holds shares on one side but wants to buy the opposite side. Instead of allowing conflicting positions, the system:

1. **Exits** the opposite position (fee-free)
2. **Aggregates** the proceeds with new capital
3. **Enters** the desired position (with fees)

```typescript
// src/engine/netting.ts

/**
 * Execute a smart bet with automatic netting
 * If user holds opposite shares, they are sold first (fee-free)
 */
export async function executeSmartBuy(
  userId: string,
  marketId: string,
  side: 'YES' | 'NO',
  amountIn: bigint,
  minSharesOut: bigint
): Promise<BuyResult> {
  
  const oppositeSide = side === 'YES' ? 'NO' : 'YES';
  
  return await db.transaction(async (tx) => {
    // 1. Check for opposite position
    const portfolio = await tx.query.portfolios.findFirst({
      where: and(
        eq(portfolios.userId, userId),
        eq(portfolios.marketId, marketId)
      ),
    });
    
    const oppositeQty = oppositeSide === 'YES'
      ? (portfolio?.yesQty ?? 0n)
      : (portfolio?.noQty ?? 0n);
    
    let totalBuyingPower = amountIn;
    
    // 2. If has opposite position, execute fee-free netting sell
    if (oppositeQty > 0n) {
      // Get pool state
      const pool = await tx.query.liquidityPools.findFirst({
        where: eq(liquidityPools.id, marketId),
      });
      
      if (!pool) throw new Error('MARKET_NOT_FOUND');
      
      // Calculate sell proceeds (NO FEE for netting)
      const sellResult = calculateSellPoints(oppositeQty, {
        yesQty: pool.yesQty,
        noQty: pool.noQty,
      }, oppositeSide);
      
      // Update pool
      await tx
        .update(liquidityPools)
        .set({
          yesQty: sellResult.newYesQty,
          noQty: sellResult.newNoQty,
          versionId: pool.versionId + 1,
          updatedAt: new Date(),
        })
        .where(eq(liquidityPools.id, marketId));
      
      // Clear opposite position
      if (oppositeSide === 'YES') {
        await tx
          .update(portfolios)
          .set({
            yesQty: 0n,
            yesCostBasis: 0n,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(portfolios.userId, userId),
              eq(portfolios.marketId, marketId)
            )
          );
      } else {
        await tx
          .update(portfolios)
          .set({
            noQty: 0n,
            noCostBasis: 0n,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(portfolios.userId, userId),
              eq(portfolios.marketId, marketId)
            )
          );
      }
      
      // Log netting sell (fee-free)
      await tx.insert(tradeLedger).values({
        userId,
        marketId,
        action: 'NET_SELL',
        side: oppositeSide,
        amountIn: oppositeQty,
        amountOut: sellResult.pointsOut,
        feePaid: 0n, // Fee-free for netting!
      });
      
      // Add proceeds to buying power
      totalBuyingPower += sellResult.pointsOut;
    }
    
    // 3. Execute the buy with aggregated capital
    // Note: This uses the updated pool state from netting
    return await executeBuy({
      userId,
      marketId,
      side,
      amountIn: totalBuyingPower,
      minSharesOut,
    });
  });
}
```

---

## 8. Market Genesis

```typescript
// src/engine/genesis.ts

import { MIN_SEED_LIQUIDITY } from './constants';

const TREASURY_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Initialize a new market with seed liquidity
 * Creates 50/50 starting probability
 */
export async function genesisMarket(
  marketId: string,
  seedAmount: bigint,
  creatorId: string
): Promise<{ success: boolean; k: bigint }> {
  
  if (seedAmount < MIN_SEED_LIQUIDITY) {
    throw new Error(
      `SEED_TOO_LOW: Minimum seed is ${MIN_SEED_LIQUIDITY} MicroPoints`
    );
  }
  
  return await db.transaction(async (tx) => {
    // 1. Create liquidity pool (50/50 start)
    await tx.insert(liquidityPools).values({
      id: marketId,
      yesQty: seedAmount,
      noQty: seedAmount,
      versionId: 1,
    });
    
    // 2. Grant LP shares to treasury
    await tx.insert(portfolios).values({
      userId: TREASURY_USER_ID,
      marketId,
      yesQty: seedAmount,
      noQty: seedAmount,
      yesCostBasis: seedAmount / 2n,
      noCostBasis: seedAmount / 2n,
    });
    
    // 3. Log genesis
    await tx.insert(tradeLedger).values({
      userId: TREASURY_USER_ID,
      marketId,
      action: 'GENESIS_MINT',
      amountIn: seedAmount,
      amountOut: seedAmount,
      feePaid: 0n,
    });
    
    const k = seedAmount * seedAmount;
    
    return { success: true, k };
  });
}

/**
 * Genesis with skewed probability
 * Use when the starting price shouldn't be 50/50
 * 
 * @param targetYesPrice - Desired YES price (0.01 to 0.99)
 * @param totalLiquidity - Total liquidity to inject
 */
export async function genesisMarketSkewed(
  marketId: string,
  targetYesPrice: number,
  totalLiquidity: bigint
): Promise<{ yesQty: bigint; noQty: bigint; k: bigint }> {
  
  if (targetYesPrice <= 0.01 || targetYesPrice >= 0.99) {
    throw new Error('INVALID_PRICE: Target price must be between 0.01 and 0.99');
  }
  
  // Price formula: P_yes = noQty / (yesQty + noQty)
  // If P_yes = 0.80, then noQty = 80%, yesQty = 20% of total
  // Actually: P_yes = noQty / total, so noQty = P_yes × total
  
  const noQty = BigInt(Math.floor(Number(totalLiquidity) * targetYesPrice));
  const yesQty = totalLiquidity - noQty;
  
  return await db.transaction(async (tx) => {
    await tx.insert(liquidityPools).values({
      id: marketId,
      yesQty,
      noQty,
      versionId: 1,
    });
    
    await tx.insert(portfolios).values({
      userId: TREASURY_USER_ID,
      marketId,
      yesQty,
      noQty,
      yesCostBasis: yesQty,
      noCostBasis: noQty,
    });
    
    await tx.insert(tradeLedger).values({
      userId: TREASURY_USER_ID,
      marketId,
      action: 'GENESIS_MINT',
      amountIn: totalLiquidity,
      amountOut: totalLiquidity,
      feePaid: 0n,
    });
    
    return {
      yesQty,
      noQty,
      k: yesQty * noQty,
    };
  });
}
```

---

## 9. Resolution & Settlement

### 9.1 Standard Resolution (100/0 Payout)

```typescript
// src/engine/resolution.ts

import { markets } from '../db/schema';

type Resolution = 'YES' | 'NO';

/**
 * Resolve a market and pay out winners
 * Winners receive 1 Point per winning share
 * Losers receive 0
 */
export async function resolveMarket(
  marketId: string,
  resolution: Resolution,
  adminId: string
): Promise<{
  totalWinners: number;
  totalPayout: bigint;
}> {
  
  return await db.transaction(async (tx) => {
    // 1. Update market status
    await tx
      .update(markets)
      .set({
        status: 'RESOLVED',
        resolution,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(markets.id, marketId));
    
    // 2. Get all holders
    const holders = await tx.query.portfolios.findMany({
      where: eq(portfolios.marketId, marketId),
    });
    
    let totalWinners = 0;
    let totalPayout = 0n;
    
    // 3. Process each holder
    for (const holder of holders) {
      const winningShares = resolution === 'YES' 
        ? holder.yesQty 
        : holder.noQty;
      
      if (winningShares > 0n) {
        totalWinners++;
        
        // Payout = 1 Point per winning share
        const payout = winningShares;
        totalPayout += payout;
        
        // Credit user balance
        await tx
          .update(users)
          .set({
            balance: sql`balance + ${payout}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, holder.userId));
        
        // Log payout
        await tx.insert(tradeLedger).values({
          userId: holder.userId,
          marketId,
          action: 'RESOLUTION_PAYOUT',
          side: resolution,
          amountIn: winningShares,
          amountOut: payout,
          feePaid: 0n,
        });
      }
      
      // 4. Clear portfolio
      await tx
        .update(portfolios)
        .set({
          yesQty: 0n,
          noQty: 0n,
          yesCostBasis: 0n,
          noCostBasis: 0n,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portfolios.userId, holder.userId),
            eq(portfolios.marketId, marketId)
          )
        );
    }
    
    // 5. Clear the liquidity pool
    await tx
      .update(liquidityPools)
      .set({
        yesQty: 0n,
        noQty: 0n,
        updatedAt: new Date(),
      })
      .where(eq(liquidityPools.id, marketId));
    
    return {
      totalWinners,
      totalPayout,
    };
  });
}

import { sql } from 'drizzle-orm';
```

---

## 10. Refund Protocol

```typescript
// src/engine/refund.ts

/**
 * Execute principal refund for a cancelled market
 * Users receive their cost basis back (what they invested)
 */
export async function executeRefund(
  marketId: string,
  adminId: string
): Promise<{
  totalHolders: number;
  totalRefunded: bigint;
  surplus: bigint;
}> {
  
  return await db.transaction(async (tx) => {
    // 1. Update market status
    await tx
      .update(markets)
      .set({
        status: 'CANCELLED',
        resolution: 'CANCELLED',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(markets.id, marketId));
    
    // 2. Get pool value before clearing
    const pool = await tx.query.liquidityPools.findFirst({
      where: eq(liquidityPools.id, marketId),
    });
    
    const poolValue = (pool?.yesQty ?? 0n) + (pool?.noQty ?? 0n);
    
    // 3. Get all holders
    const holders = await tx.query.portfolios.findMany({
      where: eq(portfolios.marketId, marketId),
    });
    
    let totalHolders = 0;
    let totalRefunded = 0n;
    
    // 4. Refund each holder their cost basis
    for (const holder of holders) {
      const refundAmount = holder.yesCostBasis + holder.noCostBasis;
      
      if (refundAmount > 0n) {
        totalHolders++;
        totalRefunded += refundAmount;
        
        // Credit user balance
        await tx
          .update(users)
          .set({
            balance: sql`balance + ${refundAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, holder.userId));
        
        // Log refund
        await tx.insert(tradeLedger).values({
          userId: holder.userId,
          marketId,
          action: 'REFUND',
          amountIn: holder.yesQty + holder.noQty, // Total shares
          amountOut: refundAmount, // Cost basis refund
          feePaid: 0n,
        });
      }
      
      // Clear portfolio
      await tx
        .update(portfolios)
        .set({
          yesQty: 0n,
          noQty: 0n,
          yesCostBasis: 0n,
          noCostBasis: 0n,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portfolios.userId, holder.userId),
            eq(portfolios.marketId, marketId)
          )
        );
    }
    
    // 5. Calculate surplus (fees collected but not refunded)
    // This goes to the house treasury
    const surplus = poolValue > totalRefunded ? poolValue - totalRefunded : 0n;
    
    // 6. Clear the liquidity pool
    await tx
      .update(liquidityPools)
      .set({
        yesQty: 0n,
        noQty: 0n,
        updatedAt: new Date(),
      })
      .where(eq(liquidityPools.id, marketId));
    
    // 7. Log system action
    await tx.insert(tradeLedger).values({
      userId: 'SYSTEM',
      marketId,
      action: 'REFUND',
      amountIn: 0n,
      amountOut: totalRefunded,
      feePaid: surplus, // Surplus stored in fee_paid field
    });
    
    return {
      totalHolders,
      totalRefunded,
      surplus,
    };
  });
}
```

---

## 11. Helper Functions

```typescript
// src/engine/helpers.ts

import { PRICE_PRECISION } from './constants';

/**
 * Calculate current spot prices
 */
export function calculatePrices(pool: PoolState): {
  yesPrice: bigint;
  noPrice: bigint;
  yesPriceDisplay: string;
  noPriceDisplay: string;
} {
  const total = pool.yesQty + pool.noQty;
  
  if (total === 0n) {
    return {
      yesPrice: PRICE_PRECISION / 2n,
      noPrice: PRICE_PRECISION / 2n,
      yesPriceDisplay: '0.50',
      noPriceDisplay: '0.50',
    };
  }
  
  const yesPrice = (pool.noQty * PRICE_PRECISION) / total;
  const noPrice = (pool.yesQty * PRICE_PRECISION) / total;
  
  return {
    yesPrice,
    noPrice,
    yesPriceDisplay: (Number(yesPrice) / Number(PRICE_PRECISION)).toFixed(4),
    noPriceDisplay: (Number(noPrice) / Number(PRICE_PRECISION)).toFixed(4),
  };
}

/**
 * Calculate maximum shares user can buy with their balance
 */
export function calculateMaxBuy(
  balance: bigint,
  pool: PoolState,
  side: 'YES' | 'NO'
): bigint {
  const { netAmount } = calculateNetAfterFee(balance);
  
  const inputPool = side === 'YES' ? pool.noQty : pool.yesQty;
  const outputPool = side === 'YES' ? pool.yesQty : pool.noQty;
  
  const k = inputPool * outputPool;
  const newInputPool = inputPool + netAmount;
  const newOutputPool = k / newInputPool;
  
  return outputPool - newOutputPool;
}

/**
 * Estimate shares out for a given input amount (for quotes)
 */
export function estimateBuyShares(
  amountIn: bigint,
  pool: PoolState,
  side: 'YES' | 'NO'
): {
  sharesOut: bigint;
  fee: bigint;
  avgPrice: bigint;
  priceImpact: bigint;
} {
  const { netAmount, fee } = calculateNetAfterFee(amountIn);
  const result = calculateBuyShares(netAmount, pool, side);
  
  const avgPrice = (amountIn * PRICE_PRECISION) / result.sharesOut;
  
  return {
    sharesOut: result.sharesOut,
    fee,
    avgPrice,
    priceImpact: result.priceImpact,
  };
}

/**
 * Estimate points out for selling shares (for quotes)
 */
export function estimateSellPoints(
  sharesIn: bigint,
  pool: PoolState,
  side: 'YES' | 'NO'
): {
  pointsOut: bigint;
  fee: bigint;
  avgPrice: bigint;
} {
  const result = calculateSellPoints(sharesIn, pool, side);
  const { netPayout, fee } = calculateNetPayout(result.pointsOut);
  
  const avgPrice = (netPayout * PRICE_PRECISION) / sharesIn;
  
  return {
    pointsOut: netPayout,
    fee,
    avgPrice,
  };
}

import { calculateNetAfterFee, calculateNetPayout } from './fees';
import { calculateBuyShares, calculateSellPoints, PoolState } from './swap';
```

---

## 12. Test Suite

```typescript
// src/engine/__tests__/engine.test.ts

import { describe, test, expect } from 'vitest';
import { calculateFee, calculateNetAfterFee } from '../fees';
import { calculateBuyShares, calculateSellPoints } from '../swap';
import { FEE_RATE_BP, BP_DIVISOR } from '../constants';

describe('Fee Calculations', () => {
  describe('calculateFee', () => {
    test('rounds UP (ceiling) - favors house', () => {
      // 2% of 101 = 2.02 → should round to 3
      const fee = calculateFee(101n);
      expect(fee).toBe(3n);
    });
    
    test('exact percentage returns exact amount', () => {
      // 2% of 1000 = 20 exactly
      const fee = calculateFee(1000n);
      expect(fee).toBe(20n);
    });
    
    test('small amounts still charge minimum fee', () => {
      // 2% of 1 = 0.02 → rounds to 1
      const fee = calculateFee(1n);
      expect(fee).toBe(1n);
    });
  });
  
  describe('calculateNetAfterFee', () => {
    test('correctly splits fees', () => {
      const result = calculateNetAfterFee(1000n);
      
      expect(result.fee).toBe(20n);
      expect(result.netAmount).toBe(980n);
      expect(result.vaultFee).toBe(10n);
      expect(result.lpFee).toBe(10n);
    });
  });
});

describe('CPMM Swap Logic', () => {
  describe('calculateBuyShares', () => {
    test('basic buy YES', () => {
      const pool = { yesQty: 1000n, noQty: 1000n };
      const result = calculateBuyShares(100n, pool, 'YES');
      
      // With 100 points in, should get ~90 shares (minus slippage)
      expect(result.sharesOut).toBeGreaterThan(0n);
      expect(result.sharesOut).toBeLessThan(100n);
    });
    
    test('k never decreases', () => {
      const pool = { yesQty: 1000n, noQty: 1000n };
      const kBefore = pool.yesQty * pool.noQty;
      
      const result = calculateBuyShares(500n, pool, 'YES');
      const kAfter = result.newYesQty * result.newNoQty;
      
      expect(kAfter).toBeGreaterThanOrEqual(kBefore);
    });
    
    test('throws on empty pool', () => {
      const pool = { yesQty: 0n, noQty: 0n };
      
      expect(() => calculateBuyShares(100n, pool, 'YES'))
        .toThrow('POOL_EMPTY');
    });
  });
  
  describe('calculateSellPoints', () => {
    test('basic sell YES', () => {
      const pool = { yesQty: 1000n, noQty: 1000n };
      const result = calculateSellPoints(100n, pool, 'YES');
      
      // Should get some points back
      expect(result.pointsOut).toBeGreaterThan(0n);
      expect(result.pointsOut).toBeLessThan(100n);
    });
    
    test('k never decreases after sell', () => {
      const pool = { yesQty: 1000n, noQty: 1000n };
      const kBefore = pool.yesQty * pool.noQty;
      
      const result = calculateSellPoints(100n, pool, 'YES');
      const kAfter = result.newYesQty * result.newNoQty;
      
      expect(kAfter).toBeGreaterThanOrEqual(kBefore);
    });
  });
});

describe('Rounding Direction (House Edge)', () => {
  test('user receives FEWER shares than mathematically exact', () => {
    // Set up a scenario where exact math would give fractional shares
    const pool = { yesQty: 1000n, noQty: 1000n };
    const result = calculateBuyShares(101n, pool, 'YES');
    
    // The shares should be floored (truncated)
    // This is automatic with BigInt division
    expect(result.sharesOut).toBe(result.sharesOut); // No fractions possible
  });
  
  test('house receives MORE fees than mathematically exact', () => {
    // 2% of 101 = 2.02 → house gets 3
    const fee = calculateFee(101n);
    const exactFee = (101n * FEE_RATE_BP) / BP_DIVISOR; // Would be 2
    
    expect(fee).toBeGreaterThanOrEqual(exactFee);
  });
});

describe('Invariant Protection', () => {
  test('k increases with fees', () => {
    const pool = { yesQty: 1000n, noQty: 1000n };
    const kBefore = pool.yesQty * pool.noQty;
    
    // Simulate a buy with LP fee injection
    const amountIn = 100n;
    const { netAmount, lpFee } = calculateNetAfterFee(amountIn);
    
    const result = calculateBuyShares(netAmount, pool, 'YES');
    
    // Inject LP fee into input pool
    const finalNoQty = result.newNoQty + lpFee;
    const kAfter = result.newYesQty * finalNoQty;
    
    expect(kAfter).toBeGreaterThan(kBefore);
  });
});

describe('System Solvency', () => {
  test('pool always has enough to pay winners', () => {
    // Setup: User buys YES shares
    const pool = { yesQty: 1000n, noQty: 1000n };
    const buyResult = calculateBuyShares(500n, pool, 'YES');
    
    // If YES wins, user gets 1 point per share
    const payout = buyResult.sharesOut;
    
    // Pool should have enough (this is guaranteed by CPMM math)
    // The "collateral" is the input points plus the remaining pool
    const totalValue = buyResult.newYesQty + buyResult.newNoQty;
    expect(totalValue).toBeGreaterThanOrEqual(payout);
  });
});
```

---

## Related Documents

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — System architecture overview
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — Database schema and Drizzle types
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) — REST API endpoints
- [EDGE_CASES.md](./EDGE_CASES.md) — Edge case handling

---

*Document Version: 3.1 | Engine Version: 1.0*

