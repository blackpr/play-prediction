import { eq } from 'drizzle-orm';
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
      createdAt: user.createdAt,
    };
  }
}
