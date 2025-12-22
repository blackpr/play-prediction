import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MintSharesUseCase } from '../../../src/application/use-cases/trading/mint-shares.use-case';
import { BusinessLogicError, NotFoundError } from '../../../src/domain/errors/domain-error';

describe('MintSharesUseCase', () => {
  let useCase: MintSharesUseCase;
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

    useCase = new MintSharesUseCase({
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      userRepository: mockUserRepository,
      transactionManager: mockTransactionManager,
    });
  });

  describe('Validation', () => {
    it('should reject mint amount <= 0', async () => {
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

  describe('User Validation', () => {
    it('should reject if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'nonexistent',
          marketId: 'market1',
          amount: 1000n,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject if insufficient balance', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 500n,
      });

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'market1',
          amount: 1000n,
        })
      ).rejects.toThrow('Insufficient balance');
    });
  });

  describe('Market Validation', () => {
    it('should reject if market not found', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user1',
        balance: 10000n,
      });

      mockMarketRepository.findByIdWithPool.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user1',
          marketId: 'nonexistent',
          amount: 1000n,
        })
      ).rejects.toThrow(NotFoundError);
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
          yesQty: 1000n,
          noQty: 1000n,
        },
      });

      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });
    });

    it('should mint shares successfully for new portfolio', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null);
      mockPortfolioRepository.create.mockResolvedValue({});

      const amount = 1000n;
      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        amount,
      });

      expect(result.yesOut).toBe(amount);
      expect(result.noOut).toBe(amount);
      expect(result.newBalance).toBe(9000n);

      expect(mockMarketRepository.updateUserBalance).toHaveBeenCalledWith('user1', 9000n, expect.anything());

      expect(mockPortfolioRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          marketId: 'market1',
          yesQty: amount,
          noQty: amount,
          yesCostBasis: amount / 2n,
          noCostBasis: amount / 2n,
        }),
        expect.anything()
      );

      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          marketId: 'market1',
          action: 'MINT',
          amountIn: amount,
          amountOut: amount,
        }),
        expect.anything()
      );
    });

    it('should mint shares successfully for existing portfolio', async () => {
      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        yesQty: 500n,
        noQty: 500n,
        yesCostBasis: 250n,
        noCostBasis: 250n,
      });
      mockPortfolioRepository.update.mockResolvedValue({});

      const amount = 1000n;
      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        amount,
      });

      expect(mockPortfolioRepository.update).toHaveBeenCalledWith(
        'user1',
        'market1',
        expect.objectContaining({
          yesQty: 1500n,
          noQty: 1500n,
          yesCostBasis: 750n,
          noCostBasis: 750n,
        }),
        expect.anything()
      );
    });
  });
});
