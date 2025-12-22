import { MarketRepository } from '../../ports/repositories/market.repository';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus } from '../../../infrastructure/database/drizzle/schema';

export interface PauseMarketParams {
  marketId: string;
  reason?: string;
}

export interface PauseMarketResult {
  id: string;
  status: string;
  pausedAt: Date;
  reason?: string;
}

export class PauseMarketUseCase {
  constructor(
    private readonly deps: {
      marketRepository: MarketRepository;
    }
  ) { }

  async execute(params: PauseMarketParams): Promise<PauseMarketResult> {
    const { marketId, reason } = params;

    // 1. Find market
    const market = await this.deps.marketRepository.findById(marketId);
    if (!market) {
      throw new NotFoundError('Market', `Market with ID ${marketId} not found`);
    }

    // 2. Validate state transition: Only ACTIVE → PAUSED
    if (market.status !== MarketStatus.ACTIVE) {
      throw new ValidationError(
        `Cannot pause market. Market must be in ACTIVE status. Current status: ${market.status}`,
        { currentStatus: market.status, requiredStatus: MarketStatus.ACTIVE }
      );
    }

    // 3. Update status to PAUSED
    const updated = await this.deps.marketRepository.updateStatus(marketId, MarketStatus.PAUSED);

    return {
      id: updated.id,
      status: updated.status,
      pausedAt: updated.updatedAt,
      reason,
    };
  }
}
