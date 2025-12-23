import { Category, NewCategory } from '../../../infrastructure/database/drizzle/schema';

export interface CategoryRepository {
  findAll(includeInactive?: boolean): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  create(category: NewCategory): Promise<Category>;
  update(id: string, updates: Partial<Category>): Promise<Category>;
  delete(id: string): Promise<void>;
  countMarkets(id: string): Promise<number>;
}
