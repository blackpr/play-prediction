import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  integer,
  boolean,
  timestamp,
  primaryKey,
  check,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// ENUMS (as const for type safety)
// ============================================================================

export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  TREASURY: 'treasury',
} as const;

export const MarketStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
} as const;

export const CloseBehavior = {
  AUTO: 'auto',                    // Auto-close when closes_at passes
  MANUAL: 'manual',                // Admin must close manually (sports with added time)
  AUTO_WITH_BUFFER: 'auto_with_buffer', // Auto-close after buffer period
} as const;

export const Resolution = {
  YES: 'YES',
  NO: 'NO',
  CANCELLED: 'CANCELLED',
} as const;

export const TradeAction = {
  BUY: 'BUY',
  SELL: 'SELL',
  MINT: 'MINT',
  MERGE: 'MERGE',
  NET_SELL: 'NET_SELL',
  GENESIS_MINT: 'GENESIS_MINT',
  RESOLUTION_PAYOUT: 'RESOLUTION_PAYOUT',
  REFUND: 'REFUND',
  DEPOSIT: 'DEPOSIT',
  WITHDRAW: 'WITHDRAW',
} as const;

export const Side = {
  YES: 'YES',
  NO: 'NO',
} as const;

// ============================================================================
// TABLES
// ============================================================================

// Users table - extends Supabase auth.users
// Note: id references auth.users(id), authentication handled by Supabase Auth
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // References auth.users(id) - set by trigger
  email: varchar('email', { length: 255 }).notNull().unique(),
  balance: bigint('balance', { mode: 'bigint' }).notNull().default(sql`0`),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    emailIdx: uniqueIndex('idx_users_email').on(table.email),
    roleIdx: index('idx_users_role').on(table.role).where(sql`is_active = true`),
    balanceCheck: check('users_balance_non_negative', sql`${table.balance} >= 0`),
    roleCheck: check('users_role_valid', sql`${table.role} IN ('user', 'admin', 'treasury')`),
  }
});

export const markets = pgTable('markets', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
  resolution: varchar('resolution', { length: 10 }),
  imageUrl: varchar('image_url', { length: 2048 }),
  category: varchar('category', { length: 100 }),
  closesAt: timestamp('closes_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  // Close behavior configuration - determines how market transitions when closes_at passes
  // See ADR_001_MARKET_CLOSE_BEHAVIOR.md for details
  closeBehavior: varchar('close_behavior', { length: 20 }).notNull().default('auto'),
  bufferMinutes: integer('buffer_minutes'), // Only used when close_behavior = 'auto_with_buffer'
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    statusIdx: index('idx_markets_status').on(table.status),
    statusClosesIdx: index('idx_markets_status_closes').on(table.status, table.closesAt).where(sql`status = 'ACTIVE'`),
    categoryIdx: index('idx_markets_category').on(table.category).where(sql`status = 'ACTIVE'`),
    createdByIdx: index('idx_markets_created_by').on(table.createdBy),
    // Index for scheduler jobs to find markets needing auto-close by behavior type
    closeBehaviorIdx: index('idx_markets_close_behavior').on(table.closeBehavior, table.status, table.closesAt).where(sql`status = 'ACTIVE'`),
    statusCheck: check('markets_status_valid', sql`${table.status} IN ('DRAFT', 'ACTIVE', 'PAUSED', 'RESOLVED', 'CANCELLED')`),
    resolutionCheck: check('markets_resolution_valid', sql`${table.resolution} IS NULL OR ${table.resolution} IN ('YES', 'NO', 'CANCELLED')`),
    resolutionStatusCheck: check('markets_resolution_requires_status', sql`
        (${table.status} IN ('RESOLVED', 'CANCELLED') AND ${table.resolution} IS NOT NULL) OR
        (${table.status} NOT IN ('RESOLVED', 'CANCELLED') AND ${table.resolution} IS NULL)
    `),
    closeBehaviorCheck: check('markets_close_behavior_valid', sql`${table.closeBehavior} IN ('auto', 'manual', 'auto_with_buffer')`),
    bufferCheck: check('markets_buffer_valid', sql`
        (${table.closeBehavior} = 'auto_with_buffer' AND ${table.bufferMinutes} IS NOT NULL AND ${table.bufferMinutes} > 0)
        OR (${table.closeBehavior} != 'auto_with_buffer' AND ${table.bufferMinutes} IS NULL)
    `),
  }
});

