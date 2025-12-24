import { eq, count, like, desc, and } from 'drizzle-orm';
import { UserRepository, User } from '../../../application/ports/repositories/user.repository';
import { DrizzleDB } from '../../database'; // Assuming DrizzleDB type wraps the drizzle instance
import { users } from '../drizzle/schema';

export class PostgresUserRepository implements UserRepository {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async findByRole(role: string): Promise<User | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.role, role),
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async create(dto: import('../../../application/ports/repositories/user.repository').CreateUserDTO, tx?: unknown): Promise<User> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    const [user] = await db.insert(users).values({
      id: dto.id,
      email: dto.email,
      role: dto.role,
      balance: dto.balance,
    }).returning();

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async updateBalance(userId: string, newBalance: bigint, tx?: unknown): Promise<void> {
    const db = tx ? (tx as DrizzleDB) : this.db;

    await db
      .update(users)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async findAll(params: import('../../../application/ports/repositories/user.repository').FindAllUsersParams): Promise<import('../../../application/ports/repositories/user.repository').PaginatedUsers> {
    const { search, role, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [];
    if (search) {
      conditions.push(like(users.email, `%${search}%`));
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countQuery = this.db
      .select({ count: count() })
      .from(users);

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const [countResult] = await countQuery;
    const totalItems = Number(countResult.count);

    // Get paginated results
    const selectQuery = this.db
      .select()
      .from(users);

    if (whereClause) {
      selectQuery.where(whereClause);
    }

    const results = await selectQuery
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: results.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        balance: user.balance,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
      },
    };
  }

  async count(): Promise<number> {
    const [result] = await this.db.select({ count: count() }).from(users);
    return Number(result.count);
  }

  async getUserStats(userId: string): Promise<import('../../../application/ports/repositories/user.repository').UserStats> {
    const { tradeLedger, portfolios, pointGrants } = await import('../drizzle/schema');
    const { eq, and, or, sum, sql } = await import('drizzle-orm');

    // 1. Get total trades count and volume (only BUY/SELL actions)
    const tradesQuery = this.db
      .select({
        totalTrades: count(),
        totalVolume: sum(tradeLedger.amountIn),
      })
      .from(tradeLedger)
      .where(
        and(
          eq(tradeLedger.userId, userId),
          or(
            eq(tradeLedger.action, 'BUY'),
            eq(tradeLedger.action, 'SELL')
          )
        )
      );

    const [tradesResult] = await tradesQuery;

    // 2. Get active positions count (portfolios with shares > 0)
    const activePositionsQuery = this.db
      .select({ count: count() })
      .from(portfolios)
      .where(
        and(
          eq(portfolios.userId, userId),
          or(
            sql`${portfolios.yesQty} > 0`,
            sql`${portfolios.noQty} > 0`
          )
        )
      );

    const [positionsResult] = await activePositionsQuery;

    // 3. Get total points granted (ADMIN_GRANT only)
    const pointsQuery = this.db
      .select({
        totalGranted: sum(pointGrants.amount),
      })
      .from(pointGrants)
      .where(
        and(
          eq(pointGrants.userId, userId),
          eq(pointGrants.grantType, 'ADMIN_GRANT')
        )
      );

    const [pointsResult] = await pointsQuery;

    return {
      totalTrades: Number(tradesResult.totalTrades) || 0,
      totalVolume: (tradesResult.totalVolume || 0n).toString(),
      activePositions: Number(positionsResult.count) || 0,
      pointsGranted: (pointsResult.totalGranted || 0n).toString(),
    };
  }

  async countActive(since: Date): Promise<number> {
    const { tradeLedger } = await import('../drizzle/schema');
    const { gt, sql } = await import('drizzle-orm');

    const [result] = await this.db
      .select({ count: sql<number>`count(distinct ${tradeLedger.userId})` })
      .from(tradeLedger)
      .where(gt(tradeLedger.createdAt, since));

    return Number(result.count);
  }
}

