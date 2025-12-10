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
}
