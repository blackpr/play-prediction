import { MarketRepository } from '../../ports/repositories/market.repository';
import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus } from '../../../infrastructure/database/drizzle/schema';

export class ResumeMarketUseCase {
  constructor(
    private readonly deps: {
      marketRepository: MarketRepository;
      auditLogRepository: AuditLogRepository;
    }
  ) { }

  async execute(marketId: string, adminId: string): Promise<ResumeMarketResult> {
    // 1. Find market
    const market = await this.deps.marketRepository.findById(marketId);
    if (!market) {
      throw new NotFoundError('Market', `Market with ID ${marketId} not found`);
    }

    // 2. Validate state transition: Only PAUSED → ACTIVE
    if (market.status !== MarketStatus.PAUSED) {
      throw new ValidationError(
        `Cannot resume market. Market must be in PAUSED status. Current status: ${market.status}`,
        { currentStatus: market.status, requiredStatus: MarketStatus.PAUSED }
      );
    }

    // 3. Update status to ACTIVE
    const updated = await this.deps.marketRepository.updateStatus(marketId, MarketStatus.ACTIVE);

    // 4. Create Audit Log
    await this.deps.auditLogRepository.create({
      adminId,
      action: 'MARKET_RESUMED',
      entityType: 'MARKET',
      entityId: marketId,
      details: JSON.stringify({ title: market.title }),
    });

    return {
      id: updated.id,
      status: updated.status,
      resumedAt: updated.updatedAt,
    };
  }
}

export interface ResumeMarketResult {
  id: string;
  status: string;
  resumedAt: Date;
}
