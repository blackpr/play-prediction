import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateMarketUseCase } from '../../../../src/application/use-cases/admin/update-market.use-case';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus } from '../../../../src/infrastructure/database/drizzle/schema';

describe('UpdateMarketUseCase', () => {
  let useCase: UpdateMarketUseCase;
  let mockUserRepository: any;
  let mockMarketRepository: any;
  let mockTransactionManager: any;

  const mockAdmin = {
    id: 'admin-id',
    email: 'admin@example.com',
    role: 'admin',
    balance: 50000000n,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDraftMarket = {
    id: 'market-id',
    title: 'Original Title',
    description: 'Original description',
    category: 'Crypto',
    imageUrl: 'https://example.com/image.jpg',
    status: MarketStatus.DRAFT,
    closesAt: new Date('2025-12-31T23:59:59Z'),
    closeBehavior: 'auto',
    bufferMinutes: null,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    resolution: null,
    resolvedAt: null,
    eventEndedAt: null,
  };

  const mockMarketWithPool = {
    ...mockDraftMarket,
    pool: {
      id: 'market-id',
      yesQty: '100000000',
      noQty: '100000000',
      k: '10000000000000000',
      versionId: 1,
      updatedAt: new Date(),
    },
    volume24h: '0',
    yesPrice: '0.500000',
    noPrice: '0.500000',
    stats: {
      totalVolume: '0',
      volume24h: '0',
      tradeCount: 0,
      uniqueTraders: 0,
    },
    creator: {
      email: 'admin@example.com',
      displayName: null,
      role: 'admin',
    },
  };

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
    };

    mockMarketRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})), // Execute callback immediately with mock tx
    };

    useCase = new UpdateMarketUseCase({
      userRepository: mockUserRepository,
      marketRepository: mockMarketRepository,
      transactionManager: mockTransactionManager,
    });
  });

  describe('execute', () => {
    it('should successfully update DRAFT market', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool); // Only one call now
      mockMarketRepository.update.mockResolvedValue({
        ...mockDraftMarket,
        title: 'Updated Title',
        description: 'Updated description',
        updatedAt: new Date(),
      });

      const result = await useCase.execute({
        marketId: 'market-id',
        adminId: 'admin-id',
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(mockMarketRepository.update).toHaveBeenCalledWith(
        'market-id',
        {
          title: 'Updated Title',
          description: 'Updated description',
        },
        {}
      );

      expect(result.id).toBe('market-id');
      expect(result.pool).toBeDefined();
    });

    it('should return updated market with pool details', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool);
      mockMarketRepository.update.mockResolvedValue({
        ...mockDraftMarket,
        title: 'New Title That Is Long Enough'
      });

      const result = await useCase.execute({
        marketId: 'market-id',
        adminId: 'admin-id',
        title: 'New Title That Is Long Enough',
      });

      expect(result).toMatchObject({
        id: 'market-id',
        title: 'New Title That Is Long Enough',
        description: mockMarketWithPool.description,
        category: mockMarketWithPool.category,
        imageUrl: mockMarketWithPool.imageUrl,
        status: mockMarketWithPool.status,
        closesAt: mockMarketWithPool.closesAt,
        closeBehavior: mockMarketWithPool.closeBehavior,
        bufferMinutes: mockMarketWithPool.bufferMinutes,
        pool: {
          yesQty: mockMarketWithPool.pool.yesQty,
          noQty: mockMarketWithPool.pool.noQty,
          k: mockMarketWithPool.pool.k,
        },
      });
    });

    it('should throw NotFoundError for non-existent market', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          marketId: 'non-existent-id',
          adminId: 'admin-id',
          title: 'New Title That Is Long Enough',
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BusinessLogicError for non-DRAFT market (ACTIVE)', async () => {
      const activeMarket = {
        ...mockMarketWithPool,
        status: MarketStatus.ACTIVE,
      };

      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById.mockResolvedValue(activeMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          title: 'New Title That Is Long Enough',
        })
      ).rejects.toThrow(BusinessLogicError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BusinessLogicError for non-DRAFT market (RESOLVED)', async () => {
      const resolvedMarket = {
        ...mockMarketWithPool,
        status: MarketStatus.RESOLVED,
      };

      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById.mockResolvedValue(resolvedMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          title: 'New Title That Is Long Enough',
        })
      ).rejects.toThrow(BusinessLogicError);

      expect(mockMarketRepository.update).not.toHaveBeenCalled();
    });

    it('should validate title length (too short)', async () => {
      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          title: 'Short', // Less than 10 characters
        })
      ).rejects.toThrow(ValidationError);

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockMarketRepository.findById).not.toHaveBeenCalled();
    });

    it('should validate title length (too long)', async () => {
      const longTitle = 'a'.repeat(501); // More than 500 characters

      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          title: longTitle,
        })
      ).rejects.toThrow(ValidationError);

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockMarketRepository.findById).not.toHaveBeenCalled();
    });

    it('should validate closesAt is in future', async () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');

      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          closesAt: pastDate,
        })
      ).rejects.toThrow(ValidationError);

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockMarketRepository.findById).not.toHaveBeenCalled();
    });

    it('should allow partial updates (only title)', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool);
      mockMarketRepository.update.mockResolvedValue(mockDraftMarket);

      await useCase.execute({
        marketId: 'market-id',
        adminId: 'admin-id',
        title: 'Only Title Updated',
      });

      expect(mockMarketRepository.update).toHaveBeenCalledWith(
        'market-id',
        {
          title: 'Only Title Updated',
        },
        {}
      );
    });

    it('should handle all editable fields together', async () => {
      const futureDate = new Date('2026-12-31T23:59:59Z');

      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool);
      mockMarketRepository.update.mockResolvedValue(mockDraftMarket);

      await useCase.execute({
        marketId: 'market-id',
        adminId: 'admin-id',
        title: 'Completely Updated Title',
        description: 'Completely updated description',
        category: 'Politics',
        imageUrl: 'https://newurl.com/image.jpg',
        closesAt: futureDate,
      });

      expect(mockMarketRepository.update).toHaveBeenCalledWith(
        'market-id',
        {
          title: 'Completely Updated Title',
          description: 'Completely updated description',
          category: 'Politics',
          imageUrl: 'https://newurl.com/image.jpg',
          closesAt: futureDate,
        },
        {}
      );
    });

    it('should validate imageUrl format', async () => {
      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          imageUrl: 'not-a-valid-url',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should use transaction for atomicity', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool);
      mockMarketRepository.update.mockResolvedValue(mockDraftMarket);

      await useCase.execute({
        marketId: 'market-id',
        adminId: 'admin-id',
        title: 'Updated Title',
      });

      expect(mockTransactionManager.run).toHaveBeenCalled();
      expect(mockMarketRepository.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {} // Mock transaction object
      );
    });
  });
});
