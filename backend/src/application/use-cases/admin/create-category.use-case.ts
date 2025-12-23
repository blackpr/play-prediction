import { CategoryRepository } from '../../ports/repositories/category.repository';
import { NewCategory, Category } from '../../../infrastructure/database/drizzle/schema';
import { ValidationError } from '../../../domain/errors/domain-error';

export class CreateCategoryUseCase {
  private readonly categoryRepository: CategoryRepository;

  constructor({ categoryRepository }: { categoryRepository: CategoryRepository }) {
    this.categoryRepository = categoryRepository;
  }

  async execute(data: NewCategory): Promise<Category> {
    const existing = await this.categoryRepository.findBySlug(data.slug);
    if (existing) {
      throw new ValidationError(`Category with slug "${data.slug}" already exists`);
    }

    return this.categoryRepository.create(data);
  }
}
