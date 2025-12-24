import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResolveMarketUseCase } from '../../../../src/application/use-cases/admin/resolve-market.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { MarketStatus, Resolution, TradeAction } from '../../../../src/infrastructure/database/drizzle/schema';

describe('ResolveMarketUseCase', () => {
  let useCase: ResolveMarketUseCase;
  let mockMarketRepository: any;
  let mockPortfolioRepository: any;
  let mockUserRepository: any;
  let mockTradeLedgerRepository: any;
  let mockAuditLogRepository: any;
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
    };

    mockPortfolioRepository = {
      findByMarket: vi.fn(),
      findByUserAndMarket: vi.fn(),
      update: vi.fn(),
    };

    mockUserRepository = {
      findById: vi.fn(),
      updateBalance: vi.fn(),
    };

    mockTradeLedgerRepository = {
      findAll: vi.fn(),
      create: vi.fn(),
    };

    mockAuditLogRepository = {
      create: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})), // Execute callback immediately with mock tx
    };

    const mockWebSocketManager = {
      broadcast: vi.fn(),
      sendToUser: vi.fn(),
    };

    useCase = new ResolveMarketUseCase({
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      userRepository: mockUserRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      auditLogRepository: mockAuditLogRepository,
      transactionManager: mockTransactionManager,
      webSocketManager: { broadcast: vi.fn(), sendToUser: vi.fn() } as any,
    });
  });

  describe('execute', () => {
    it('should successfully resolve market with YES outcome and pay winners', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.RESOLVED });
      mockPortfolioRepository.findByMarket.mockResolvedValue(mockPortfolios);
      mockUserRepository.findById.mockImplementation((userId: string) =>
        Promise.resolve(mockUsers[userId as keyof typeof mockUsers])
      );
      mockTradeLedgerRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await useCase.execute({
        marketId: 'market-id',
        resolution: 'YES',
        evidence: 'Team A won',
        adminId: 'admin-id',
      });

      // Verify market was updated
      expect(mockMarketRepository.updateStatus).toHaveBeenCalledWith('market-id', MarketStatus.RESOLVED, {});

      // Verify portfolios were queried
      expect(mockPortfolioRepository.findByMarket).toHaveBeenCalledWith('market-id', {});

      // Verify winners were paid (user-1 has 100 YES shares, user-2 has 200 YES shares)
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith('user-1', 1100n, {}); // 1000 + 100
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith('user-2', 2200n, {}); // 2000 + 200

      // Verify RESOLUTION_PAYOUT was logged for each winner
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: TradeAction.RESOLUTION_PAYOUT,
          side: 'YES',
          amountIn: 100n,
          amountOut: 100n,
        }),
        {}
      );

      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          action: TradeAction.RESOLUTION_PAYOUT,
          side: 'YES',
          amountIn: 200n,
          amountOut: 200n,
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

      // Verify audit log creation
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-id',
          action: 'MARKET_RESOLVED',
          entityType: 'MARKET',
          entityId: 'market-id',
        }),
        {}
      );

      // Verify result
      expect(result.id).toBe('market-id');
      expect(result.resolution).toBe('YES');
      expect(result.totalWinners).toBe(2);
      expect(result.totalPayout).toBe('300'); // 100 + 200
      expect(result.voidedTrades.count).toBe(0);
    });

    it('should successfully resolve market with NO outcome and pay winners', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.RESOLVED });
      mockPortfolioRepository.findByMarket.mockResolvedValue(mockPortfolios);
      mockUserRepository.findById.mockImplementation((userId: string) =>
        Promise.resolve(mockUsers[userId as keyof typeof mockUsers])
      );
      mockTradeLedgerRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await useCase.execute({
        marketId: 'market-id',
        resolution: 'NO',
        evidence: 'Team B won',
        adminId: 'admin-id',
      });

      // Verify winners were paid (user-1 has 50 NO shares, user-2 has 0 NO shares)
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith('user-1', 1050n, {}); // 1000 + 50
      expect(mockUserRepository.updateBalance).toHaveBeenCalledTimes(1); // Only user-1 wins

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MARKET_RESOLVED',
          details: expect.stringContaining('"resolution":"NO"'),
        }),
        {}
      );

      // Verify result
      expect(result.resolution).toBe('NO');
      expect(result.totalWinners).toBe(1);
      expect(result.totalPayout).toBe('50');
    });

    it('should void post-event trades and refund users', async () => {
      const eventEndedAt = new Date('2025-12-25T15:00:00Z');
      const postEventTrade = {
        id: 'trade-1',
        userId: 'user-1',
        marketId: 'market-id',
        action: TradeAction.BUY,
        side: 'YES',
        amountIn: 50n,
        amountOut: 45n, // Shares received
        sharesBefore: 100n,
        sharesAfter: 145n,
        feePaid: 1n,
        feeVault: 0n,
        feeLp: 1n,
        poolYesBefore: null,
        poolNoBefore: null,
        poolYesAfter: null,
        poolNoAfter: null,
        priceAtExecution: null,
        idempotencyKey: null,
        createdAt: new Date('2025-12-25T15:30:00Z'), // After event ended
      };

      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.RESOLVED });
      mockPortfolioRepository.findByMarket.mockResolvedValue(mockPortfolios);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(mockPortfolios[0]);
      mockUserRepository.findById.mockImplementation((userId: string) =>
        Promise.resolve(mockUsers[userId as keyof typeof mockUsers])
      );
      mockTradeLedgerRepository.findAll.mockResolvedValue({
        items: [postEventTrade],
        total: 1,
      });

      const result = await useCase.execute({
        marketId: 'market-id',
        resolution: 'YES',
        eventEndedAt,
        adminId: 'admin-id',
      });

      // Verify post-event trade was voided
      expect(result.voidedTrades.count).toBe(1);
      expect(result.voidedTrades.totalRefunded).toBe('50'); // amountIn refunded
      expect(result.voidedTrades.affectedUsers).toBe(1);

      // Verify portfolio was updated to remove voided shares
      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user-1',
        'market-id',
        {
          yesQty: 55n, // 100 - 45 (shares removed)
          yesCostBasis: 10n, // 60 - 50 (cost basis removed)
        },
        {}
      );

      // Verify user was refunded
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith('user-1', 1050n, {}); // 1000 + 50 refund

      // Verify VOID action was logged
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: TradeAction.VOID,
          side: 'YES',
          amountIn: 45n, // Reverse: what they got (shares)
          amountOut: 50n, // Reverse: what they paid (refund)
          originalTradeId: 'trade-1',
          voidReason: 'VOIDED_POST_EVENT',
        }),
        {}
      );

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.stringContaining('"voidedTrades":1'),
        }),
        {}
      );
    });

    it('should throw NotFoundError if market does not exist', async () => {
      mockMarketRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          marketId: 'non-existent-id',
          resolution: 'YES',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is not in ACTIVE or PAUSED status', async () => {
      const draftMarket = { ...mockMarket, status: MarketStatus.DRAFT };
      mockMarketRepository.findById.mockResolvedValue(draftMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          resolution: 'YES',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockMarketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if market is already RESOLVED', async () => {
      const resolvedMarket = { ...mockMarket, status: MarketStatus.RESOLVED, resolution: Resolution.YES };
      mockMarketRepository.findById.mockResolvedValue(resolvedMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          resolution: 'YES',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid resolution value', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockMarket);

      await expect(
        useCase.execute({
          marketId: 'market-id',
          resolution: 'INVALID' as any,
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle market with no holders', async () => {
      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.RESOLVED });
      mockPortfolioRepository.findByMarket.mockResolvedValue([]);
      mockTradeLedgerRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await useCase.execute({
        marketId: 'market-id',
        resolution: 'YES',
        adminId: 'admin-id',
      });

      expect(result.totalWinners).toBe(0);
      expect(result.totalPayout).toBe('0');
      expect(mockUserRepository.updateBalance).not.toHaveBeenCalled();
      expect(mockTradeLedgerRepository.create).not.toHaveBeenCalled();
    });

    it('should only pay holders with winning shares', async () => {
      const portfoliosWithNoWinners = [
        {
          userId: 'user-1',
          marketId: 'market-id',
          yesQty: 0n, // No YES shares
          noQty: 100n,
          yesCostBasis: 0n,
          noCostBasis: 80n,
          updatedAt: new Date(),
        },
      ];

      mockMarketRepository.findById.mockResolvedValue(mockMarket);
      mockMarketRepository.updateStatus.mockResolvedValue({ ...mockMarket, status: MarketStatus.RESOLVED });
      mockPortfolioRepository.findByMarket.mockResolvedValue(portfoliosWithNoWinners);
      mockTradeLedgerRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await useCase.execute({
        marketId: 'market-id',
        resolution: 'YES', // Resolving YES, but user only has NO shares
        adminId: 'admin-id',
      });

      expect(result.totalWinners).toBe(0);
      expect(result.totalPayout).toBe('0');
      expect(mockUserRepository.updateBalance).not.toHaveBeenCalled();
    });
  });
});
