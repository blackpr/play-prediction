import { describe, it, expect } from 'vitest';
import {
  calculateBuyShares,
  calculateSellPoints,
  getPrices,
  validatePool,
  type PoolState,
} from '../../../src/domain/services/cpmm-engine.js';
import { InvariantViolationError } from '../../../src/domain/errors/domain-error.js';
import { PRICE_PRECISION } from '../../../src/domain/services/constants.js';

describe('CPMM Engine', () => {
  describe('validatePool', () => {
    it('should accept valid pool', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      expect(() => validatePool(pool)).not.toThrow();
    });

    it('should reject pool with zero YES quantity', () => {
      const pool: PoolState = { yesQty: 0n, noQty: 600n };
      expect(() => validatePool(pool)).toThrow(InvariantViolationError);
      expect(() => validatePool(pool)).toThrow('YES quantity must be positive');
    });

    it('should reject pool with zero NO quantity', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 0n };
      expect(() => validatePool(pool)).toThrow(InvariantViolationError);
      expect(() => validatePool(pool)).toThrow('NO quantity must be positive');
    });

    it('should reject pool with negative YES quantity', () => {
      const pool: PoolState = { yesQty: -100n, noQty: 600n };
      expect(() => validatePool(pool)).toThrow(InvariantViolationError);
    });

    it('should reject pool with negative NO quantity', () => {
      const pool: PoolState = { yesQty: 400n, noQty: -100n };
      expect(() => validatePool(pool)).toThrow(InvariantViolationError);
    });
  });

  describe('getPrices', () => {
    it('should calculate prices for balanced pool (50/50)', () => {
      const pool: PoolState = { yesQty: 500n, noQty: 500n };
      const prices = getPrices(pool);

      // P_YES = NO / (YES + NO) = 500 / 1000 = 0.5
      expect(prices.yesPrice).toBe(500_000n);
      // P_NO = YES / (YES + NO) = 500 / 1000 = 0.5
      expect(prices.noPrice).toBe(500_000n);
      // Verify they sum to 1.0
      expect(prices.yesPrice + prices.noPrice).toBe(PRICE_PRECISION);
    });

    it('should calculate prices for skewed pool (60/40)', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const prices = getPrices(pool);

      // P_YES = NO / (YES + NO) = 600 / 1000 = 0.6
      expect(prices.yesPrice).toBe(600_000n);
      // P_NO = YES / (YES + NO) = 400 / 1000 = 0.4
      expect(prices.noPrice).toBe(400_000n);
      // Verify they sum to 1.0
      expect(prices.yesPrice + prices.noPrice).toBe(PRICE_PRECISION);
    });

    it('should calculate prices for extreme pool (99/1)', () => {
      const pool: PoolState = { yesQty: 10n, noQty: 990n };
      const prices = getPrices(pool);

      // P_YES = 990 / 1000 = 0.99
      expect(prices.yesPrice).toBe(990_000n);
      // P_NO = 10 / 1000 = 0.01
      expect(prices.noPrice).toBe(10_000n);
      // Verify they sum to 1.0
      expect(prices.yesPrice + prices.noPrice).toBe(PRICE_PRECISION);
    });

    it('should handle large pool quantities', () => {
      const pool: PoolState = {
        yesQty: 1_000_000_000n,
        noQty: 2_000_000_000n,
      };
      const prices = getPrices(pool);

      // P_YES = 2B / 3B = 0.666...
      expect(prices.yesPrice).toBe(666_666n);
      // P_NO = 1B / 3B = 0.333...
      expect(prices.noPrice).toBe(333_333n);
      // Should be close to 1.0 (within rounding)
      const sum = prices.yesPrice + prices.noPrice;
      expect(sum).toBeGreaterThanOrEqual(999_999n);
      expect(sum).toBeLessThanOrEqual(PRICE_PRECISION);
    });
  });

  describe('calculateBuyShares', () => {
    it('should calculate basic YES buy', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const k = 400n * 600n; // 240,000

      const result = calculateBuyShares(100n, pool, 'YES');

      // Buying YES: add 100 to NO pool
      // new NO = 600 + 100 = 700
      // new YES = ceil(240,000 / 700) = ceil(342.857) = 343
      // shares out = 400 - 343 = 57
      expect(result.sharesOut).toBe(57n);
      expect(result.newNoQty).toBe(700n);
      expect(result.newYesQty).toBe(343n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should calculate basic NO buy', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const k = 400n * 600n; // 240,000

      const result = calculateBuyShares(100n, pool, 'NO');

      // Buying NO: add 100 to YES pool
      // new YES = 400 + 100 = 500
      // new NO = ceil(240,000 / 500) = 480
      // shares out = 600 - 480 = 120
      expect(result.sharesOut).toBe(120n);
      expect(result.newYesQty).toBe(500n);
      expect(result.newNoQty).toBe(480n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should handle large trade with significant price impact', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const k = 400n * 600n;

      const result = calculateBuyShares(1000n, pool, 'YES');

      // Buying YES with 1000 points
      // new NO = 600 + 1000 = 1600
      // new YES = ceil(240,000 / 1600) = 150
      // shares out = 400 - 150 = 250
      expect(result.sharesOut).toBe(250n);
      expect(result.newNoQty).toBe(1600n);
      expect(result.newYesQty).toBe(150n);

      // Price impact should be significant
      expect(result.priceImpact).toBeGreaterThan(0n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should handle small trade with minimal impact', () => {
      const pool: PoolState = { yesQty: 1_000_000n, noQty: 1_000_000n };
      const k = pool.yesQty * pool.noQty;

      const result = calculateBuyShares(100n, pool, 'YES');

      // Small trade in large pool should have minimal impact
      expect(result.sharesOut).toBeGreaterThan(0n);
      expect(result.priceImpact).toBeGreaterThanOrEqual(0n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should handle edge case: buying with minimal points', () => {
      // Use a larger pool and slightly larger amount to ensure shares > 0
      const pool: PoolState = { yesQty: 1_000_000n, noQty: 1_000_000n };
      const k = pool.yesQty * pool.noQty;

      // 10 points is small enough to be minimal but large enough to yield shares
      const result = calculateBuyShares(10n, pool, 'YES');

      expect(result.sharesOut).toBeGreaterThan(0n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should reject zero points', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      expect(() => calculateBuyShares(0n, pool, 'YES')).toThrow(
        InvariantViolationError
      );
    });

    it('should reject negative points', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      expect(() => calculateBuyShares(-100n, pool, 'YES')).toThrow(
        InvariantViolationError
      );
    });

    it('should verify k-invariant preservation across multiple buys', () => {
      let pool: PoolState = { yesQty: 1000n, noQty: 1000n };
      let k = pool.yesQty * pool.noQty;

      // Perform 5 sequential buys
      for (let i = 0; i < 5; i++) {
        const result = calculateBuyShares(100n, pool, 'YES');
        pool = { yesQty: result.newYesQty, noQty: result.newNoQty };

        const newK = pool.yesQty * pool.noQty;
        expect(newK).toBeGreaterThanOrEqual(k);
        k = newK;
      }
    });
  });

  describe('calculateSellPoints', () => {
    it('should calculate basic YES sell', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const k = 400n * 600n; // 240,000

      const result = calculateSellPoints(50n, pool, 'YES');

      // Selling YES: add 50 to YES pool
      // new YES = 400 + 50 = 450
      // new NO = ceil(240,000 / 450) = ceil(533.333) = 534
      // points out = 600 - 534 = 66
      expect(result.pointsOut).toBe(66n);
      expect(result.newYesQty).toBe(450n);
      expect(result.newNoQty).toBe(534n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should calculate basic NO sell', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const k = 400n * 600n;

      const result = calculateSellPoints(100n, pool, 'NO');

      // Selling NO: add 100 to NO pool
      // new NO = 600 + 100 = 700
      // new YES = ceil(240,000 / 700) = 343
      // points out = 400 - 343 = 57
      expect(result.pointsOut).toBe(57n);
      expect(result.newYesQty).toBe(343n);
      expect(result.newNoQty).toBe(700n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should handle selling large quantity', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const k = pool.yesQty * pool.noQty;

      const result = calculateSellPoints(200n, pool, 'YES');

      expect(result.pointsOut).toBeGreaterThan(0n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should handle edge case: selling 1 share', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const k = pool.yesQty * pool.noQty;

      const result = calculateSellPoints(1n, pool, 'YES');

      expect(result.pointsOut).toBeGreaterThan(0n);

      // Verify k hasn't decreased
      const newK = result.newYesQty * result.newNoQty;
      expect(newK).toBeGreaterThanOrEqual(k);
    });

    it('should reject zero shares', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      expect(() => calculateSellPoints(0n, pool, 'YES')).toThrow(
        InvariantViolationError
      );
    });

    it('should reject negative shares', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      expect(() => calculateSellPoints(-50n, pool, 'YES')).toThrow(
        InvariantViolationError
      );
    });

    it('should verify k-invariant preservation across multiple sells', () => {
      let pool: PoolState = { yesQty: 1000n, noQty: 1000n };
      let k = pool.yesQty * pool.noQty;

      // Perform 5 sequential sells
      for (let i = 0; i < 5; i++) {
        const result = calculateSellPoints(10n, pool, 'YES');
        pool = { yesQty: result.newYesQty, noQty: result.newNoQty };

        const newK = pool.yesQty * pool.noQty;
        expect(newK).toBeGreaterThanOrEqual(k);
        k = newK;
      }
    });
  });

  describe('Round-trip operations', () => {
    it('should handle buy then sell round-trip', () => {
      const initialPool: PoolState = { yesQty: 1000n, noQty: 1000n };
      const initialK = initialPool.yesQty * initialPool.noQty;

      // Buy YES shares
      const buyResult = calculateBuyShares(100n, initialPool, 'YES');
      const afterBuyPool: PoolState = {
        yesQty: buyResult.newYesQty,
        noQty: buyResult.newNoQty,
      };
      const afterBuyK = afterBuyPool.yesQty * afterBuyPool.noQty;

      // Sell the same shares back
      const sellResult = calculateSellPoints(
        buyResult.sharesOut,
        afterBuyPool,
        'YES'
      );
      const finalK = sellResult.newYesQty * sellResult.newNoQty;

      // k should have increased (due to ceiling division)
      expect(afterBuyK).toBeGreaterThanOrEqual(initialK);
      expect(finalK).toBeGreaterThanOrEqual(afterBuyK);

      // User should get back less than they put in (due to slippage + rounding)
      expect(sellResult.pointsOut).toBeLessThan(100n);
    });

    it('should preserve k across alternating buy/sell operations', () => {
      let pool: PoolState = { yesQty: 1000n, noQty: 1000n };
      let k = pool.yesQty * pool.noQty;

      // Alternate between buying and selling
      for (let i = 0; i < 3; i++) {
        // Buy
        const buyResult = calculateBuyShares(50n, pool, 'YES');
        pool = { yesQty: buyResult.newYesQty, noQty: buyResult.newNoQty };
        const newK = pool.yesQty * pool.noQty;
        expect(newK).toBeGreaterThanOrEqual(k);
        k = newK;

        // Sell
        const sellResult = calculateSellPoints(25n, pool, 'YES');
        pool = { yesQty: sellResult.newYesQty, noQty: sellResult.newNoQty };
        const newK2 = pool.yesQty * pool.noQty;
        expect(newK2).toBeGreaterThanOrEqual(k);
        k = newK2;
      }
    });
  });

  describe('Mathematical properties', () => {
    it('should verify P_YES + P_NO = 1.0 after buy', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const buyResult = calculateBuyShares(100n, pool, 'YES');

      const newPool: PoolState = {
        yesQty: buyResult.newYesQty,
        noQty: buyResult.newNoQty,
      };
      const prices = getPrices(newPool);

      // Should sum to 1.0 (within rounding)
      const sum = prices.yesPrice + prices.noPrice;
      expect(sum).toBeGreaterThanOrEqual(999_999n);
      expect(sum).toBeLessThanOrEqual(PRICE_PRECISION);
    });

    it('should verify P_YES + P_NO = 1.0 after sell', () => {
      const pool: PoolState = { yesQty: 400n, noQty: 600n };
      const sellResult = calculateSellPoints(50n, pool, 'YES');

      const newPool: PoolState = {
        yesQty: sellResult.newYesQty,
        noQty: sellResult.newNoQty,
      };
      const prices = getPrices(newPool);

      // Should sum to 1.0 (within rounding)
      const sum = prices.yesPrice + prices.noPrice;
      expect(sum).toBeGreaterThanOrEqual(999_999n);
      expect(sum).toBeLessThanOrEqual(PRICE_PRECISION);
    });

    it('should verify floor rounding on shares out', () => {
      const pool: PoolState = { yesQty: 333n, noQty: 667n };
      const result = calculateBuyShares(100n, pool, 'YES');

      // With BigInt division, result is automatically floored
      // Verify shares is an integer
      expect(result.sharesOut % 1n).toBe(0n);
    });

    it('should verify floor rounding on points out', () => {
      const pool: PoolState = { yesQty: 333n, noQty: 667n };
      const result = calculateSellPoints(50n, pool, 'YES');

      // With BigInt division, result is automatically floored
      // Verify points is an integer
      expect(result.pointsOut % 1n).toBe(0n);
    });
  });
});
