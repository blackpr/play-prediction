import { Category, NewCategory, categories, markets } from '../drizzle/schema';
import { CategoryRepository } from '../../../application/ports/repositories/category.repository';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, sql, asc } from 'drizzle-orm';

export class PostgresCategoryRepository implements CategoryRepository {
  private readonly db: any;
  constructor({ db }: { db: any }) {
    this.db = db;
  }

  async findAll(includeInactive = false): Promise<Category[]> {
    const query = this.db.select().from(categories);
    if (!includeInactive) {
      query.where(eq(categories.isActive, true));
    }
    return query.orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async findById(id: string): Promise<Category | null> {
    const results = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return results[0] || null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const results = await this.db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return results[0] || null;
  }

  async create(category: NewCategory): Promise<Category> {
    const [result] = await this.db.insert(categories).values(category).returning();
    return result;
  }

  async update(id: string, updates: Partial<Category>): Promise<Category> {
    const [result] = await this.db
      .update(categories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(categories).where(eq(categories.id, id));
  }

  async countMarkets(id: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(markets)
      .where(eq(markets.categoryId, id));
    return Number(result[0]?.count || 0);
  }
}
