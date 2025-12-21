import { and, asc, count, desc, eq, sql, gt } from 'drizzle-orm';
import { MarketRepository, GetMarketsParams, MarketWithDetails } from '../../../application/ports/repositories/market.repository';
import { DrizzleDB } from '..';
import { markets, liquidityPools, tradeLedger } from '../drizzle/schema';

export class PostgresMarketRepository implements MarketRepository {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async findAll(params: GetMarketsParams): Promise<{ items: MarketWithDetails[]; total: number }> {
    const { status, category, page, pageSize, sort, order } = params;
    const offset = (page - 1) * pageSize;

    // Base query conditions
    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(markets.status, status));
    }
    if (category && category !== 'all') {
      conditions.push(eq(markets.category, category));
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

    // 4. Calculate stats for each market (Volume 24h)
    const results: MarketWithDetails[] = await Promise.all(
      marketItems.map(async (row: any) => {
        const { markets: market, liquidity_pools: pool } = row;
        // Calculate 24h volume
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [volumeResult] = await this.db
          .select({
            volume: sql<string>`coalesce(sum(${tradeLedger.amountIn}), '0')`
          })
          .from(tradeLedger)
          .where(and(
            eq(tradeLedger.marketId, market.id),
            gt(tradeLedger.createdAt, oneDayAgo)
          ));

        const volume24h = volumeResult.volume;

        // Calculate prices
        let yesPrice = '0.500000';
        let noPrice = '0.500000';

        if (pool) {
          const yesQty = BigInt(pool.yesQty);
          const noQty = BigInt(pool.noQty);

          if (yesQty > 0n && noQty > 0n) {
            const totalQty = yesQty + noQty;

            // P_YES = NO_QTY / (YES_QTY + NO_QTY)
            // Using higher precision for division
            const precision = 1_000_000n;
            const yesPriceBig = (noQty * precision) / totalQty;
            const noPriceBig = (yesQty * precision) / totalQty; // P_NO = YES_QTY / TOTAL

            yesPrice = (Number(yesPriceBig) / 1_000_000).toFixed(6);
            noPrice = (Number(noPriceBig) / 1_000_000).toFixed(6);
          }
        }

        return {
          ...market,
          pool: pool ? {
            ...pool,
            yesQty: pool.yesQty.toString(),
            noQty: pool.noQty.toString(),
          } : null,
          volume24h: volume24h.toString(),
          yesPrice,
          noPrice
        };
      })
    );

    return { items: results, total };
  }

  async findById(id: string): Promise<MarketWithDetails | null> {
    const result = await this.db
      .select()
      .from(markets)
      .leftJoin(liquidityPools, eq(liquidityPools.id, markets.id))
      .where(eq(markets.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { markets: market, liquidity_pools: pool } = result[0];

    // Calculate 24h volume
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [volumeResult] = await this.db
      .select({
        volume: sql<string>`coalesce(sum(${tradeLedger.amountIn}), '0')`
      })
      .from(tradeLedger)
      .where(and(
        eq(tradeLedger.marketId, market.id),
        gt(tradeLedger.createdAt, oneDayAgo)
      ));

    // Calculate prices
    let yesPrice = '0.500000';
    let noPrice = '0.500000';

    if (pool) {
      const yesQty = BigInt(pool.yesQty);
      const noQty = BigInt(pool.noQty);

      if (yesQty > 0n && noQty > 0n) {
        const totalQty = yesQty + noQty;
        const precision = 1_000_000n;
        const yesPriceBig = (noQty * precision) / totalQty;
        const noPriceBig = (yesQty * precision) / totalQty;

        yesPrice = (Number(yesPriceBig) / 1_000_000).toFixed(6);
        noPrice = (Number(noPriceBig) / 1_000_000).toFixed(6);
      }
    }

    return {
      ...market,
      pool: pool ? {
        ...pool,
        yesQty: pool.yesQty.toString(),
        noQty: pool.noQty.toString(),
      } : null,
      volume24h: volumeResult.volume.toString(),
      yesPrice,
      noPrice
    };
  }
}
