import { PointGrantRepository, CreatePointGrantDTO } from '../../../application/ports/repositories/point-grant.repository';
import { DrizzleDB } from '../../database';
import { pointGrants, PointGrantType } from '../drizzle/schema';

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
}
