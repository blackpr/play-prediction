import { CategoryRepository } from '../../ports/repositories/category.repository';
import { Category } from '../../../infrastructure/database/drizzle/schema';
import { ValidationError, NotFoundError } from '../../../domain/errors/domain-error';

export class UpdateCategoryUseCase {
  private readonly categoryRepository: CategoryRepository;

  constructor({ categoryRepository }: { categoryRepository: CategoryRepository }) {
    this.categoryRepository = categoryRepository;
  }

  async execute(id: string, updates: Partial<Category>): Promise<Category> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Category', id);
    }

    if (updates.slug && updates.slug !== existing.slug) {
      const slugExists = await this.categoryRepository.findBySlug(updates.slug);
      if (slugExists) {
        throw new ValidationError(`Category with slug "${updates.slug}" already exists`);
      }
    }

    return this.categoryRepository.update(id, updates);
  }
}
