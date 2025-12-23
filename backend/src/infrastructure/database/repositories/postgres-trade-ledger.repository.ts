import { eq, and, desc, count, sql, gt } from 'drizzle-orm';
import {
  TradeLedgerRepository,
  TradeLedgerEntry,
  CreateTradeLedgerEntryDTO,
  FindTradesParams,
} from '../../../application/ports/repositories/trade-ledger.repository';
import { DrizzleDB } from '../../database';
import { tradeLedger } from '../drizzle/schema';

export class PostgresTradeLedgerRepository implements TradeLedgerRepository {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async findByIdempotencyKey(key: string, tx?: unknown): Promise<TradeLedgerEntry | null> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const entry = await db.query.tradeLedger.findFirst({
      where: eq(tradeLedger.idempotencyKey, key),
    });

    if (!entry) return null;

    return {
      id: entry.id,
      userId: entry.userId,
      marketId: entry.marketId,
      action: entry.action,
      side: entry.side,
      amountIn: entry.amountIn,
      amountOut: entry.amountOut,
      sharesBefore: entry.sharesBefore,
      sharesAfter: entry.sharesAfter,
      feePaid: entry.feePaid,
      feeVault: entry.feeVault,
      feeLp: entry.feeLp,
      poolYesBefore: entry.poolYesBefore,
      poolNoBefore: entry.poolNoBefore,
      poolYesAfter: entry.poolYesAfter,
      poolNoAfter: entry.poolNoAfter,
      priceAtExecution: entry.priceAtExecution,
      idempotencyKey: entry.idempotencyKey,
      createdAt: entry.createdAt,
    };
  }

  async findAll(params: FindTradesParams): Promise<{ items: TradeLedgerEntry[]; total: number }> {
    const { userId, marketId, action, page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (userId) {
      conditions.push(eq(tradeLedger.userId, userId));
    }

    if (marketId) {
      conditions.push(eq(tradeLedger.marketId, marketId));
    }

    if (action) {
      conditions.push(eq(tradeLedger.action, action));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.db
      .select({ count: count() })
      .from(tradeLedger)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Get items
    const rows = await this.db.query.tradeLedger.findMany({
      where: whereClause,
      limit: pageSize,
      offset: offset,
      orderBy: [desc(tradeLedger.createdAt)],
    });

    const items = rows.map(entry => ({
      id: entry.id,
      userId: entry.userId,
      marketId: entry.marketId,
      action: entry.action,
      side: entry.side,
      amountIn: entry.amountIn,
      amountOut: entry.amountOut,
      sharesBefore: entry.sharesBefore,
      sharesAfter: entry.sharesAfter,
      feePaid: entry.feePaid,
      feeVault: entry.feeVault,
      feeLp: entry.feeLp,
      poolYesBefore: entry.poolYesBefore,
      poolNoBefore: entry.poolNoBefore,
      poolYesAfter: entry.poolYesAfter,
      poolNoAfter: entry.poolNoAfter,
      priceAtExecution: entry.priceAtExecution,
      idempotencyKey: entry.idempotencyKey,
      createdAt: entry.createdAt,
    }));

    return { items, total };
  }

  async create(dto: CreateTradeLedgerEntryDTO, tx?: unknown): Promise<TradeLedgerEntry> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const [entry] = await db
      .insert(tradeLedger)
      .values({
        userId: dto.userId,
        marketId: dto.marketId,
        action: dto.action,
        side: dto.side,
        amountIn: dto.amountIn,
        amountOut: dto.amountOut,
        sharesBefore: dto.sharesBefore ?? null,
        sharesAfter: dto.sharesAfter ?? null,
        feePaid: dto.feePaid,
        feeVault: dto.feeVault,
        feeLp: dto.feeLp,
        poolYesBefore: dto.poolYesBefore ?? null,
        poolNoBefore: dto.poolNoBefore ?? null,
        poolYesAfter: dto.poolYesAfter ?? null,
        poolNoAfter: dto.poolNoAfter ?? null,
        priceAtExecution: dto.priceAtExecution ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
      })
      .returning();

    return {
      id: entry.id,
      userId: entry.userId,
      marketId: entry.marketId,
      action: entry.action,
      side: entry.side,
      amountIn: entry.amountIn,
      amountOut: entry.amountOut,
      sharesBefore: entry.sharesBefore,
      sharesAfter: entry.sharesAfter,
      feePaid: entry.feePaid,
      feeVault: entry.feeVault,
      feeLp: entry.feeLp,
      poolYesBefore: entry.poolYesBefore,
      poolNoBefore: entry.poolNoBefore,
      poolYesAfter: entry.poolYesAfter,
      poolNoAfter: entry.poolNoAfter,
      priceAtExecution: entry.priceAtExecution,
      idempotencyKey: entry.idempotencyKey,
      createdAt: entry.createdAt,
    };
  }

  async getVolume24h(): Promise<string> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [result] = await this.db
      .select({ volume: sql<string>`coalesce(sum(${tradeLedger.amountIn}), '0')` })
      .from(tradeLedger)
      .where(gt(tradeLedger.createdAt, oneDayAgo));
    return result.volume.toString();
  }

  async getTotalVolume(): Promise<string> {
    const [result] = await this.db
      .select({ volume: sql<string>`coalesce(sum(${tradeLedger.amountIn}), '0')` })
      .from(tradeLedger);
    return result.volume.toString();
  }
}
