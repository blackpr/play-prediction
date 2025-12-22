import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MergeSharesUseCase } from '../../../src/application/use-cases/trading/merge-shares.use-case';
import { BusinessLogicError, NotFoundError } from '../../../src/domain/errors/domain-error';

describe('MergeSharesUseCase', () => {
  let useCase: MergeSharesUseCase;
  let mockMarketRepository: any;
  let mockPortfolioRepository: any;
  let mockTradeLedgerRepository: any;
  let mockUserRepository: any;
  let mockTransactionManager: any;

  beforeEach(() => {
    // Mock repositories
    mockMarketRepository = {
      findByIdWithPool: vi.fn(),
      updateUserBalance: vi.fn(),
    };

    mockPortfolioRepository = {
      findByUserAndMarket: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    mockTradeLedgerRepository = {
      create: vi.fn(),
    };

    mockUserRepository = {
      findById: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})), // Execute callback immediately
    };

    useCase = new MergeSharesUseCase({
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      userRepository: mockUserRepository,
      transactionManager: mockTransactionManager,
    });
  });

  describe('Validation', () => {
    it('should reject merge amount <= 0', async () => {
      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          amount: 0n,
        })
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          amount: -100n,
        })
      ).rejects.toThrow('Amount must be positive');
    });
  });

  describe('Share Validation', () => {
    it('should reject if portfolio not found', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          amount: 1000n,
        })
      ).rejects.toThrow('Insufficient shares');
    });

    it('should reject if insufficient YES shares', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        yesQty: 500n,
        noQty: 1000n,
        yesCostBasis: 250n,
        noCostBasis: 500n,
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          amount: 1000n,
        })
      ).rejects.toThrow('Insufficient shares');
    });

    it('should reject if insufficient NO shares', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        yesQty: 1000n,
        noQty: 500n,
        yesCostBasis: 500n,
        noCostBasis: 250n,
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          amount: 1000n,
        })
      ).rejects.toThrow('Insufficient shares');
    });
  });

  describe('Execution', () => {
    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 10000n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        pool: {
          yesQty: 10000n,
          noQty: 10000n,
        },
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });
    });

    it('should merge shares successfully', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        yesQty: 2000n,
        noQty: 2000n,
        yesCostBasis: 1000n,
        noCostBasis: 1000n,
      });
      mockPortfolioRepository.update.mockResolvedValue({});

      const amount = 1000n;
      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        amount,
      });

      expect(result.amountOut).toBe(amount);
      expect(result.newBalance).toBe(11000n); // 10000 + 1000

      // Verify portfolio update (half of shares removed, so half of cost basis removed)
      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user1',
        'market1',
        expect.objectContaining({
          yesQty: 1000n, // 2000 - 1000
          noQty: 1000n, // 2000 - 1000
          yesCostBasis: 500n, // 1000 - 500
          noCostBasis: 500n, // 1000 - 500
        }),
        expect.anything()
      );

      // Verify balance update
      expect(mockMarketRepository.updateUserBalance).toHaveBeenCalledWith('user1', 11000n, expect.anything());

      // Verify ledger
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          marketId: 'market1',
          action: 'MERGE',
          amountIn: amount,
          amountOut: amount,
        }),
        expect.anything()
      );
    });
  });
});
