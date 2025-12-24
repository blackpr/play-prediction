import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateMarketUseCase } from '../../../../src/application/use-cases/admin/update-market.use-case';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus, TradeAction } from '../../../../src/infrastructure/database/drizzle/schema';

describe('UpdateMarketUseCase', () => {
  let useCase: UpdateMarketUseCase;
  let mockUserRepository: any;
  let mockMarketRepository: any;
  let mockPortfolioRepository: any;
  let mockTradeLedgerRepository: any;
  let mockAuditLogRepository: any;
  let mockCategoryRepository: any;
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

  const mockTreasury = {
    id: 'treasury-id',
    email: 'treasury@example.com',
    role: 'treasury',
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
      findByRole: vi.fn(),
    };

    mockMarketRepository = {
      findById: vi.fn(),
      update: vi.fn(),
      deletePool: vi.fn(),
      createPool: vi.fn(),
    };

    mockPortfolioRepository = {
      deleteByUserAndMarket: vi.fn(),
      create: vi.fn(),
    };

    mockTradeLedgerRepository = {
      countByMarket: vi.fn(),
      deleteByMarketAndAction: vi.fn(),
      create: vi.fn(),
    };

    mockAuditLogRepository = {
      create: vi.fn(),
    };

    mockCategoryRepository = {
      findById: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})), // Execute callback immediately with mock tx
    };

    mockUserRepository.findById.mockResolvedValue(mockAdmin);
    mockUserRepository.findByRole.mockResolvedValue(mockTreasury);
    mockMarketRepository.findById.mockResolvedValue(mockMarketWithPool);
    mockCategoryRepository.findById.mockResolvedValue({
      id: 'cat-123',
      name: 'Crypto',
      slug: 'crypto',
      defaultCloseBehavior: 'auto',
      defaultBufferMinutes: null,
      isActive: true,
    });

    useCase = new UpdateMarketUseCase({
      userRepository: mockUserRepository,
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      auditLogRepository: mockAuditLogRepository,
      categoryRepository: mockCategoryRepository,
      transactionManager: mockTransactionManager,
    });
  });

  describe('execute', () => {
    it('should successfully update DRAFT market', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool)
        .mockResolvedValueOnce(mockMarketWithPool); // Re-fetch
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
        categoryId: 'cat-123',
      });

      expect(mockMarketRepository.update).toHaveBeenCalledWith(
        'market-id',
        expect.objectContaining({
          title: 'Updated Title',
          description: 'Updated description',
        }),
        {}
      );

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-id',
          action: 'MARKET_UPDATED',
          entityType: 'MARKET',
          entityId: 'market-id',
        }),
        {}
      );

      expect(result.id).toBe('market-id');
      expect(result.pool).toBeDefined();
    });

    it('should reset pool when seedLiquidity is updated', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockUserRepository.findByRole.mockResolvedValue(mockTreasury);

      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool) // First fetch
        .mockResolvedValueOnce(mockMarketWithPool); // Re-fetch after update

      mockTradeLedgerRepository.countByMarket.mockResolvedValue(1); // One GENESIS trade

      mockMarketRepository.update.mockResolvedValue(mockDraftMarket);

      await useCase.execute({
        marketId: 'market-id',
        adminId: 'admin-id',
        seedLiquidity: 20_000_000n, // Changed amount
        categoryId: 'cat-123',
      });

      // Verification of Pool Reset Flow
      expect(mockTradeLedgerRepository.countByMarket).toHaveBeenCalledWith('market-id', {});
      expect(mockMarketRepository.deletePool).toHaveBeenCalledWith('market-id', {});
      expect(mockPortfolioRepository.deleteByUserAndMarket).toHaveBeenCalledWith('treasury-id', 'market-id', {});
      expect(mockTradeLedgerRepository.deleteByMarketAndAction).toHaveBeenCalledWith('market-id', TradeAction.GENESIS_MINT, {});

      // Verification of New Pool Creation
      expect(mockMarketRepository.createPool).toHaveBeenCalledWith(
        expect.objectContaining({ yesQty: 20_000_000n, noQty: 20_000_000n }),
        {}
      );

      // Verify Treasury Portfolio Recreation
      expect(mockPortfolioRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'treasury-id', yesQty: 20_000_000n }),
        {}
      );

      // Verify New Genesis Trade Log
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GENESIS_MINT', amountIn: 20_000_000n }),
        {}
      );
    });

    it('should reset pool when initialYesPrice is updated', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockUserRepository.findByRole.mockResolvedValue(mockTreasury);
      mockMarketRepository.findById
        .mockResolvedValueOnce(mockMarketWithPool)
        .mockResolvedValueOnce(mockMarketWithPool);
      mockTradeLedgerRepository.countByMarket.mockResolvedValue(1);
      mockMarketRepository.update.mockResolvedValue(mockDraftMarket);

      await useCase.execute({
        marketId: 'market-id',
        adminId: 'admin-id',
        initialYesPrice: 0.75, // Change skew
        categoryId: 'cat-123',
      });

      // 0.75 Price -> YesQty should be low, NoQty should be high? 
      // Formula: NoQty = Total * Price. If Price 0.75, NoQty is 75% of Total. YesQty is 25%.
      // Seed Liquidity defaults to (100M+100M)/2 = 100M. Total = 200M.
      // NoQty = 200M * 0.75 = 150M. YesQty = 50M.
      expect(mockMarketRepository.createPool).toHaveBeenCalledWith(
        expect.objectContaining({ yesQty: 50_000_000n, noQty: 150_000_000n }),
        {}
      );
    });

    it('should throw BusinessLogicError if market has existing real trades', async () => {
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockMarketRepository.findById.mockResolvedValue(mockMarketWithPool);

      // Simulate real trades existing (count > 1)
      mockTradeLedgerRepository.countByMarket.mockResolvedValue(5);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          seedLiquidity: 20_000_000n,
          categoryId: 'cat-123',
        })
      ).rejects.toThrow(BusinessLogicError);

      expect(mockMarketRepository.deletePool).not.toHaveBeenCalled();
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

    it('should validate title length (too short)', async () => {
      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          title: 'Short', // Less than 10 characters
          categoryId: 'cat-123',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate title length (too long)', async () => {
      const longTitle = 'a'.repeat(501); // More than 500 characters

      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          title: longTitle,
          categoryId: 'cat-123',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate closesAt is in future', async () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');

      await expect(
        useCase.execute({
          marketId: 'market-id',
          adminId: 'admin-id',
          closesAt: pastDate,
          categoryId: 'cat-123',
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
