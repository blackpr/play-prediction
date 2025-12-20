import { eq, desc, count } from 'drizzle-orm';
import { PointGrantRepository, CreatePointGrantDTO, PointGrant } from '../../../application/ports/repositories/point-grant.repository';
import { DrizzleDB } from '../../database';
import { pointGrants } from '../drizzle/schema';

export class PostgresPointGrantRepository implements PointGrantRepository {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async create(grant: CreatePointGrantDTO, tx?: unknown): Promise<void> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    await db.insert(pointGrants).values({
      userId: grant.userId,
      amount: grant.amount,
      balanceBefore: grant.balanceBefore,
      balanceAfter: grant.balanceAfter,
      grantType: grant.grantType,
      reason: grant.reason,
    });
  }

  async findByUserId(userId: string, { page, pageSize }: { page: number; pageSize: number }): Promise<{ items: (PointGrant & { grantedByEmail?: string })[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [items, totalCount] = await Promise.all([
      this.db.query.pointGrants.findMany({
        where: eq(pointGrants.userId, userId),
        orderBy: [desc(pointGrants.createdAt)],
        limit: pageSize,
        offset: offset,
        with: {
          grantedByUser: {
            columns: {
              email: true
            }
          }
        }
      }),
      this.db.select({ count: count() }).from(pointGrants).where(eq(pointGrants.userId, userId))
    ]);

    return {
      items: items.map(item => ({
        ...item,
        grantedByEmail: item.grantedByUser?.email ?? undefined
      })),
      total: Number(totalCount[0].count)
    };
  }
}

