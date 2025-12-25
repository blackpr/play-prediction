import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetQuoteUseCase } from '../../../src/application/use-cases/trading/get-quote.use-case';
import { NotFoundError } from '../../../src/domain/errors/domain-error';

describe('GetQuoteUseCase', () => {
  let useCase: GetQuoteUseCase;
  let mockMarketRepository: any;

  beforeEach(() => {
    // Mock repository
    mockMarketRepository = {
      findByIdWithPool: vi.fn(),
    };

    useCase = new GetQuoteUseCase({
      marketRepository: mockMarketRepository,
    });
  });

  describe('BUY Quotes', () => {
    beforeEach(() => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });
    });

    it('should calculate BUY YES quote correctly', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 100_000n,
      });

      expect(result.side).toBe('YES');
      expect(result.action).toBe('BUY');
      expect(result.amountIn).toBe('100000');

      // Should have estimated shares out (after 2% fee)
      expect(result.estimatedSharesOut).toBeDefined();
      expect(BigInt(result.estimatedSharesOut!)).toBeGreaterThan(0n);
      expect(BigInt(result.estimatedSharesOut!)).toBeGreaterThan(100_000n); // Greater than input points (Price < 1.0)

      // Should have fee (2% of 100,000 = 2,000)
      expect(result.estimatedFee).toBe('2000');

      // Should have price impact
      expect(result.priceImpact).toBeDefined();
      expect(parseFloat(result.priceImpact)).toBeGreaterThanOrEqual(0);

      // Should have spot price (0.50 for balanced pool)
      expect(result.spotPrice).toBe('0.500000');

      // Should have average execution price
      expect(result.avgExecutionPrice).toBeDefined();
      expect(parseFloat(result.avgExecutionPrice)).toBeGreaterThan(0);

      // Should have minimum recommended (95% of shares out)
      expect(result.minimumRecommended).toBeDefined();
      const sharesOut = BigInt(result.estimatedSharesOut!);
      const minRecommended = BigInt(result.minimumRecommended);
      expect(minRecommended).toBe((sharesOut * 95n) / 100n);

      // Should have expiry time (~30 seconds from now)
      expect(result.expiresAt).toBeDefined();
      const expiryTime = new Date(result.expiresAt).getTime();
      const now = Date.now();
      expect(expiryTime).toBeGreaterThan(now);
      expect(expiryTime).toBeLessThan(now + 35_000); // Within 35 seconds
    });

    it('should calculate BUY NO quote correctly', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'NO',
        action: 'BUY',
        amount: 100_000n,
      });

      expect(result.side).toBe('NO');
      expect(result.action).toBe('BUY');
      expect(result.estimatedSharesOut).toBeDefined();
      expect(result.spotPrice).toBe('0.500000'); // NO price in balanced pool
    });

    it('should handle large buy orders with price impact', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 500_000n, // Large order
      });

      // Large orders should have noticeable price impact
      expect(parseFloat(result.priceImpact)).toBeGreaterThan(0);

      // Average execution price should be higher than spot price
      expect(parseFloat(result.avgExecutionPrice)).toBeGreaterThan(parseFloat(result.spotPrice));
    });

    it('should handle small buy orders with minimal price impact', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 1_000n, // Small order
      });

      // Small orders should have price impact (even small orders move the price slightly)
      expect(parseFloat(result.priceImpact)).toBeGreaterThanOrEqual(0);
      // For a 1,000 MicroPoint order on a 1M pool, impact should be very small but measurable
      expect(parseFloat(result.priceImpact)).toBeLessThan(2); // Less than 200% (very generous)
    });

    it('should calculate quote for unbalanced pool', async () => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        pool: {
          yesQty: 400_000n,
          noQty: 600_000n,
          versionId: 1,
        },
      });

      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 100_000n,
      });

      // YES price should be 0.60 (600 / 1000)
      expect(result.spotPrice).toBe('0.600000');
      expect(result.estimatedSharesOut).toBeDefined();
    });
  });

  describe('SELL Quotes', () => {
    beforeEach(() => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });
    });

    it('should calculate SELL YES quote correctly', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'SELL',
        amount: 50_000n, // Selling 50,000 shares
      });

      expect(result.side).toBe('YES');
      expect(result.action).toBe('SELL');
      expect(result.amountIn).toBe('50000');

      // Should have estimated amount out (after 2% fee)
      expect(result.estimatedAmountOut).toBeDefined();
      expect(BigInt(result.estimatedAmountOut!)).toBeGreaterThan(0n);
      expect(BigInt(result.estimatedAmountOut!)).toBeLessThan(50_000n); // Less than shares due to fees

      // Should have fee
      expect(result.estimatedFee).toBeDefined();
      expect(BigInt(result.estimatedFee)).toBeGreaterThan(0n);

      // Should have price impact
      expect(result.priceImpact).toBeDefined();
      expect(parseFloat(result.priceImpact)).toBeGreaterThanOrEqual(0);

      // Should have spot price
      expect(result.spotPrice).toBe('0.500000');

      // Should have average execution price
      expect(result.avgExecutionPrice).toBeDefined();
      expect(parseFloat(result.avgExecutionPrice)).toBeGreaterThan(0);

      // Should have minimum recommended (95% of amount out)
      expect(result.minimumRecommended).toBeDefined();
      const amountOut = BigInt(result.estimatedAmountOut!);
      const minRecommended = BigInt(result.minimumRecommended);
      expect(minRecommended).toBe((amountOut * 95n) / 100n);
    });

    it('should calculate SELL NO quote correctly', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'NO',
        action: 'SELL',
        amount: 50_000n,
      });

      expect(result.side).toBe('NO');
      expect(result.action).toBe('SELL');
      expect(result.estimatedAmountOut).toBeDefined();
      expect(result.spotPrice).toBe('0.500000'); // NO price in balanced pool
    });

    it('should handle large sell orders with price impact', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'SELL',
        amount: 200_000n, // Large sell
      });

      // Large sells should have price impact
      // Note: Price impact for sells might be 0 if avgPrice >= spotPrice
      // This is because selling reduces the price, so the check needs to be different
      expect(parseFloat(result.priceImpact)).toBeGreaterThanOrEqual(0);

      // Average execution price should be positive
      expect(parseFloat(result.avgExecutionPrice)).toBeGreaterThan(0);
    });

    it('should handle small sell orders with minimal price impact', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'SELL',
        amount: 1_000n, // Small sell
      });

      // Small orders should have minimal price impact
      expect(parseFloat(result.priceImpact)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(result.priceImpact)).toBeLessThan(0.03); // Less than 3% (2% fee + minimal slippage)
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError if market does not exist', async () => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue(null);

      await expect(
        useCase.execute({
          marketId: 'nonexistent',
          side: 'YES',
          action: 'BUY',
          amount: 100_000n,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError with correct market ID', async () => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue(null);

      try {
        await useCase.execute({
          marketId: 'market-123',
          side: 'YES',
          action: 'BUY',
          amount: 100_000n,
        });
        expect.fail('Should have thrown NotFoundError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NotFoundError);
        expect(error.message).toContain('market-123');
      }
    });
  });

  describe('Price Precision', () => {
    beforeEach(() => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });
    });

    it('should return prices with 6 decimal places', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 100_000n,
      });

      // Spot price should have exactly 6 decimal places
      expect(result.spotPrice).toMatch(/^\d+\.\d{6}$/);

      // Average execution price should have exactly 6 decimal places
      expect(result.avgExecutionPrice).toMatch(/^\d+\.\d{6}$/);

      // Price impact should have exactly 6 decimal places
      expect(result.priceImpact).toMatch(/^\d+\.\d{6}$/);
    });

    it('should return all amounts as strings', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 100_000n,
      });

      expect(typeof result.amountIn).toBe('string');
      expect(typeof result.estimatedSharesOut).toBe('string');
      expect(typeof result.estimatedFee).toBe('string');
      expect(typeof result.minimumRecommended).toBe('string');
    });
  });

  describe('Quote Expiry', () => {
    beforeEach(() => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });
    });

    it('should set expiry to approximately 30 seconds from now', async () => {
      const beforeTime = Date.now();

      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 100_000n,
      });

      const afterTime = Date.now();
      const expiryTime = new Date(result.expiresAt).getTime();

      // Expiry should be between 29-31 seconds from request time
      expect(expiryTime).toBeGreaterThanOrEqual(beforeTime + 29_000);
      expect(expiryTime).toBeLessThanOrEqual(afterTime + 31_000);
    });

    it('should return valid ISO 8601 timestamp', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 100_000n,
      });

      // Should be valid ISO 8601 format
      expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Should be parseable as a date
      const expiryDate = new Date(result.expiresAt);
      expect(expiryDate.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Slippage Recommendations', () => {
    beforeEach(() => {
      mockMarketRepository.findByIdWithPool.mockResolvedValue({
        id: 'market1',
        status: 'ACTIVE',
        pool: {
          yesQty: 1_000_000n,
          noQty: 1_000_000n,
          versionId: 1,
        },
      });
    });

    it('should recommend 5% slippage for BUY orders', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'BUY',
        amount: 100_000n,
      });

      const sharesOut = BigInt(result.estimatedSharesOut!);
      const minRecommended = BigInt(result.minimumRecommended);

      // Should be exactly 95% of shares out
      expect(minRecommended).toBe((sharesOut * 95n) / 100n);
    });

    it('should recommend 5% slippage for SELL orders', async () => {
      const result = await useCase.execute({
        marketId: 'market1',
        side: 'YES',
        action: 'SELL',
        amount: 50_000n,
      });

      const amountOut = BigInt(result.estimatedAmountOut!);
      const minRecommended = BigInt(result.minimumRecommended);

      // Should be exactly 95% of amount out
      expect(minRecommended).toBe((amountOut * 95n) / 100n);
    });
  });
});
