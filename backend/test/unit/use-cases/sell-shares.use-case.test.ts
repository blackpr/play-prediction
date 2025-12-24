import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SellSharesUseCase } from '../../../src/application/use-cases/trading/sell-shares.use-case';
import { BusinessLogicError, NotFoundError } from '../../../src/domain/errors/domain-error';

describe('SellSharesUseCase', () => {
  let useCase: SellSharesUseCase;
  let mockMarketRepository: any;
  let mockPortfolioRepository: any;
  let mockTradeLedgerRepository: any;
  let mockUserRepository: any;
  let mockTransactionManager: any;
  let mockWebSocketManager: any;

  beforeEach(() => {
    // Mock repositories
    mockMarketRepository = {
      findByIdWithPool: vi.fn(),
      updatePoolWithLock: vi.fn(),
      updateUserBalance: vi.fn(),
      getVolume24h: vi.fn().mockResolvedValue('0'),
    };

    mockPortfolioRepository = {
      findByUserAndMarket: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    mockTradeLedgerRepository = {
      findByIdempotencyKey: vi.fn(),
      create: vi.fn(),
    };

    mockUserRepository = {
      findById: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})), // Execute callback immediately
    };

    mockWebSocketManager = {
      broadcast: vi.fn(),
    };

    useCase = new SellSharesUseCase({
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      userRepository: mockUserRepository,
      transactionManager: mockTransactionManager,
      webSocketManager: mockWebSocketManager,
    });
  });

  describe('Validation', () => {
    it('should reject sell with zero shares', async () => {
      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 0n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 0n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow('Shares must be positive');
    });

    it('should reject sell with negative shares', async () => {
      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: -100n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow('Shares must be positive');
    });

    it('should accept valid sell with positive shares', async () => {
      // Setup mocks for successful trade
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
        })
      ).resolves.toBeDefined();
    });
  });

  describe('Idempotency', () => {
    it('should reject duplicate idempotency key', async () => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue({
        id: 'existing-trade',
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
          idempotencyKey: 'duplicate-key',
        })
      ).rejects.toThrow('Duplicate idempotency key');
    });

    it('should allow sell without idempotency key', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n,
        minAmountOut: 1n,
        // No idempotency key
      });

      expect(result).toBeDefined();
      expect(mockTradeLedgerRepository.findByIdempotencyKey).not.toHaveBeenCalled();
    });
  });

  describe('Share Validation', () => {
    it('should reject sell with insufficient shares', async () => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 10_000n, // Less than shares to sell
        noQty: 0n,
        yesCostBasis: 10_000n,
        noCostBasis: 0n,
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow('Insufficient shares');
    });

    it('should reject if user has no portfolio', async () => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow('Insufficient shares');
    });

    it('should allow sell of all shares', async () => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 50_000n,
        noQty: 0n,
        yesCostBasis: 50_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n, // Selling all shares
        minAmountOut: 1n,
      });

      expect(result).toBeDefined();
      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user1',
        'market1',
        expect.objectContaining({
          yesQty: 0n, // All shares sold
          yesCostBasis: 0n, // Cost basis should be 0
        }),
        expect.anything()
      );
    });
  });

  describe('Market Validation', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });
    });

    it('should reject if market not found', async () => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'nonexistent',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject if market is not ACTIVE', async () => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'PAUSED',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow('Market is not active');
    });
  });

  describe('Slippage Protection', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });
    });

    it('should reject if slippage exceeds tolerance', async () => {
      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 999_999n, // Unrealistically high
        })
      ).rejects.toThrow('Slippage exceeded');
    });

    it('should accept if payout meets minimum', async () => {
      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n,
        minAmountOut: 1n, // Very low, will pass
      });

      expect(result).toBeDefined();
      expect(result.amountOut).toBeGreaterThan(0n);
    });
  });

  describe('Optimistic Locking', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });
    });

    it('should reject if optimistic lock fails', async () => {
      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: false, // Lock failed
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow('Pool was modified by another transaction');
    });
  });

  describe('Portfolio Management', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });
    });

    it('should update portfolio with proportional cost basis reduction', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockPortfolioRepository.update.mockResolvedValue({});

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n, // Selling half
        minAmountOut: 1n,
      });

      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user1',
        'market1',
        expect.objectContaining({
          yesQty: 50_000n, // Half remaining
          yesCostBasis: 50_000n, // Half of original cost basis
        }),
        expect.anything()
      );
    });

    it('should handle selling all shares correctly', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 50_000n,
        noQty: 0n,
        yesCostBasis: 50_000n,
        noCostBasis: 0n,
      });

      mockPortfolioRepository.update.mockResolvedValue({});

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n, // Selling all
        minAmountOut: 1n,
      });

      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user1',
        'market1',
        expect.objectContaining({
          yesQty: 0n,
          yesCostBasis: 0n,
        }),
        expect.anything()
      );
    });
  });

  describe('Fee Calculation', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });
    });

    it('should calculate and split fees correctly', async () => {
      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n,
        minAmountOut: 1n,
      });

      // Fee should be 2% of gross payout
      expect(result.feePaid).toBeGreaterThan(0n);
      // 50/50 split (allowing for rounding)
      expect(result.feeVault + result.feeLp).toBe(result.feePaid);
    });
  });

  describe('Balance Update', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });
    });

    it('should credit user balance with net payout', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n,
        minAmountOut: 1n,
      });

      // Balance should increase
      expect(result.newBalance).toBeGreaterThan(1_000_000n);
      expect(result.newBalance).toBe(1_000_000n + result.amountOut);
    });

    it('should reject if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'nonexistent',
          marketId: 'market1',
          side: 'YES',
          shares: 50_000n,
          minAmountOut: 1n,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Trade Ledger', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n,
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: null,
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 1_050_000n,
        newNoQty: 950_000n,
        newVersionId: 2,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });
    });

    it('should log trade to ledger with all details', async () => {
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        shares: 50_000n,
        minAmountOut: 1n,
        idempotencyKey: 'test-key',
      });

      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          marketId: 'market1',
          action: 'SELL',
          side: 'YES',
          amountIn: 50_000n, // Shares sold
          idempotencyKey: 'test-key',
        }),
        expect.anything()
      );
    });
  });
});
