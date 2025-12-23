import { and, asc, count, desc, eq, sql, gt, ilike, or, inArray } from 'drizzle-orm';
import { MarketRepository, GetMarketsParams, MarketWithDetails, MarketExtendedDetails, MarketStats, PriceCandle, RecentTrade } from '../../../application/ports/repositories/market.repository';
import { DrizzleDB } from '..';
import { markets, liquidityPools, tradeLedger, users } from '../drizzle/schema';

export class PostgresMarketRepository implements MarketRepository {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async findAll(params: GetMarketsParams): Promise<{ items: MarketWithDetails[]; total: number }> {
    const { status, category, page, pageSize, sort, order, search } = params;
    const offset = (page - 1) * pageSize;

    // Base query conditions
    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(markets.status, status));
    }
    if (category && category !== 'all') {
      conditions.push(eq(markets.category, category));
    }
    if (search) {
      conditions.push(or(
        ilike(markets.title, `%${search}%`),
        ilike(markets.description, `%${search}%`)
      ));
    }

    // 1. Get total count
    const [countResult] = await this.db
      .select({ count: count() })
      .from(markets)
      .where(and(...conditions));

    const total = Number(countResult.count);

    if (total === 0) {
      return { items: [], total: 0 };
    }

    // 2. Determine sort field
    let orderBy;
    const sortOrder = order === 'asc' ? asc : desc;

    switch (sort) {
      case 'createdAt':
        orderBy = sortOrder(markets.createdAt);
        break;
      case 'closesAt':
        orderBy = sortOrder(markets.closesAt);
        break;
      // Volume sorting is complex due to join, defaulting to createdAt for MVP if not handled specifically below
      default:
        orderBy = desc(markets.createdAt);
    }

    // 3. Fetch markets with pools
    const marketItems = await this.db
      .select()
      .from(markets)
      .leftJoin(liquidityPools, eq(liquidityPools.id, markets.id))
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset)
      .orderBy(orderBy);

    // 4. Calculate stats for each market (Volume 24h & Prices)
    const results: MarketWithDetails[] = await Promise.all(
      marketItems.map(async (row: any) => {
        const { markets: market, liquidity_pools: pool } = row;

        const volume24h = await this.get24hVolume(market.id);
        const { yesPrice, noPrice } = this.calculatePrices(pool);

        return {
          ...market,
          pool: pool ? {
            ...pool,
            yesQty: pool.yesQty.toString(),
            noQty: pool.noQty.toString(),
            k: (BigInt(pool.yesQty) * BigInt(pool.noQty)).toString(),
          } : null,
          volume24h,
          yesPrice,
          noPrice
        };
      })
    );

    return { items: results, total };
  }

  async findById(id: string): Promise<MarketExtendedDetails | null> {
    const result = await this.db
      .select()
      .from(markets)
      .leftJoin(liquidityPools, eq(liquidityPools.id, markets.id))
      .leftJoin(users, eq(users.id, markets.createdBy))
      .where(eq(markets.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { markets: market, liquidity_pools: pool, users: creator } = result[0];

    if (!creator) {
      // This shouldn't happen if foreign key constraints are working
      throw new Error(`Creator not found for market ${id}`);
    }

    const volume24h = await this.get24hVolume(market.id);
    const stats = await this.getMarketStats(market.id);
    // Ensure 24h volume is consistent across stats (though getMarketStats calculates total)
    // Actually spec asks for stats object with volume24h inside it too

    const { yesPrice, noPrice } = this.calculatePrices(pool);

    return {
      ...market,
      volume24h,
      yesPrice,
      noPrice,
      stats: {
        ...stats,
        volume24h
      },
      pool: pool ? {
        ...pool,
        yesQty: pool.yesQty.toString(),
        noQty: pool.noQty.toString(),
        k: (BigInt(pool.yesQty) * BigInt(pool.noQty)).toString(),
      } : null,
      creator: {
        email: creator.email,
        displayName: creator.displayName,
        role: creator.role,
      }
    };
  }

  async getPriceHistory(marketId: string, interval: string, from: Date, to: Date): Promise<PriceCandle[]> {
    // Map interval to seconds
    let intervalSeconds = 3600; // Default 1h
    switch (interval) {
      case '1m': intervalSeconds = 60; break;
      case '5m': intervalSeconds = 300; break;
      case '15m': intervalSeconds = 900; break;
      case '1h': intervalSeconds = 3600; break;
      case '4h': intervalSeconds = 14400; break;
      case '1d': intervalSeconds = 86400; break;
    }

    // SQL for OHLC aggregation
    // YES PRICE = NO_QTY / (YES_QTY + NO_QTY)
    const result = await this.db.execute(sql`
      SELECT
        to_timestamp(floor(extract(epoch from created_at) / ${intervalSeconds}) * ${intervalSeconds}) as bucket,
        (array_agg(
          CASE WHEN (pool_yes_after + pool_no_after) > 0 
          THEN CAST(pool_no_after AS NUMERIC) / (pool_yes_after + pool_no_after)
          ELSE 0.5 END
          ORDER BY created_at ASC
        ))[1] as open_price,
        MAX(
          CASE WHEN (pool_yes_after + pool_no_after) > 0 
          THEN CAST(pool_no_after AS NUMERIC) / (pool_yes_after + pool_no_after)
          ELSE 0.5 END
        ) as high_price,
        MIN(
          CASE WHEN (pool_yes_after + pool_no_after) > 0 
          THEN CAST(pool_no_after AS NUMERIC) / (pool_yes_after + pool_no_after)
          ELSE 0.5 END
        ) as low_price,
        (array_agg(
          CASE WHEN (pool_yes_after + pool_no_after) > 0 
          THEN CAST(pool_no_after AS NUMERIC) / (pool_yes_after + pool_no_after)
          ELSE 0.5 END
          ORDER BY created_at DESC
        ))[1] as close_price,
        COALESCE(SUM(amount_in), 0) as volume
      FROM ${tradeLedger}
      WHERE ${tradeLedger.marketId} = ${marketId}
        AND ${tradeLedger.createdAt} >= ${from.toISOString()}
        AND ${tradeLedger.createdAt} <= ${to.toISOString()}
        AND ${tradeLedger.poolYesAfter} IS NOT NULL 
        AND ${tradeLedger.poolNoAfter} IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    return result.map((row: any) => ({
      timestamp: new Date(row.bucket).toISOString(),
      yesOpen: Number(row.open_price).toFixed(2),
      yesHigh: Number(row.high_price).toFixed(2),
      yesLow: Number(row.low_price).toFixed(2),
      yesClose: Number(row.close_price).toFixed(2),
      volume: row.volume.toString()
    }));
  }

  private async get24hVolume(marketId: string): Promise<string> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [volumeResult] = await this.db
      .select({
        volume: sql<string>`coalesce(sum(${tradeLedger.amountIn}), '0')`
      })
      .from(tradeLedger)
      .where(and(
        eq(tradeLedger.marketId, marketId),
        gt(tradeLedger.createdAt, oneDayAgo)
      ));

    return volumeResult.volume.toString();
  }

  private async getMarketStats(marketId: string): Promise<Omit<MarketStats, 'volume24h'>> {
    const [result] = await this.db
      .select({
        totalVolume: sql<string>`coalesce(sum(${tradeLedger.amountIn}), '0')`,
        tradeCount: count(tradeLedger.id),
        uniqueTraders: sql<number>`count(distinct ${tradeLedger.userId})`
      })
      .from(tradeLedger)
      .where(eq(tradeLedger.marketId, marketId));

    return {
      totalVolume: result.totalVolume.toString(),
      tradeCount: Number(result.tradeCount),
      uniqueTraders: Number(result.uniqueTraders)
    };
  }

  private calculatePrices(pool: { yesQty: bigint | string, noQty: bigint | string } | null): { yesPrice: string; noPrice: string } {
    let yesPrice = '0.500000';
    let noPrice = '0.500000';

    if (pool) {
      const yesQty = BigInt(pool.yesQty);
      const noQty = BigInt(pool.noQty);

      if (yesQty > 0n && noQty > 0n) {
        const totalQty = yesQty + noQty;
        const precision = 1_000_000n;

        // P_YES = NO_QTY / (YES_QTY + NO_QTY)
        const yesPriceBig = (noQty * precision) / totalQty;
        // P_NO = 1.0 - P_YES (ensures sum is 1.0)
        const noPriceBig = precision - yesPriceBig;

        yesPrice = (Number(yesPriceBig) / 1_000_000).toFixed(6);
        noPrice = (Number(noPriceBig) / 1_000_000).toFixed(6);
      }
    }

    return { yesPrice, noPrice };
  }

  async getRecentTrades(marketId: string, limit: number): Promise<RecentTrade[]> {
    const trades = await this.db
      .select({
        id: tradeLedger.id,
        userId: tradeLedger.userId,
        action: tradeLedger.action,
        side: tradeLedger.side,
        amountIn: tradeLedger.amountIn,
        amountOut: tradeLedger.amountOut,
        priceAtExecution: tradeLedger.priceAtExecution,
        createdAt: tradeLedger.createdAt,
      })
      .from(tradeLedger)
      .where(and(
        eq(tradeLedger.marketId, marketId),
        inArray(tradeLedger.action, ['BUY', 'SELL'])
      ))
      .orderBy(desc(tradeLedger.createdAt))
      .limit(limit);

    return trades.map(trade => ({
      id: trade.id,
      userId: trade.userId,
      action: trade.action!,
      side: trade.side!,
      amountIn: trade.amountIn.toString(),
      amountOut: trade.amountOut.toString(),
      priceAtExecution: trade.priceAtExecution ? trade.priceAtExecution.toString() : '0',
      createdAt: trade.createdAt,
    }));
  }

  async findByIdWithPool(id: string, tx?: unknown): Promise<import('../../../application/ports/repositories/market.repository').MarketWithPool | null> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const result = await db
      .select()
      .from(markets)
      .leftJoin(liquidityPools, eq(liquidityPools.id, markets.id))
      .where(eq(markets.id, id))
      .limit(1);

    if (result.length === 0 || !result[0].liquidity_pools) {
      return null;
    }

    const { markets: market, liquidity_pools: pool } = result[0];

    return {
      id: market.id,
      title: market.title,
      status: market.status,
      closesAt: market.closesAt,
      pool: {
        yesQty: pool.yesQty,
        noQty: pool.noQty,
        versionId: pool.versionId,
      },
    };
  }

  async updatePoolWithLock(
    marketId: string,
    newYesQty: bigint,
    newNoQty: bigint,
    expectedVersion: number,
    tx?: unknown
  ): Promise<import('../../../application/ports/repositories/market.repository').UpdatePoolResult> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const result = await db
      .update(liquidityPools)
      .set({
        yesQty: newYesQty,
        noQty: newNoQty,
        versionId: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(
        eq(liquidityPools.id, marketId),
        eq(liquidityPools.versionId, expectedVersion)
      ))
      .returning();

    if (result.length === 0) {
      return {
        success: false,
        newYesQty: 0n,
        newNoQty: 0n,
        newVersionId: 0,
      };
    }

    return {
      success: true,
      newYesQty: result[0].yesQty,
      newNoQty: result[0].noQty,
      newVersionId: result[0].versionId,
    };
  }

  async updateUserBalance(userId: string, newBalance: bigint, tx?: unknown): Promise<void> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    await db
      .update(users)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async create(market: import('../drizzle/schema').NewMarket, tx?: unknown): Promise<import('../drizzle/schema').Market> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const [created] = await db
      .insert(markets)
      .values(market)
      .returning();

    return created;
  }

  async createPool(pool: import('../drizzle/schema').NewLiquidityPool, tx?: unknown): Promise<void> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    await db
      .insert(liquidityPools)
      .values(pool);
  }

  async updateStatus(marketId: string, newStatus: string, tx?: unknown): Promise<import('../drizzle/schema').Market> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const [updated] = await db
      .update(markets)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(markets.id, marketId))
      .returning();

    return updated;
  }

  async update(
    marketId: string,
    updates: Partial<Pick<import('../drizzle/schema').Market, 'title' | 'description' | 'category' | 'imageUrl' | 'closesAt'>>,
    tx?: unknown
  ): Promise<import('../drizzle/schema').Market> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const [updated] = await db
      .update(markets)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(markets.id, marketId))
      .returning();

    return updated;
  }

  async count(status?: string): Promise<number> {
    const conditions = [];
    if (status) {
      conditions.push(eq(markets.status, status));
    }
    const [result] = await this.db
      .select({ count: count() })
      .from(markets)
      .where(and(...conditions));
    return Number(result.count);
  }
}
