import { and, asc, count, desc, eq, sql, gt, ilike, or } from 'drizzle-orm';
import { MarketRepository, GetMarketsParams, MarketWithDetails } from '../../../application/ports/repositories/market.repository';
import { DrizzleDB } from '..';
import { markets, liquidityPools, tradeLedger } from '../drizzle/schema';

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
          } : null,
          volume24h,
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

    const volume24h = await this.get24hVolume(market.id);
    const { yesPrice, noPrice } = this.calculatePrices(pool);

    return {
      ...market,
      pool: pool ? {
        ...pool,
        yesQty: pool.yesQty.toString(),
        noQty: pool.noQty.toString(),
      } : null,
      volume24h,
      yesPrice,
      noPrice
    };
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
}
