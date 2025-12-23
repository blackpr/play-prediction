import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CancelMarketUseCase } from '../../../../src/application/use-cases/admin/cancel-market.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus, Resolution, TradeAction } from '../../../../src/infrastructure/database/drizzle/schema';

describe('CancelMarketUseCase', () => {
  let useCase: CancelMarketUseCase;
  let mockMarketRepository: any;
  let mockPortfolioRepository: any;
  let mockUserRepository: any;
  let mockTradeLedgerRepository: any;
  let mockTransactionManager: any;

  const mockMarket = {
    id: 'market-id',
    title: 'Test Market',
    description: 'Test Description',
    status: MarketStatus.PAUSED,
    closeBehavior: 'manual',
    bufferMinutes: null,
    category: 'Sports',
    imageUrl: null,
    closesAt: new Date('2025-12-25T00:00:00Z'),
    resolvedAt: null,
    eventEndedAt: null,
    resolution: null,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPortfolios = [
    {
      userId: 'user-1',
      marketId: 'market-id',
      yesQty: 100n,
      noQty: 50n,
      yesCostBasis: 60n,
      noCostBasis: 40n,
      updatedAt: new Date(),
    },
    {
      userId: 'user-2',
      marketId: 'market-id',
      yesQty: 200n,
      noQty: 0n,
      yesCostBasis: 150n,
      noCostBasis: 0n,
      updatedAt: new Date(),
    },
  ];

  const mockUsers = {
    'user-1': {
      id: 'user-1',
      email: 'user1@example.com',
      role: 'user',
      balance: 1000n,
      isActive: true,
      createdAt: new Date(),
    },
    'user-2': {
      id: 'user-2',
      email: 'user2@example.com',
      role: 'user',
      balance: 2000n,
      isActive: true,
      createdAt: new Date(),
    },
  };

  beforeEach(() => {
    mockMarketRepository = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
      findByIdWithPool: vi.fn(),
    };

    mockPortfolioRepository = {
      findByMarket: vi.fn(),
      update: vi.fn(),
    };

    mockUserRepository = {
      findById: vi.fn(),
      updateBalance: vi.fn(),
    };

    mockTradeLedgerRepository = {
      create: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})), // Execute callback immediately with mock tx
    };

    useCase = new CancelMarketUseCase({
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      userRepository: mockUserRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      transactionManager: mockTransactionManager,
    });
  });

  describe('execute', () => {
    it('should successfully cancel market and refund all holders their cost basis', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.CANCELLED });
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market-id',
        title: 'Test Market',
        status: MarketStatus.PAUSED,
        closesAt: new Date('2025-12-25T00:00:00Z'),
        pool: {
          yesQty: 5000n,
          noQty: 5000n,
          versionId: 1,
        },
      });
      mockPortfolioRepository.findByMarket.mockResolvedValue(mockPortfolios);
      mockUserRepository.findById.mockImplementation((userId: string) =>
        Promise.resolve(mockUsers[userId as keyof typeof mockUsers])
      );

      const result = await useCase.execute({
        marketId: 'market-id',
        reason: 'Event was cancelled',
      });

      // Verify market was updated to CANCELLED
      expect(mockMarketRepository.updateStatus).toHaveBeenCalledWith('market-id', MarketStatus.CANCELLED, {});

      // Verify portfolios were queried
      expect(mockPortfolioRepository.findByMarket).toHaveBeenCalledWith('market-id', {});

      // Verify users were refunded their cost basis
      // user-1: yesCostBasis (60) + noCostBasis (40) = 100
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith('user-1', 1100n, {}); // 1000 + 100

      // user-2: yesCostBasis (150) + noCostBasis (0) = 150
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith('user-2', 2150n, {}); // 2000 + 150

      // Verify REFUND was logged for each holder
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: TradeAction.REFUND,
          amountIn: 150n, // Total shares: 100 + 50
          amountOut: 100n, // Cost basis: 60 + 40
        }),
        {}
      );

      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          action: TradeAction.REFUND,
          amountIn: 200n, // Total shares: 200 + 0
          amountOut: 150n, // Cost basis: 150 + 0
        }),
        {}
      );

      // Verify portfolios were cleared
      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user-1',
        'market-id',
        {
          yesQty: 0n,
          noQty: 0n,
          yesCostBasis: 0n,
          noCostBasis: 0n,
        },
        {}
      );

      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user-2',
        'market-id',
        {
          yesQty: 0n,
          noQty: 0n,
          yesCostBasis: 0n,
          noCostBasis: 0n,
        },
        {}
      );

      // Verify result
      expect(result.id).toBe('market-id');
      expect(result.status).toBe(MarketStatus.CANCELLED);
      expect(result.resolution).toBe(Resolution.CANCELLED);
      expect(result.totalHolders).toBe(2);
      expect(result.totalRefunded).toBe('250'); // 100 + 150
      // Pool value (10000) - total refunded (250) = surplus (9750)
      expect(result.surplus).toBe('9750');
    });

    it('should throw NotFoundError if market does not exist', async () => {
      mockMarketRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          marketId: 'non-existent-id',
          reason: 'Event was cancelled',
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is already RESOLVED', async () => {
      const resolvedMarket = { ...mockMarket, status: MarketStatus.RESOLVED, resolution: Resolution.YES };
      mockMarketRepository.findById.mockResolvedValue(resolvedMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          reason: 'Event was cancelled',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle market with no holders (edge case)', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.CANCELLED });
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market-id',
        title: 'Test Market',
        status: MarketStatus.PAUSED,
        closesAt: new Date('2025-12-25T00:00:00Z'),
        pool: { yesQty: 1000n, noQty: 1000n, versionId: 1 },
      });
      mockPortfolioRepository.findByMarket.mockResolvedValue([]);

      const result = await useCase.execute({
        marketId: 'market-id',
        reason: 'Event was cancelled',
      });

      expect(result.totalHolders).toBe(0);
      expect(result.totalRefunded).toBe('0');
      expect(mockUserRepository.updateBalance).not.toHaveBeenCalled();
      expect(mockTradeLedgerRepository.create).not.toHaveBeenCalled();
    });

    it('should handle holders with zero cost basis (edge case)', async () => {
      const portfoliosWithZeroCost = [
        {
          userId: 'user-1',
          marketId: 'market-id',
          yesQty: 100n,
          noQty: 50n,
          yesCostBasis: 0n, // Zero cost basis
          noCostBasis: 0n,
          updatedAt: new Date(),
        },
      ];

      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.CANCELLED });
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market-id',
        title: 'Test Market',
        status: MarketStatus.PAUSED,
        closesAt: new Date('2025-12-25T00:00:00Z'),
        pool: { yesQty: 1000n, noQty: 1000n, versionId: 1 },
      });
      mockPortfolioRepository.findByMarket.mockResolvedValue(portfoliosWithZeroCost);

      const result = await useCase.execute({
        marketId: 'market-id',
        reason: 'Event was cancelled',
      });

      // No refund should be processed for zero cost basis
      expect(result.totalHolders).toBe(0);
      expect(result.totalRefunded).toBe('0');
      expect(mockUserRepository.updateBalance).not.toHaveBeenCalled();
      expect(mockTradeLedgerRepository.create).not.toHaveBeenCalled();

      // But portfolio should still be cleared
      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user-1',
        'market-id',
        {
          yesQty: 0n,
          noQty: 0n,
          yesCostBasis: 0n,
          noCostBasis: 0n,
        },
        {}
      );
    });

    it('should allow cancelling ACTIVE markets', async () => {
      const activeMarket = { ...mockMarket, status: MarketStatus.ACTIVE };
      mockMarketRepository.findById.mockResolvedValue(activeMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...activeMarket, status: MarketStatus.CANCELLED });
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market-id',
        title: 'Test Market',
        status: MarketStatus.ACTIVE,
        closesAt: new Date('2025-12-25T00:00:00Z'),
        pool: { yesQty: 1000n, noQty: 1000n, versionId: 1 },
      });
      mockPortfolioRepository.findByMarket.mockResolvedValue([]);

      const result = await useCase.execute({
        marketId: 'market-id',
        reason: 'Event was cancelled',
      });

      expect(result.status).toBe(MarketStatus.CANCELLED);
      expect(mockMarketRepository.updateStatus).toHaveBeenCalledWith('market-id', MarketStatus.CANCELLED, {});
    });

    it('should allow cancelling DRAFT markets', async () => {
      const draftMarket = { ...mockMarket, status: MarketStatus.DRAFT };
      mockMarketRepository.findById.mockResolvedValue(draftMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...draftMarket, status: MarketStatus.CANCELLED });
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market-id',
        title: 'Test Market',
        status: MarketStatus.DRAFT,
        closesAt: new Date('2025-12-25T00:00:00Z'),
        pool: { yesQty: 1000n, noQty: 1000n, versionId: 1 },
      });
      mockPortfolioRepository.findByMarket.mockResolvedValue([]);

      const result = await useCase.execute({
        marketId: 'market-id',
        reason: 'Event was cancelled',
      });

      expect(result.status).toBe(MarketStatus.CANCELLED);
      expect(mockMarketRepository.updateStatus).toHaveBeenCalledWith('market-id', MarketStatus.CANCELLED, {});
    });

    it('should calculate correct refund amounts for mixed portfolios', async () => {
      const mixedPortfolios = [
        {
          userId: 'user-1',
          marketId: 'market-id',
          yesQty: 500n,
          noQty: 300n,
          yesCostBasis: 400n,
          noCostBasis: 250n,
          updatedAt: new Date(),
        },
      ];

      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.CANCELLED });
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market-id',
        title: 'Test Market',
        status: MarketStatus.PAUSED,
        closesAt: new Date('2025-12-25T00:00:00Z'),
        pool: { yesQty: 5000n, noQty: 5000n, versionId: 1 },
      });
      mockPortfolioRepository.findByMarket.mockResolvedValue(mixedPortfolios);
      mockUserRepository.findById.mockResolvedValue(mockUsers['user-1']);

      const result = await useCase.execute({
        marketId: 'market-id',
        reason: 'Event was cancelled',
      });

      // Total refund should be yesCostBasis + noCostBasis = 400 + 250 = 650
      expect(result.totalRefunded).toBe('650');
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith('user-1', 1650n, {}); // 1000 + 650
    });

    it('should throw NotFoundError if user does not exist during refund', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.CANCELLED });
      mockPortfolioRepository.findByMarket.mockResolvedValue(mockPortfolios);
      mockUserRepository.findById.mockResolvedValue(null); // User not found

      await expect(
        useCase.execute({
          marketId: 'market-id',
          reason: 'Event was cancelled',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
