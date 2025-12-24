import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuySharesUseCase } from '../../../src/application/use-cases/trading/buy-shares.use-case';
import { BusinessLogicError, NotFoundError } from '../../../src/domain/errors/domain-error';
import { MIN_TRADE_SIZE } from '../../../src/domain/services/constants';

describe('BuySharesUseCase', () => {
  let useCase: BuySharesUseCase;
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

    useCase = new BuySharesUseCase({
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      userRepository: mockUserRepository,
      transactionManager: mockTransactionManager,
      webSocketManager: mockWebSocketManager,
    });
  });

  describe('Validation', () => {
    it('should reject trade below minimum size', async () => {
      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          amount: 500n, // Below MIN_TRADE_SIZE (1000)
          minSharesOut: 1n,
        })
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          amount: 500n,
          minSharesOut: 1n,
        })
      ).rejects.toThrow('Trade amount must be at least');
    });

    it('should accept trade at minimum size', async () => {
      // Setup mocks for successful trade
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: new Date(Date.now() + 86400000), // Tomorrow
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 999_000n,
        newNoQty: 1_001_000n,
        newVersionId: 2,
      });

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);
      mockPortfolioRepository.create.mockResolvedValue({});
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          amount: MIN_TRADE_SIZE,
          minSharesOut: 1n,
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
          amount: 100_000n,
          minSharesOut: 1n,
          idempotencyKey: 'duplicate-key',
        })
      ).rejects.toThrow('Duplicate idempotency key');
    });

    it('should allow trade without idempotency key', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
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
        newYesQty: 900_000n,
        newNoQty: 1_100_000n,
        newVersionId: 2,
      });

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);
      mockPortfolioRepository.create.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n,
        // No idempotency key
      });

      expect(result).toBeDefined();
      expect(mockTradeLedgerRepository.findByIdempotencyKey).not.toHaveBeenCalled();
    });
  });

  describe('Balance Validation', () => {
    it('should reject trade with insufficient balance', async () => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 50_000n, // Less than trade amount
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          side: 'YES',
          amount: 100_000n,
          minSharesOut: 1n,
        })
      ).rejects.toThrow('Insufficient balance');
    });

    it('should reject if user not found', async () => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'nonexistent',
          marketId: 'market1',
          side: 'YES',
          amount: 100_000n,
          minSharesOut: 1n,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Market Validation', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
      });
    });

    it('should reject if market not found', async () => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'nonexistent',
          side: 'YES',
          amount: 100_000n,
          minSharesOut: 1n,
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
          amount: 100_000n,
          minSharesOut: 1n,
        })
      ).rejects.toThrow('Market is not active');
    });

    it('should reject if market is closed', async () => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        closesAt: new Date(Date.now() - 86400000), // Yesterday
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
          amount: 100_000n,
          minSharesOut: 1n,
        })
      ).rejects.toThrow('Market has closed for trading');
    });
  });

  describe('Slippage Protection', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
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
          amount: 100_000n,
          minSharesOut: 999_999n, // Unrealistically high
        })
      ).rejects.toThrow('Slippage exceeded');
    });

    it('should accept if shares meet minimum', async () => {
      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
        newYesQty: 900_000n,
        newNoQty: 1_100_000n,
        newVersionId: 2,
      });

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);
      mockPortfolioRepository.create.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n, // Very low, will pass
      });

      expect(result).toBeDefined();
      expect(result.sharesOut).toBeGreaterThan(0n);
    });
  });

  describe('Optimistic Locking', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
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
          amount: 100_000n,
          minSharesOut: 1n,
        })
      ).rejects.toThrow('Pool was modified by another transaction');
    });
  });

  describe('Portfolio Management', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
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
        newYesQty: 900_000n,
        newNoQty: 1_100_000n,
        newVersionId: 2,
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });
    });

    it('should create new portfolio if none exists', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);
      mockPortfolioRepository.create.mockResolvedValue({});

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n,
      });

      expect(mockPortfolioRepository.create).toHaveBeenCalled();
      expect(mockPortfolioRepository.update).not.toHaveBeenCalled();
    });

    it('should update existing portfolio', async () => {
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
        amount: 100_000n,
        minSharesOut: 1n,
      });

      expect(mockPortfolioRepository.update).toHaveBeenCalled();
      expect(mockPortfolioRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('Fee Calculation', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
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
        newYesQty: 900_000n,
        newNoQty: 1_100_000n,
        newVersionId: 2,
      });

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);
      mockPortfolioRepository.create.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });
    });

    it('should calculate and split fees correctly', async () => {
      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n,
      });

      // 2% fee on 100,000 = 2,000
      expect(result.feePaid).toBe(2_000n);
      // 50/50 split
      expect(result.feeVault).toBe(1_000n);
      expect(result.feeLp).toBe(1_000n);
    });
  });

  describe('Trade Ledger', () => {
    beforeEach(() => {
      mockTradeLedgerRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 1_000_000n,
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
        newYesQty: 900_000n,
        newNoQty: 1_100_000n,
        newVersionId: 2,
      });

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);
      mockPortfolioRepository.create.mockResolvedValue({});
    });

    it('should log trade to ledger with all details', async () => {
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n,
        idempotencyKey: 'test-key',
      });

      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          marketId: 'market1',
          action: 'BUY',
          side: 'YES',
          amountIn: 100_000n,
          idempotencyKey: 'test-key',
        }),
        expect.anything()
      );
    });
  });
});
