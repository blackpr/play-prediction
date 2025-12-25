import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateMarketUseCase } from '../../../../src/application/use-cases/admin/create-market.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus, CloseBehavior } from '../../../../src/infrastructure/database/drizzle/schema';

describe('CreateMarketUseCase', () => {
  let useCase: CreateMarketUseCase;
  let mockUserRepository: any;
  let mockMarketRepository: any;
  let mockPortfolioRepository: any;
  let mockTradeLedgerRepository: any;
  let mockAuditLogRepository: any;
  let mockCategoryRepository: any;
  let mockTransactionManager: any;

  const mockTreasuryUser = {
    id: 'treasury-user-id',
    email: 'treasury@example.com',
    role: 'treasury',
    balance: 1000000000000n,
    isActive: true,
    createdAt: new Date(),
  };

  const mockCategory = {
    id: 'cat-123',
    name: 'Weather',
    slug: 'weather',
    defaultCloseBehavior: CloseBehavior.AUTO,
    defaultBufferMinutes: null,
    isActive: true,
  };

  const mockMarket = {
    id: 'market-id',
    title: 'Test Market',
    description: 'Test Description',
    status: MarketStatus.DRAFT,
    closeBehavior: CloseBehavior.AUTO,
    bufferMinutes: null,
    category: 'Weather',
    imageUrl: null,
    closesAt: new Date('2030-12-25T00:00:00Z'),
    resolvedAt: null,
    eventEndedAt: null,
    resolution: null,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepository = {
      findByRole: vi.fn(),
    };

    mockMarketRepository = {
      create: vi.fn(),
      createPool: vi.fn(),
    };

    mockPortfolioRepository = {
      create: vi.fn(),
    };

    mockTradeLedgerRepository = {
      create: vi.fn(),
    };

    mockAuditLogRepository = {
      create: vi.fn(),
    };

    mockCategoryRepository = {
      findById: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})),
    };

    mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
    mockCategoryRepository.findById.mockResolvedValue(mockCategory);
    mockMarketRepository.create.mockResolvedValue(mockMarket);

    useCase = new CreateMarketUseCase({
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
    it('should create market with 50/50 genesis pool', async () => {
      const result = await useCase.execute({
        title: 'Test Market',
        description: 'Test Description',
        categoryId: 'cat-123',
        closesAt: new Date('2030-12-25T00:00:00Z'),
        seedLiquidity: 10_000_000n,
        createdBy: 'admin-id',
      });

      expect(result.marketId).toBe('market-id');
      expect(result.status).toBe('DRAFT');
      expect(result.pool.yesQty).toBe('10000000');
      expect(result.pool.noQty).toBe('10000000');
      expect(result.pool.k).toBe('100000000000000');
    });

    it('should throw error if treasury user not found', async () => {
      mockUserRepository.findByRole.mockResolvedValue(null);

      await expect(
        useCase.execute({
          title: 'Test Market',
          description: 'Test Description',
          categoryId: 'cat-123',
          closesAt: new Date('2030-12-25T00:00:00Z'),
          seedLiquidity: 10_000_000n,
          createdBy: 'admin-id',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should validate minimum seed liquidity', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);

      await expect(
        useCase.execute({
          title: 'Test Market',
          description: 'Test Description',
          categoryId: 'cat-123',
          closesAt: new Date('2030-12-25T00:00:00Z'),
          seedLiquidity: 500_000n, // Less than 1M minimum
          createdBy: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should apply category defaults for close behavior - Weather (auto)', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockMarketRepository.create.mockResolvedValue({
        ...mockMarket,
        closeBehavior: CloseBehavior.AUTO,
        bufferMinutes: null,
      });

      const result = await useCase.execute({
        title: 'Weather Market',
        description: 'Test',
        categoryId: 'cat-123',
        closesAt: new Date('2030-12-25T00:00:00Z'),
        seedLiquidity: 10_000_000n,
        createdBy: 'admin-id',
      });

      expect(result.closeBehavior).toBe('auto');
      expect(result.bufferMinutes).toBeNull();
    });

    it('should apply category defaults for close behavior - Soccer (manual)', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue({
        ...mockCategory,
        name: 'Sports - Soccer',
        defaultCloseBehavior: CloseBehavior.MANUAL,
      });
      mockMarketRepository.create.mockResolvedValue({
        ...mockMarket,
        closeBehavior: CloseBehavior.MANUAL,
        bufferMinutes: null,
      });

      const result = await useCase.execute({
        title: 'Soccer Match',
        description: 'Test',
        categoryId: 'cat-soccer',
        closesAt: new Date('2030-12-25T00:00:00Z'),
        seedLiquidity: 10_000_000n,
        createdBy: 'admin-id',
      });

      expect(result.closeBehavior).toBe('manual');
      expect(result.bufferMinutes).toBeNull();
    });

    it('should apply category defaults for close behavior - Basketball (auto_with_buffer)', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue({
        ...mockCategory,
        name: 'Sports - Basketball',
        defaultCloseBehavior: CloseBehavior.AUTO_WITH_BUFFER,
        defaultBufferMinutes: 30,
      });
      mockMarketRepository.create.mockResolvedValue({
        ...mockMarket,
        closeBehavior: CloseBehavior.AUTO_WITH_BUFFER,
        bufferMinutes: 30,
      });

      const result = await useCase.execute({
        title: 'Basketball Game',
        description: 'Test',
        categoryId: 'cat-basketball',
        closesAt: new Date('2030-12-25T00:00:00Z'),
        seedLiquidity: 10_000_000n,
        createdBy: 'admin-id',
      });

      expect(result.closeBehavior).toBe('auto_with_buffer');
      expect(result.bufferMinutes).toBe(30);
    });

    it('should validate bufferMinutes when closeBehavior is auto_with_buffer', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      await expect(
        useCase.execute({
          title: 'Test Market',
          description: 'Test',
          categoryId: 'cat-123',
          closesAt: new Date('2030-12-25T00:00:00Z'),
          seedLiquidity: 10_000_000n,
          closeBehavior: 'auto_with_buffer',
          bufferMinutes: 0, // Invalid - must be > 0
          createdBy: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject bufferMinutes when closeBehavior is not auto_with_buffer', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      await expect(
        useCase.execute({
          title: 'Test Market',
          description: 'Test',
          categoryId: 'cat-123',
          closesAt: new Date('2030-12-25T00:00:00Z'),
          seedLiquidity: 10_000_000n,
          closeBehavior: 'auto',
          bufferMinutes: 30, // Should not be provided for 'auto'
          createdBy: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should create GENESIS_MINT ledger entry', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockMarketRepository.create.mockResolvedValue(mockMarket);

      await useCase.execute({
        title: 'Test Market',
        description: 'Test',
        categoryId: 'cat-123',
        closesAt: new Date('2030-12-25T00:00:00Z'),
        seedLiquidity: 10_000_000n,
        createdBy: 'admin-id',
      });

      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'treasury-user-id',
          marketId: 'market-id',
          action: 'GENESIS_MINT',
          side: null,
          amountIn: 10_000_000n,
          amountOut: 10_000_000n,
          feePaid: 0n,
          feeVault: 0n,
          feeLp: 0n,
        }),
        {}
      );
    });

  });

  it('should create audit log entry', async () => {
    mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
    mockMarketRepository.create.mockResolvedValue(mockMarket);

    await useCase.execute({
      title: 'Test Market',
      description: 'Test',
      categoryId: 'cat-123',
      closesAt: new Date('2030-12-25T00:00:00Z'),
      seedLiquidity: 10_000_000n,
      createdBy: 'admin-id',
    });

    expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-id',
        action: 'MARKET_CREATED',
        entityType: 'MARKET',
        entityId: 'market-id',
      }),
      expect.anything()
    );
  });

  it('should grant shares to treasury account', async () => {
    mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
    mockMarketRepository.create.mockResolvedValue(mockMarket);

    await useCase.execute({
      title: 'Test Market',
      description: 'Test',
      categoryId: 'cat-123',
      closesAt: new Date('2030-12-25T00:00:00Z'),
      seedLiquidity: 10_000_000n,
      createdBy: 'admin-id',
    });

    expect(mockPortfolioRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'treasury-user-id',
        marketId: 'market-id',
        yesQty: 10_000_000n,
        noQty: 10_000_000n,
        yesCostBasis: 5_000_000n,
        noCostBasis: 5_000_000n,
      }),
      {}
    );
  });

  it('should validate future close date', async () => {
    mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
    mockCategoryRepository.findById.mockResolvedValue(mockCategory);

    const pastDate = new Date('2020-01-01T00:00:00Z');

    await expect(
      useCase.execute({
        title: 'Test Market',
        description: 'Test',
        categoryId: 'cat-123',
        closesAt: pastDate,
        seedLiquidity: 10_000_000n,
        createdBy: 'admin-id',
      })
    ).rejects.toThrow(ValidationError);
  });
  describe('Skewed Genesis', () => {
    it('should create skewed pool with 75% YES probability', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockMarketRepository.create.mockResolvedValue(mockMarket);

      const seedLiquidity = 10_000_000n; // 10M micropoints

      const result = await useCase.execute({
        title: 'Skewed Market',
        description: 'Test',
        categoryId: 'cat-123',
        closesAt: new Date('2030-12-25T00:00:00Z'),
        seedLiquidity,
        initialYesPrice: 0.75,
        createdBy: 'admin-id',
      });

      expect(result.pool.yesQty).toBe('5000000');
      expect(result.pool.noQty).toBe('15000000');

      // Verify treasury portfolio
      expect(mockPortfolioRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          yesQty: 5_000_000n,
          noQty: 15_000_000n,
          // Cost basis split proportional to quantity
          yesCostBasis: 2_500_000n,
          noCostBasis: 7_500_000n,
        }),
        expect.anything()
      );
    });

    it('should create skewed pool with 20% YES probability', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockMarketRepository.create.mockResolvedValue(mockMarket);



      const result = await useCase.execute({
        title: 'Skewed Market',
        description: 'Test',
        categoryId: 'cat-123',
        closesAt: new Date('2030-12-25T00:00:00Z'),
        seedLiquidity: 10_000_000n,
        initialYesPrice: 0.20,
        createdBy: 'admin-id',
      });

      expect(result.pool.yesQty).toBe('16000000');
      expect(result.pool.noQty).toBe('4000000');
    });

    it('should throw validation error for invalid initialYesPrice', async () => {
      mockUserRepository.findByRole.mockResolvedValue(mockTreasuryUser);
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      await expect(
        useCase.execute({
          title: 'Invalid Market',
          description: 'Test',
          categoryId: 'cat-123',
          closesAt: new Date('2030-12-25T00:00:00Z'),
          seedLiquidity: 10_000_000n,
          initialYesPrice: 1.5, // Invalid > 0.99
          createdBy: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({
          title: 'Invalid Market',
          description: 'Test',
          categoryId: 'cat-123',
          closesAt: new Date('2030-12-25T00:00:00Z'),
          seedLiquidity: 10_000_000n,
          initialYesPrice: 0.005, // Invalid < 0.01
          createdBy: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});

