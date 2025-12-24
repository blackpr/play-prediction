import { MarketRepository } from '../../ports/repositories/market.repository';
import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus } from '../../../infrastructure/database/drizzle/schema';

export interface ExtendMarketCloseTimeParams {
  marketId: string;
  newClosesAt: string; // ISO 8601 datetime string
  reason: string;
  adminId: string;
}

export interface ExtendMarketCloseTimeResult {
  id: string;
  title: string;
  oldClosesAt: Date;
  newClosesAt: Date;
  reason: string;
}

export class ExtendMarketCloseTimeUseCase {
  constructor(
    private readonly deps: {
      marketRepository: MarketRepository;
      auditLogRepository: AuditLogRepository;
    }
  ) { }

  async execute(params: ExtendMarketCloseTimeParams): Promise<ExtendMarketCloseTimeResult> {
    const { marketId, newClosesAt, reason, adminId } = params;

    // 1. Find market
    const market = await this.deps.marketRepository.findById(marketId);
    if (!market) {
      throw new NotFoundError('Market', `Market with ID ${marketId} not found`);
    }

    // 2. Validate state: Only ACTIVE markets can be extended
    if (market.status !== MarketStatus.ACTIVE) {
      throw new ValidationError(
        `Cannot extend market close time. Market must be in ACTIVE status. Current status: ${market.status}`,
        { currentStatus: market.status, requiredStatus: MarketStatus.ACTIVE }
      );
    }

    // 3. Parse and validate new close time
    const newClosesAtDate = new Date(newClosesAt);
    const now = new Date();
    const currentClosesAt = market.closesAt;

    // Validate: new time must be in the future
    if (newClosesAtDate <= now) {
      throw new ValidationError(
        'New close time must be in the future',
        { newClosesAt: newClosesAtDate.toISOString(), currentTime: now.toISOString() }
      );
    }

    // Validate: new time must be after current closesAt
    if (!currentClosesAt) {
      throw new ValidationError(
        'Market does not have a close time set',
        { marketId }
      );
    }

    if (newClosesAtDate <= currentClosesAt) {
      throw new ValidationError(
        'New close time must be after the current close time',
        {
          newClosesAt: newClosesAtDate.toISOString(),
          currentClosesAt: currentClosesAt.toISOString()
        }
      );
    }

    // 4. Update market close time
    const updated = await this.deps.marketRepository.update(
      marketId,
      { closesAt: newClosesAtDate }
    );

    // 5. Create Audit Log
    await this.deps.auditLogRepository.create({
      adminId,
      action: 'MARKET_CLOSE_TIME_EXTENDED',
      entityType: 'MARKET',
      entityId: marketId,
      details: JSON.stringify({
        title: market.title,
        oldClosesAt: currentClosesAt.toISOString(),
        newClosesAt: newClosesAtDate.toISOString(),
        reason,
      }),
    });

    return {
      id: updated.id,
      title: market.title,
      oldClosesAt: currentClosesAt,
      newClosesAt: newClosesAtDate,
      reason,
    };
  }
}
