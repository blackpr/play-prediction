import { eq } from 'drizzle-orm';
import {
  TradeLedgerRepository,
  TradeLedgerEntry,
  CreateTradeLedgerEntryDTO,
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
}
