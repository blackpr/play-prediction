import { CategoryRepository } from '../../ports/repositories/category.repository';
import { Category } from '../../../infrastructure/database/drizzle/schema';

export class ListCategoriesUseCase {
  private readonly categoryRepository: CategoryRepository;

  constructor({ categoryRepository }: { categoryRepository: CategoryRepository }) {
    this.categoryRepository = categoryRepository;
  }

  async execute(includeInactive = false): Promise<Category[]> {
    return this.categoryRepository.findAll(includeInactive);
  }
}
