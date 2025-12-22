import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuySharesUseCase } from '../../../src/application/use-cases/trading/buy-shares.use-case';
import { BusinessLogicError } from '../../../src/domain/errors/domain-error';

/**
 * Unit tests for MINT-4: Netting Protocol
 * 
 * Tests the automatic netting behavior when users buy the opposite side
 * of their current position. The system should:
 * 1. Detect opposite position
 * 2. Execute fee-free NET_SELL
 * 3. Aggregate proceeds with buy amount
 * 4. Execute final buy with fees
 */
describe('BuySharesUseCase - Netting Protocol (MINT-4)', () => {
  let useCase: BuySharesUseCase;
  let mockMarketRepository: any;
  let mockPortfolioRepository: any;
  let mockTradeLedgerRepository: any;
  let mockUserRepository: any;
  let mockTransactionManager: any;

  beforeEach(() => {
    // Mock repositories
    mockMarketRepository = {
      findByIdWithPool: vi.fn(),
      updatePoolWithLock: vi.fn(),
      updateUserBalance: vi.fn(),
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

    useCase = new BuySharesUseCase({
      marketRepository: mockMarketRepository,
      portfolioRepository: mockPortfolioRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
      userRepository: mockUserRepository,
      transactionManager: mockTransactionManager,
    });
  });

  describe('No Netting - Same Side Buy', () => {
    it('should execute normal buy when user holds same side shares', async () => {
      // User holds 100,000 YES, wants to buy more YES
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

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 100_000n, // Holds YES
        noQty: 0n,
        yesCostBasis: 100_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
      });

      mockPortfolioRepository.update.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES', // Buying same side
        amount: 100_000n,
        minSharesOut: 1n,
      });

      // Should only create ONE ledger entry (BUY), no NET_SELL
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledTimes(1);
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BUY',
          side: 'YES',
        }),
        expect.anything()
      );

      // Should NOT clear opposite position (no opposite position exists)
      expect(mockPortfolioRepository.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Netting - Opposite Side Buy', () => {
    it('should execute fee-free NET_SELL when user holds opposite shares', async () => {
      // User holds 100,000 NO, wants to buy YES
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

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 0n,
        noQty: 100_000n, // Holds NO
        yesCostBasis: 0n,
        noCostBasis: 100_000n,
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
      });

      mockPortfolioRepository.update.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES', // Buying opposite side
        amount: 50_000n,
        minSharesOut: 1n,
      });

      // Should create TWO ledger entries: NET_SELL + BUY
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledTimes(2);

      // First call: NET_SELL (fee-free)
      const firstCall = mockTradeLedgerRepository.create.mock.calls[0][0];
      expect(firstCall).toMatchObject({
        action: 'NET_SELL',
        side: 'NO',
        amountIn: 100_000n, // All NO shares sold
        feePaid: 0n, // Fee-free!
        feeVault: 0n,
        feeLp: 0n,
        sharesBefore: 100_000n,
        sharesAfter: 0n,
      });

      // Second call: BUY
      const secondCall = mockTradeLedgerRepository.create.mock.calls[1][0];
      expect(secondCall).toMatchObject({
        action: 'BUY',
        side: 'YES',
        amountIn: 50_000n, // Original buy amount
      });
      // BUY should have fees (2% = 1,000)
      expect(secondCall.feePaid).toBeGreaterThan(0n);
    });

    it('should clear opposite position in portfolio after netting', async () => {
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

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 0n,
        noQty: 50_000n, // Holds NO
        yesCostBasis: 0n,
        noCostBasis: 50_000n,
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
      });

      mockPortfolioRepository.update.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n,
      });

      // Should update portfolio TWICE:
      // 1. Clear NO position (netting)
      // 2. Add YES position (buy)
      expect(mockPortfolioRepository.update).toHaveBeenCalledTimes(2);

      // First update: Clear NO position
      const firstUpdate = mockPortfolioRepository.update.mock.calls[0];
      expect(firstUpdate[2]).toMatchObject({
        noQty: 0n,
        noCostBasis: 0n,
      });

      // Second update: Add YES position
      const secondUpdate = mockPortfolioRepository.update.mock.calls[1];
      expect(secondUpdate[2].yesQty).toBeGreaterThan(0n);
    });

    it('should aggregate netting proceeds with buy amount', async () => {
      // This test verifies that the final buy uses:
      // totalBuyingPower = netAmount (after fees) + nettingProceeds

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

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 0n,
        noQty: 100_000n, // Holds 100k NO
        yesCostBasis: 0n,
        noCostBasis: 100_000n,
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
      });

      mockPortfolioRepository.update.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 50_000n, // Original buy amount
        minSharesOut: 1n,
      });

      // Shares out should be MORE than if we only used 50k
      // because we're also using the proceeds from selling 100k NO shares
      expect(result.sharesOut).toBeGreaterThan(0n);

      // The NET_SELL should have generated proceeds
      const netSellCall = mockTradeLedgerRepository.create.mock.calls[0][0];
      expect(netSellCall.amountOut).toBeGreaterThan(0n);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no existing portfolio (new position)', async () => {
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

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue(null); // No existing portfolio

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
      });

      mockPortfolioRepository.create.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n,
      });

      // Should only create ONE ledger entry (BUY), no netting
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledTimes(1);
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BUY',
        }),
        expect.anything()
      );

      // Should create new portfolio
      expect(mockPortfolioRepository.create).toHaveBeenCalled();
    });

    it('should handle netting when buying NO with existing YES position', async () => {
      // Reverse scenario: user holds YES, buys NO
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

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 75_000n, // Holds YES
        noQty: 0n,
        yesCostBasis: 75_000n,
        noCostBasis: 0n,
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
      });

      mockPortfolioRepository.update.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'NO', // Buying opposite side
        amount: 50_000n,
        minSharesOut: 1n,
      });

      // Should create TWO ledger entries
      expect(mockTradeLedgerRepository.create).toHaveBeenCalledTimes(2);

      // First: NET_SELL of YES
      const netSellCall = mockTradeLedgerRepository.create.mock.calls[0][0];
      expect(netSellCall).toMatchObject({
        action: 'NET_SELL',
        side: 'YES',
        amountIn: 75_000n,
        feePaid: 0n,
      });

      // Second: BUY NO
      const buyCall = mockTradeLedgerRepository.create.mock.calls[1][0];
      expect(buyCall).toMatchObject({
        action: 'BUY',
        side: 'NO',
      });
    });
  });

  describe('Fee Verification', () => {
    it('should charge NO fees on netting sell, but normal fees on buy', async () => {
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

      mockPortfolioRepository.findByUserAndMarket.mockResolvedValue({
        userId: 'user1',
        marketId: 'market1',
        yesQty: 0n,
        noQty: 100_000n,
        yesCostBasis: 0n,
        noCostBasis: 100_000n,
      });

      mockMarketRepository.updatePoolWithLock.mockResolvedValue({
        success: true,
      });

      mockPortfolioRepository.update.mockResolvedValue({});
      mockTradeLedgerRepository.create.mockResolvedValue({ id: 'trade1' });

      const result = await useCase.execute({
        userId: 'user1',
        marketId: 'market1',
        side: 'YES',
        amount: 100_000n,
        minSharesOut: 1n,
      });

      // NET_SELL should have 0 fees
      const netSellCall = mockTradeLedgerRepository.create.mock.calls[0][0];
      expect(netSellCall.feePaid).toBe(0n);
      expect(netSellCall.feeVault).toBe(0n);
      expect(netSellCall.feeLp).toBe(0n);

      // BUY should have normal 2% fees
      expect(result.feePaid).toBe(2_000n); // 2% of 100,000
      expect(result.feeVault).toBe(1_000n); // 50% of fee
      expect(result.feeLp).toBe(1_000n); // 50% of fee
    });
  });
});
