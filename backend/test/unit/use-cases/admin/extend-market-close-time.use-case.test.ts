import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtendMarketCloseTimeUseCase } from '../../../../src/application/use-cases/admin/extend-market-close-time.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus } from '../../../../src/infrastructure/database/drizzle/schema';

describe('ExtendMarketCloseTimeUseCase', () => {
  let useCase: ExtendMarketCloseTimeUseCase;
  let mockMarketRepository: any;
  let mockAuditLogRepository: any;

  const currentDate = new Date('2024-12-20T12:00:00Z');
  const futureCloseDate = new Date('2024-12-25T18:00:00Z');
  const extendedCloseDate = new Date('2024-12-26T23:59:59Z');

  const mockActiveMarket = {
    id: 'market-id',
    title: 'Test Market',
    description: 'Test Description',
    status: MarketStatus.ACTIVE,
    closeBehavior: 'auto',
    bufferMinutes: null,
    category: 'Weather',
    categoryId: 'category-id',
    imageUrl: null,
    closesAt: futureCloseDate,
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
    categoryId: 'category-id',
    imageUrl: null,
    closesAt: extendedCloseDate,
    resolvedAt: null,
    eventEndedAt: null,
    resolution: null,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Mock current time
    vi.useFakeTimers();
    vi.setSystemTime(currentDate);

    mockMarketRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockAuditLogRepository = {
      create: vi.fn(),
    };

    useCase = new ExtendMarketCloseTimeUseCase({
      marketRepository: mockMarketRepository,
      auditLogRepository: mockAuditLogRepository,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    it('should successfully extend close time for ACTIVE market', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockActiveMarket);
      mockMarketRepository.update.mockResolvedValue(mockUpdatedMarket);

      const result = await useCase.execute({
        marketId: 'market-id',
        newClosesAt: extendedCloseDate.toISOString(),
        reason: 'Event delayed due to weather',
        adminId: 'admin-id',
      });

      expect(mockMarketRepository.findById).toHaveBeenCalledWith('market-id');
      expect(mockMarketRepository.update).toHaveBeenCalledWith(
        'market-id',
        { closesAt: extendedCloseDate }
      );
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-id',
          action: 'MARKET_CLOSE_TIME_EXTENDED',
          entityType: 'MARKET',
          entityId: 'market-id',
        })
      );

      expect(result.id).toBe('market-id');
      expect(result.title).toBe('Test Market');
      expect(result.oldClosesAt).toEqual(futureCloseDate);
      expect(result.newClosesAt).toEqual(extendedCloseDate);
      expect(result.reason).toBe('Event delayed due to weather');
    });

    it('should include correct details in audit log', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockActiveMarket);
      mockMarketRepository.update.mockResolvedValue(mockUpdatedMarket);

      await useCase.execute({
        marketId: 'market-id',
        newClosesAt: extendedCloseDate.toISOString(),
        reason: 'Event delayed due to weather',
        adminId: 'admin-id',
      });

      const auditLogCall = mockAuditLogRepository.create.mock.calls[0][0];
      const details = JSON.parse(auditLogCall.details);

      expect(details.title).toBe('Test Market');
      expect(details.oldClosesAt).toBe(futureCloseDate.toISOString());
      expect(details.newClosesAt).toBe(extendedCloseDate.toISOString());
      expect(details.reason).toBe('Event delayed due to weather');
    });

    it('should throw NotFoundError if market does not exist', async () => {
      mockMarketRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          marketId: 'non-existent-id',
          newClosesAt: extendedCloseDate.toISOString(),
          reason: 'Should fail',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
      expect(mockAuditLogRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is not ACTIVE (DRAFT)', async () => {
      const draftMarket = { ...mockActiveMarket, status: MarketStatus.DRAFT };
      mockMarketRepository.findById.mockResolvedValue(draftMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          newClosesAt: extendedCloseDate.toISOString(),
          reason: 'Should fail',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
      expect(mockAuditLogRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is not ACTIVE (PAUSED)', async () => {
      const pausedMarket = { ...mockActiveMarket, status: MarketStatus.PAUSED };
      mockMarketRepository.findById.mockResolvedValue(pausedMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          newClosesAt: extendedCloseDate.toISOString(),
          reason: 'Should fail',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if market is not ACTIVE (RESOLVED)', async () => {
      const resolvedMarket = { ...mockActiveMarket, status: MarketStatus.RESOLVED };
      mockMarketRepository.findById.mockResolvedValue(resolvedMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          newClosesAt: extendedCloseDate.toISOString(),
          reason: 'Should fail',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if newClosesAt is in the past', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockActiveMarket);

      const pastDate = new Date('2024-12-15T00:00:00Z');

      await expect(
        useCase.execute({
          marketId: 'market-id',
          newClosesAt: pastDate.toISOString(),
          reason: 'Should fail',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if newClosesAt is before current closesAt', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockActiveMarket);

      // New date is after now but before current closesAt
      const earlierDate = new Date('2024-12-24T00:00:00Z');

      await expect(
        useCase.execute({
          marketId: 'market-id',
          newClosesAt: earlierDate.toISOString(),
          reason: 'Should fail',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market does not have closesAt set', async () => {
      const marketWithoutCloseTime = { ...mockActiveMarket, closesAt: null };
      mockMarketRepository.findById.mockResolvedValue(marketWithoutCloseTime);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          newClosesAt: extendedCloseDate.toISOString(),
          reason: 'Should fail',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
    });
  });
});
