import { MarketRepository } from '../../ports/repositories/market.repository';
import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus } from '../../../infrastructure/database/drizzle/schema';

export interface PauseMarketParams {
  marketId: string;
  reason?: string;
  adminId: string;
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
      auditLogRepository: AuditLogRepository;
    }
  ) { }

  async execute(params: PauseMarketParams): Promise<PauseMarketResult> {
    const { marketId, reason, adminId } = params;

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

    // 4. Create Audit Log
    await this.deps.auditLogRepository.create({
      adminId,
      action: 'MARKET_PAUSED',
      entityType: 'MARKET',
      entityId: marketId,
      details: JSON.stringify({ title: market.title, reason }),
    });

    return {
      id: updated.id,
      status: updated.status,
      pausedAt: updated.updatedAt,
      reason,
    };
  }
}
