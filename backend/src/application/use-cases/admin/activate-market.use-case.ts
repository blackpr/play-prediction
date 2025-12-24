import { MarketRepository } from '../../ports/repositories/market.repository';
import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus } from '../../../infrastructure/database/drizzle/schema';
import { WebSocketManager } from '../../../infrastructure/websocket/websocket-manager';

export interface ActivateMarketResult {
  id: string;
  status: string;
  activatedAt: Date;
}

export class ActivateMarketUseCase {
  constructor(
    private readonly deps: {
      marketRepository: MarketRepository;
      auditLogRepository: AuditLogRepository;
      webSocketManager: WebSocketManager;
    }
  ) { }

  async execute(marketId: string, adminId: string): Promise<ActivateMarketResult> {
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

    // 4. Create Audit Log
    await this.deps.auditLogRepository.create({
      adminId,
      action: 'MARKET_ACTIVATED',
      entityType: 'MARKET',
      entityId: marketId,
      details: JSON.stringify({ title: market.title }),
    });

    // 5. Broadcast WebSocket messages
    // 5a. Broadcast market_state (DRAFT → ACTIVE)
    this.deps.webSocketManager.broadcast(`market:${marketId}`, {
      type: 'market_state',
      channel: `market:${marketId}`,
      data: {
        marketId,
        previousStatus: MarketStatus.DRAFT,
        newStatus: MarketStatus.ACTIVE,
        reason: 'Market activated',
      },
    });

    // 5b. Broadcast new_market to global channel
    this.deps.webSocketManager.broadcast('global', {
      type: 'new_market',
      channel: 'global',
      data: {
        marketId,
        title: market.title,
        category: market.category,
        yesPrice: '0.50',
        noPrice: '0.50',
        closesAt: market.closesAt?.toISOString(),
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      activatedAt: updated.updatedAt,
    };
  }
}
