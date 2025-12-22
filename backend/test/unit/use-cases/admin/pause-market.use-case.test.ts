import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PauseMarketUseCase } from '../../../../src/application/use-cases/admin/pause-market.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus } from '../../../../src/infrastructure/database/drizzle/schema';

describe('PauseMarketUseCase', () => {
  let useCase: PauseMarketUseCase;
  let mockMarketRepository: any;

  const mockActiveMarket = {
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
    status: MarketStatus.PAUSED,
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

    useCase = new PauseMarketUseCase({
      marketRepository: mockMarketRepository,
    });
  });

  describe('execute', () => {
    it('should successfully pause an ACTIVE market', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockActiveMarket);
      mockMarketRepository.updateStatus.mockResolvedValue(mockUpdatedMarket);

      const result = await useCase.execute({ marketId: 'market-id' });

      expect(mockMarketRepository.findById).toHaveBeenCalledWith('market-id');
      expect(mockMarketRepository.updateStatus).toHaveBeenCalledWith('market-id', MarketStatus.PAUSED);
      expect(result.id).toBe('market-id');
      expect(result.status).toBe(MarketStatus.PAUSED);
      expect(result.pausedAt).toBeInstanceOf(Date);
      expect(result.reason).toBeUndefined();
    });

    it('should successfully pause an ACTIVE market with reason', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockActiveMarket);
      mockMarketRepository.updateStatus.mockResolvedValue(mockUpdatedMarket);

      const reason = 'Investigating potential manipulation';
      const result = await useCase.execute({ marketId: 'market-id', reason });

      expect(result.reason).toBe(reason);
    });

    it('should throw NotFoundError if market does not exist', async () => {
      mockMarketRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ marketId: 'non-existent-id' })
      ).rejects.toThrow(NotFoundError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is not in ACTIVE status', async () => {
      const draftMarket = { ...mockActiveMarket, status: MarketStatus.DRAFT };
      mockMarketRepository.findById.mockResolvedValue(draftMarket);

      await expect(
        useCase.execute({ marketId: 'market-id' })
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is already PAUSED', async () => {
      const pausedMarket = { ...mockActiveMarket, status: MarketStatus.PAUSED };
      mockMarketRepository.findById.mockResolvedValue(pausedMarket);

      await expect(
        useCase.execute({ marketId: 'market-id' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if market is RESOLVED', async () => {
      const resolvedMarket = { ...mockActiveMarket, status: MarketStatus.RESOLVED };
      mockMarketRepository.findById.mockResolvedValue(resolvedMarket);

      await expect(
        useCase.execute({ marketId: 'market-id' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if market is CANCELLED', async () => {
      const cancelledMarket = { ...mockActiveMarket, status: MarketStatus.CANCELLED };
      mockMarketRepository.findById.mockResolvedValue(cancelledMarket);

      await expect(
        useCase.execute({ marketId: 'market-id' })
      ).rejects.toThrow(ValidationError);
    });
  });
});
