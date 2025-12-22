import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResumeMarketUseCase } from '../../../../src/application/use-cases/admin/resume-market.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus } from '../../../../src/infrastructure/database/drizzle/schema';

describe('ResumeMarketUseCase', () => {
  let useCase: ResumeMarketUseCase;
  let mockMarketRepository: any;

  const mockPausedMarket = {
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

    useCase = new ResumeMarketUseCase({
      marketRepository: mockMarketRepository,
    });
  });

  describe('execute', () => {
    it('should successfully resume a PAUSED market', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockPausedMarket);
      mockMarketRepository.updateStatus.mockResolvedValue(mockUpdatedMarket);

      const result = await useCase.execute('market-id');

      expect(mockMarketRepository.findById).toHaveBeenCalledWith('market-id');
      expect(mockMarketRepository.updateStatus).toHaveBeenCalledWith('market-id', MarketStatus.ACTIVE);
      expect(result.id).toBe('market-id');
      expect(result.status).toBe(MarketStatus.ACTIVE);
      expect(result.resumedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError if market does not exist', async () => {
      mockMarketRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('non-existent-id')
      ).rejects.toThrow(NotFoundError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is not in PAUSED status', async () => {
      const draftMarket = { ...mockPausedMarket, status: MarketStatus.DRAFT };
      mockMarketRepository.findById.mockResolvedValue(draftMarket);

      await expect(
        useCase.execute('market-id')
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is ACTIVE', async () => {
      const activeMarket = { ...mockPausedMarket, status: MarketStatus.ACTIVE };
      mockMarketRepository.findById.mockResolvedValue(activeMarket);

      await expect(
        useCase.execute('market-id')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if market is RESOLVED', async () => {
      const resolvedMarket = { ...mockPausedMarket, status: MarketStatus.RESOLVED };
      mockMarketRepository.findById.mockResolvedValue(resolvedMarket);

      await expect(
        useCase.execute('market-id')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if market is CANCELLED', async () => {
      const cancelledMarket = { ...mockPausedMarket, status: MarketStatus.CANCELLED };
      mockMarketRepository.findById.mockResolvedValue(cancelledMarket);

      await expect(
        useCase.execute('market-id')
      ).rejects.toThrow(ValidationError);
    });
  });
});
