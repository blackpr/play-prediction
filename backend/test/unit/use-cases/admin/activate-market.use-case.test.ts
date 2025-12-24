import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivateMarketUseCase } from '../../../../src/application/use-cases/admin/activate-market.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus } from '../../../../src/infrastructure/database/drizzle/schema';

describe('ActivateMarketUseCase', () => {
  let useCase: ActivateMarketUseCase;
  let mockMarketRepository: any;
  let mockAuditLogRepository: any;

  const mockDraftMarket = {
    id: 'market-id',
    title: 'Test Market',
    description: 'Test Description',
    status: MarketStatus.DRAFT,
    closeBehavior: 'auto',
    bufferMinutes: null,
    category: 'Weather',
    imageUrl: null,
    closesAt: new Date('2025-12-25T00:00:00Z'),
    resolvedAt: null,
    eventEndedAt: null,
    resolution: null,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    pool: null,
    volume24h: '0',
    yesPrice: '0.5',
    noPrice: '0.5',
    stats: {
      totalVolume: '0',
      volume24h: '0',
      tradeCount: 0,
      uniqueTraders: 0,
    },
    creator: {
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
    },
  };

  const mockUpdatedMarket = {
    id: 'market-id',
    title: 'Test Market',
    description: 'Test Description',
    status: MarketStatus.ACTIVE,
    closeBehavior: 'auto',
    bufferMinutes: null,
    category: 'Weather',
    imageUrl: null,
    closesAt: new Date('2025-12-25T00:00:00Z'),
    resolvedAt: null,
    eventEndedAt: null,
    resolution: null,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockMarketRepository = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
    };

    mockAuditLogRepository = {
      create: vi.fn(),
    };
    const mockWebSocketManager = {
      broadcast: vi.fn(),
      sendToUser: vi.fn(),
    };


    useCase = new ActivateMarketUseCase({
      marketRepository: mockMarketRepository,
      auditLogRepository: mockAuditLogRepository,
      webSocketManager: { broadcast: vi.fn(), sendToUser: vi.fn() } as any,
    });
  });

  describe('execute', () => {
    it('should successfully activate a DRAFT market', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockDraftMarket);
      mockMarketRepository.updateStatus.mockResolvedValue(mockUpdatedMarket);

      const result = await useCase.execute('market-id', 'admin-id');

      expect(mockMarketRepository.findById).toHaveBeenCalledWith('market-id');
      expect(mockMarketRepository.updateStatus).toHaveBeenCalledWith('market-id', MarketStatus.ACTIVE);
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 'admin-id',
        action: 'MARKET_ACTIVATED',
        entityType: 'MARKET',
        entityId: 'market-id',
      }));
      expect(result.id).toBe('market-id');
      expect(result.status).toBe(MarketStatus.ACTIVE);
      expect(result.activatedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError if market does not exist', async () => {
      mockMarketRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('non-existent-id', 'admin-id')
      ).rejects.toThrow(NotFoundError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockAuditLogRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is not in DRAFT status', async () => {
      const activeMarket = { ...mockDraftMarket, status: MarketStatus.ACTIVE };
      mockMarketRepository.findById.mockResolvedValue(activeMarket);

      await expect(
        useCase.execute('market-id', 'admin-id')
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockAuditLogRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is PAUSED', async () => {
      const pausedMarket = { ...mockDraftMarket, status: MarketStatus.PAUSED };
      mockMarketRepository.findById.mockResolvedValue(pausedMarket);

      await expect(
        useCase.execute('market-id', 'admin-id')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if market is RESOLVED', async () => {
      const resolvedMarket = { ...mockDraftMarket, status: MarketStatus.RESOLVED };
      mockMarketRepository.findById.mockResolvedValue(resolvedMarket);

      await expect(
        useCase.execute('market-id', 'admin-id')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if market is CANCELLED', async () => {
      const cancelledMarket = { ...mockDraftMarket, status: MarketStatus.CANCELLED };
      mockMarketRepository.findById.mockResolvedValue(cancelledMarket);

      await expect(
        useCase.execute('market-id', 'admin-id')
      ).rejects.toThrow(ValidationError);
    });
  });
});