export const liquidityPools = pgTable('liquidity_pools', {
  id: uuid('id').primaryKey().references(() => markets.id, { onDelete: 'cascade' }),
  yesQty: bigint('yes_qty', { mode: 'bigint' }).notNull(),
  noQty: bigint('no_qty', { mode: 'bigint' }).notNull(),
  versionId: integer('version_id').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    yesQtyCheck: check('pools_yes_non_negative', sql`${table.yesQty} >= 0`),
    noQtyCheck: check('pools_no_non_negative', sql`${table.noQty} >= 0`),
    versionIdCheck: check('pools_version_positive', sql`${table.versionId} > 0`),
  }
});

export const portfolios = pgTable('portfolios', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketId: uuid('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  yesQty: bigint('yes_qty', { mode: 'bigint' }).notNull().default(sql`0`),
  noQty: bigint('no_qty', { mode: 'bigint' }).notNull().default(sql`0`),
  yesCostBasis: bigint('yes_cost_basis', { mode: 'bigint' }).notNull().default(sql`0`),
  noCostBasis: bigint('no_cost_basis', { mode: 'bigint' }).notNull().default(sql`0`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.marketId] }),
    userIdIdx: index('idx_portfolios_user').on(table.userId),
    marketIdIdx: index('idx_portfolios_market').on(table.marketId),
    holdingsIdx: index('idx_portfolios_holdings').on(table.userId, table.marketId).where(sql`${table.yesQty} > 0 OR ${table.noQty} > 0`),
    yesQtyCheck: check('portfolios_yes_non_negative', sql`${table.yesQty} >= 0`),
    noQtyCheck: check('portfolios_no_non_negative', sql`${table.noQty} >= 0`),
    yesBasisCheck: check('portfolios_yes_basis_non_negative', sql`${table.yesCostBasis} >= 0`),
    noBasisCheck: check('portfolios_no_basis_non_negative', sql`${table.noCostBasis} >= 0`),
  }
});

export const tradeLedger = pgTable('trade_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  marketId: uuid('market_id').notNull().references(() => markets.id),
  action: varchar('action', { length: 20 }).notNull(),
  side: varchar('side', { length: 3 }),
  amountIn: bigint('amount_in', { mode: 'bigint' }).notNull(),
  amountOut: bigint('amount_out', { mode: 'bigint' }).notNull(),
  sharesBefore: bigint('shares_before', { mode: 'bigint' }),
  sharesAfter: bigint('shares_after', { mode: 'bigint' }),
  feePaid: bigint('fee_paid', { mode: 'bigint' }).notNull().default(sql`0`),
  feeVault: bigint('fee_vault', { mode: 'bigint' }).notNull().default(sql`0`),
  feeLp: bigint('fee_lp', { mode: 'bigint' }).notNull().default(sql`0`),
  poolYesBefore: bigint('pool_yes_before', { mode: 'bigint' }),
  poolNoBefore: bigint('pool_no_before', { mode: 'bigint' }),
  poolYesAfter: bigint('pool_yes_after', { mode: 'bigint' }),
  poolNoAfter: bigint('pool_no_after', { mode: 'bigint' }),
  priceAtExecution: bigint('price_at_execution', { mode: 'bigint' }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: index('idx_ledger_user').on(table.userId, table.createdAt), // DESC implied or handled by query? Drizzle index helper doesn't support DESC explicitly in basic API, usually done in raw sql or updated API. Assuming standard index for now or raw sql if needed.
    marketIdIdx: index('idx_ledger_market').on(table.marketId, table.createdAt),
    idempotencyIdx: index('idx_ledger_idempotency').on(table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
    actionIdx: index('idx_ledger_action').on(table.action, table.createdAt),
    actionCheck: check('ledger_action_valid', sql`${table.action} IN ('BUY', 'SELL', 'MINT', 'MERGE', 'NET_SELL', 'GENESIS_MINT', 'RESOLUTION_PAYOUT', 'REFUND', 'DEPOSIT', 'WITHDRAW')`),
    sideCheck: check('ledger_side_valid', sql`${table.side} IS NULL OR ${table.side} IN ('YES', 'NO')`),
    amountsCheck: check('ledger_amounts_non_negative', sql`${table.amountIn} >= 0 AND ${table.amountOut} >= 0 AND ${table.feePaid} >= 0`),
  }
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: index('idx_refresh_tokens_user').on(table.userId),
    expiresIdx: index('idx_refresh_tokens_expires').on(table.expiresAt).where(sql`${table.revokedAt} IS NULL`),
    expiryCheck: check('refresh_tokens_not_expired', sql`${table.expiresAt} > ${table.createdAt}`),
  }
});

