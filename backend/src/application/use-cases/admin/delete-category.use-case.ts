import { CategoryRepository } from '../../ports/repositories/category.repository';
import { NotFoundError, BusinessLogicError } from '../../../domain/errors/domain-error';

export class DeleteCategoryUseCase {
  private readonly categoryRepository: CategoryRepository;

  constructor({ categoryRepository }: { categoryRepository: CategoryRepository }) {
    this.categoryRepository = categoryRepository;
  }

  async execute(id: string): Promise<void> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Category', id);
    }

    const marketCount = await this.categoryRepository.countMarkets(id);
    if (marketCount > 0) {
      throw new BusinessLogicError(
        `Cannot delete category "${existing.name}" because it has ${marketCount} linked markets. Please reassign or delete the markets first.`,
        'CATEGORY_HAS_MARKETS'
      );
    }

    await this.categoryRepository.delete(id);
  }
}
