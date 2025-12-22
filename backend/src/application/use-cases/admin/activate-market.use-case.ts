import { MarketRepository } from '../../ports/repositories/market.repository';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus } from '../../../infrastructure/database/drizzle/schema';

export interface ActivateMarketResult {
  id: string;
  status: string;
  activatedAt: Date;
}

export class ActivateMarketUseCase {
  constructor(
    private readonly deps: {
      marketRepository: MarketRepository;
    }
  ) { }

  async execute(marketId: string): Promise<ActivateMarketResult> {
    // 1. Find market
    const market = await this.deps.marketRepository.findById(marketId);
    if (!market) {
      throw new NotFoundError('Market', `Market with ID ${marketId} not found`);
    }

    // 2. Validate state transition: Only DRAFT → ACTIVE
    if (market.status !== MarketStatus.DRAFT) {
      throw new ValidationError(
        `Cannot activate market. Market must be in DRAFT status. Current status: ${market.status}`,
        { currentStatus: market.status, requiredStatus: MarketStatus.DRAFT }
      );
    }

    // 3. Update status to ACTIVE
    const updated = await this.deps.marketRepository.updateStatus(marketId, MarketStatus.ACTIVE);

    return {
      id: updated.id,
      status: updated.status,
      activatedAt: updated.updatedAt,
    };
  }
}