export const PointGrantType = {
  REGISTRATION_BONUS: 'REGISTRATION_BONUS',
  ADMIN_GRANT: 'ADMIN_GRANT',
  PROMOTION: 'PROMOTION',
  CORRECTION: 'CORRECTION',
} as const;

export const pointGrants = pgTable('point_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  balanceBefore: bigint('balance_before', { mode: 'bigint' }).notNull(),
  balanceAfter: bigint('balance_after', { mode: 'bigint' }).notNull(),
  grantType: varchar('grant_type', { length: 30 }).notNull(),
  reason: varchar('reason', { length: 500 }),
  grantedBy: uuid('granted_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: index('idx_point_grants_user').on(table.userId, table.createdAt),
    typeIdx: index('idx_point_grants_type').on(table.grantType),
    amountCheck: check('point_grants_amount_positive', sql`${table.amount} > 0`),
    typeCheck: check('point_grants_type_valid', sql`${table.grantType} IN ('REGISTRATION_BONUS', 'ADMIN_GRANT', 'PROMOTION', 'CORRECTION')`),
  }
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  portfolios: many(portfolios),
  trades: many(tradeLedger),
  createdMarkets: many(markets),
  refreshTokens: many(refreshTokens),
  pointGrants: many(pointGrants),
}));

export const marketsRelations = relations(markets, ({ one, many }) => ({
  creator: one(users, {
    fields: [markets.createdBy],
    references: [users.id],
  }),
  pool: one(liquidityPools, {
    fields: [markets.id],
    references: [liquidityPools.id],
  }),
  portfolios: many(portfolios),
  trades: many(tradeLedger),
}));

export const liquidityPoolsRelations = relations(liquidityPools, ({ one }) => ({
  market: one(markets, {
    fields: [liquidityPools.id],
    references: [markets.id],
  }),
}));

export const portfoliosRelations = relations(portfolios, ({ one }) => ({
  user: one(users, {
    fields: [portfolios.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [portfolios.marketId],
    references: [markets.id],
  }),
}));

export const tradeLedgerRelations = relations(tradeLedger, ({ one }) => ({
  user: one(users, {
    fields: [tradeLedger.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [tradeLedger.marketId],
    references: [markets.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const pointGrantsRelations = relations(pointGrants, ({ one }) => ({
  user: one(users, {
    fields: [pointGrants.userId],
    references: [users.id],
  }),
  grantedByUser: one(users, {
    fields: [pointGrants.grantedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPES (Inferred from schema)
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;

export type LiquidityPool = typeof liquidityPools.$inferSelect;
export type NewLiquidityPool = typeof liquidityPools.$inferInsert;

export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;

export type TradeLedgerEntry = typeof tradeLedger.$inferSelect;
export type NewTradeLedgerEntry = typeof tradeLedger.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export type PointGrant = typeof pointGrants.$inferSelect;
export type NewPointGrant = typeof pointGrants.$inferInsert;
