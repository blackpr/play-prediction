import { eq, and } from 'drizzle-orm';
import {
  PortfolioRepository,
  Portfolio,
  CreatePortfolioDTO,
  UpdatePortfolioDTO,
} from '../../../application/ports/repositories/portfolio.repository';
import { DrizzleDB } from '../../database';
import { portfolios } from '../drizzle/schema';

export class PostgresPortfolioRepository implements PortfolioRepository {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async findByUserAndMarket(
    userId: string,
    marketId: string,
    tx?: unknown
  ): Promise<Portfolio | null> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const portfolio = await db.query.portfolios.findFirst({
      where: and(eq(portfolios.userId, userId), eq(portfolios.marketId, marketId)),
    });

    if (!portfolio) return null;

    return {
      userId: portfolio.userId,
      marketId: portfolio.marketId,
      yesQty: portfolio.yesQty,
      noQty: portfolio.noQty,
      yesCostBasis: portfolio.yesCostBasis,
      noCostBasis: portfolio.noCostBasis,
      updatedAt: portfolio.updatedAt,
    };
  }

  async findByUser(userId: string, tx?: unknown): Promise<Portfolio[]> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const results = await db.query.portfolios.findMany({
      where: eq(portfolios.userId, userId),
    });

    return results.map((portfolio) => ({
      userId: portfolio.userId,
      marketId: portfolio.marketId,
      yesQty: portfolio.yesQty,
      noQty: portfolio.noQty,
      yesCostBasis: portfolio.yesCostBasis,
      noCostBasis: portfolio.noCostBasis,
      updatedAt: portfolio.updatedAt,
    }));
  }

  async findByMarket(marketId: string, tx?: unknown): Promise<Portfolio[]> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const results = await db.query.portfolios.findMany({
      where: eq(portfolios.marketId, marketId),
    });

    return results.map((portfolio) => ({
      userId: portfolio.userId,
      marketId: portfolio.marketId,
      yesQty: portfolio.yesQty,
      noQty: portfolio.noQty,
      yesCostBasis: portfolio.yesCostBasis,
      noCostBasis: portfolio.noCostBasis,
      updatedAt: portfolio.updatedAt,
    }));
  }

  async create(dto: CreatePortfolioDTO, tx?: unknown): Promise<Portfolio> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const [portfolio] = await db
      .insert(portfolios)
      .values({
        userId: dto.userId,
        marketId: dto.marketId,
        yesQty: dto.yesQty,
        noQty: dto.noQty,
        yesCostBasis: dto.yesCostBasis,
        noCostBasis: dto.noCostBasis,
      })
      .returning();

    return {
      userId: portfolio.userId,
      marketId: portfolio.marketId,
      yesQty: portfolio.yesQty,
      noQty: portfolio.noQty,
      yesCostBasis: portfolio.yesCostBasis,
      noCostBasis: portfolio.noCostBasis,
      updatedAt: portfolio.updatedAt,
    };
  }

  async update(
    userId: string,
    marketId: string,
    updates: UpdatePortfolioDTO,
    tx?: unknown
  ): Promise<Portfolio> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const [portfolio] = await db
      .update(portfolios)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(portfolios.userId, userId), eq(portfolios.marketId, marketId)))
      .returning();

    return {
      userId: portfolio.userId,
      marketId: portfolio.marketId,
      yesQty: portfolio.yesQty,
      noQty: portfolio.noQty,
      yesCostBasis: portfolio.yesCostBasis,
      noCostBasis: portfolio.noCostBasis,
      updatedAt: portfolio.updatedAt,
    };
  }
}
