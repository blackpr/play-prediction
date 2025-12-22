/**
 * Unit tests for Fee Calculator
 * 
 * Tests all fee calculation functions with various scenarios:
 * - Basic fee calculation with ceiling rounding
 * - Fee splitting between vault and LP
 * - Buy flow (net after fee)
 * - Sell flow (net payout)
 * - Edge cases (zero, small, large amounts)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFee,
  splitFee,
  calculateNetAfterFee,
  calculateNetPayout,
} from '../../../src/domain/services/fee-calculator.js';

describe('Fee Calculator', () => {
  describe('calculateFee', () => {
    it('should calculate 2% fee with ceiling rounding', () => {
      // 2% of 100,000 = 2,000
      expect(calculateFee(100_000n)).toBe(2_000n);
    });

    it('should round up with ceiling division', () => {
      // 2% of 100,001 = 2,000.02 → rounds up to 2,001
      expect(calculateFee(100_001n)).toBe(2_001n);

      // 2% of 99 = 1.98 → rounds up to 2
      expect(calculateFee(99n)).toBe(2n);

      // 2% of 100 = 2.00 → exactly 2
      expect(calculateFee(100n)).toBe(2n);

      // 2% of 101 = 2.02 → rounds up to 3
      expect(calculateFee(101n)).toBe(3n);
    });

    it('should handle zero amount', () => {
      expect(calculateFee(0n)).toBe(0n);
    });

    it('should handle very small amounts', () => {
      // 2% of 1 = 0.02 → rounds up to 1
      expect(calculateFee(1n)).toBe(1n);

      // 2% of 49 = 0.98 → rounds up to 1
      expect(calculateFee(49n)).toBe(1n);

      // 2% of 50 = 1.00 → exactly 1
      expect(calculateFee(50n)).toBe(1n);
    });

    it('should handle very large amounts', () => {
      // 2% of 1 billion = 20 million
      const oneBillion = 1_000_000_000n;
      expect(calculateFee(oneBillion)).toBe(20_000_000n);

      // 2% of 1 trillion = 20 billion
      const oneTrillion = 1_000_000_000_000n;
      expect(calculateFee(oneTrillion)).toBe(20_000_000_000n);
    });

    it('should throw on negative amount', () => {
      expect(() => calculateFee(-100n)).toThrow('Amount cannot be negative');
    });

    it('should calculate exact 2% for round numbers', () => {
      // Test various round numbers
      expect(calculateFee(1_000n)).toBe(20n);      // 2% of 1,000 = 20
      expect(calculateFee(10_000n)).toBe(200n);    // 2% of 10,000 = 200
      expect(calculateFee(50_000n)).toBe(1_000n);  // 2% of 50,000 = 1,000
    });
  });

  describe('splitFee', () => {
    it('should split fee 50/50 for even amounts', () => {
      const result = splitFee(2_000n);
      expect(result.vaultFee).toBe(1_000n);
      expect(result.lpFee).toBe(1_000n);
      expect(result.vaultFee + result.lpFee).toBe(2_000n);
    });

    it('should give remainder to LP for odd amounts', () => {
      const result = splitFee(2_001n);
      expect(result.vaultFee).toBe(1_000n);
      expect(result.lpFee).toBe(1_001n);
      expect(result.vaultFee + result.lpFee).toBe(2_001n);
    });

    it('should handle zero fee', () => {
      const result = splitFee(0n);
      expect(result.vaultFee).toBe(0n);
      expect(result.lpFee).toBe(0n);
    });

    it('should handle very small fees', () => {
      const result = splitFee(1n);
      expect(result.vaultFee).toBe(0n);
      expect(result.lpFee).toBe(1n);
      expect(result.vaultFee + result.lpFee).toBe(1n);
    });

    it('should preserve total for various amounts', () => {
      const testAmounts = [1n, 99n, 100n, 999n, 1_000n, 9_999n, 10_000n];

      for (const amount of testAmounts) {
        const result = splitFee(amount);
        expect(result.vaultFee + result.lpFee).toBe(amount);
      }
    });

    it('should throw on negative fee', () => {
      expect(() => splitFee(-100n)).toThrow('Total fee cannot be negative');
    });

    it('should split large fees correctly', () => {
      const result = splitFee(1_000_000n);
      expect(result.vaultFee).toBe(500_000n);
      expect(result.lpFee).toBe(500_000n);
    });
  });

  describe('calculateNetAfterFee', () => {
    it('should deduct fee from gross amount (buy flow)', () => {
      const result = calculateNetAfterFee(100_000n);

      expect(result.fee).toBe(2_000n);
      expect(result.netAmount).toBe(98_000n);
      expect(result.vaultFee).toBe(1_000n);
      expect(result.lpFee).toBe(1_000n);

      // Verify total
      expect(result.netAmount + result.fee).toBe(100_000n);
      expect(result.vaultFee + result.lpFee).toBe(result.fee);
    });

    it('should handle zero amount', () => {
      const result = calculateNetAfterFee(0n);

      expect(result.fee).toBe(0n);
      expect(result.netAmount).toBe(0n);
      expect(result.vaultFee).toBe(0n);
      expect(result.lpFee).toBe(0n);
    });

    it('should handle small amounts with ceiling rounding', () => {
      const result = calculateNetAfterFee(100n);

      // Fee = ceil(100 × 200 / 10,000) = ceil(2) = 2
      expect(result.fee).toBe(2n);
      expect(result.netAmount).toBe(98n);
      expect(result.vaultFee).toBe(1n);
      expect(result.lpFee).toBe(1n);
    });

    it('should handle amounts that result in odd fees', () => {
      const result = calculateNetAfterFee(100_001n);

      // Fee = ceil(100,001 × 200 / 10,000) = ceil(2,000.02) = 2,001
      expect(result.fee).toBe(2_001n);
      expect(result.netAmount).toBe(98_000n);
      expect(result.vaultFee).toBe(1_000n);
      expect(result.lpFee).toBe(1_001n); // Gets remainder
    });

    it('should throw on negative amount', () => {
      expect(() => calculateNetAfterFee(-100n)).toThrow('Gross amount cannot be negative');
    });

    it('should handle large amounts', () => {
      const result = calculateNetAfterFee(1_000_000_000n);

      expect(result.fee).toBe(20_000_000n);
      expect(result.netAmount).toBe(980_000_000n);
      expect(result.vaultFee).toBe(10_000_000n);
      expect(result.lpFee).toBe(10_000_000n);
    });
  });

  describe('calculateNetPayout', () => {
    it('should deduct fee from gross payout (sell flow)', () => {
      const result = calculateNetPayout(100_000n);

      expect(result.fee).toBe(2_000n);
      expect(result.netPayout).toBe(98_000n);
      expect(result.vaultFee).toBe(1_000n);
      expect(result.lpFee).toBe(1_000n);

      // Verify total
      expect(result.netPayout + result.fee).toBe(100_000n);
      expect(result.vaultFee + result.lpFee).toBe(result.fee);
    });

    it('should handle zero payout', () => {
      const result = calculateNetPayout(0n);

      expect(result.fee).toBe(0n);
      expect(result.netPayout).toBe(0n);
      expect(result.vaultFee).toBe(0n);
      expect(result.lpFee).toBe(0n);
    });

    it('should handle small payouts with ceiling rounding', () => {
      const result = calculateNetPayout(100n);

      // Fee = ceil(100 × 200 / 10,000) = ceil(2) = 2
      expect(result.fee).toBe(2n);
      expect(result.netPayout).toBe(98n);
      expect(result.vaultFee).toBe(1n);
      expect(result.lpFee).toBe(1n);
    });

    it('should handle payouts that result in odd fees', () => {
      const result = calculateNetPayout(100_001n);

      // Fee = ceil(100,001 × 200 / 10,000) = ceil(2,000.02) = 2,001
      expect(result.fee).toBe(2_001n);
      expect(result.netPayout).toBe(98_000n);
      expect(result.vaultFee).toBe(1_000n);
      expect(result.lpFee).toBe(1_001n); // Gets remainder
    });

    it('should throw on negative payout', () => {
      expect(() => calculateNetPayout(-100n)).toThrow('Gross payout cannot be negative');
    });

    it('should handle large payouts', () => {
      const result = calculateNetPayout(1_000_000_000n);

      expect(result.fee).toBe(20_000_000n);
      expect(result.netPayout).toBe(980_000_000n);
      expect(result.vaultFee).toBe(10_000_000n);
      expect(result.lpFee).toBe(10_000_000n);
    });
  });

  describe('Integration scenarios', () => {
    it('should calculate fees correctly for typical trade amounts', () => {
      // Typical trade: 10 Points = 10,000,000 MicroPoints
      const tenPoints = 10_000_000n;
      const result = calculateNetAfterFee(tenPoints);

      // 2% of 10,000,000 = 200,000
      expect(result.fee).toBe(200_000n);
      expect(result.netAmount).toBe(9_800_000n);
      expect(result.vaultFee).toBe(100_000n);
      expect(result.lpFee).toBe(100_000n);
    });

    it('should handle minimum trade size (1,000 MicroPoints)', () => {
      const minTrade = 1_000n;
      const result = calculateNetAfterFee(minTrade);

      // 2% of 1,000 = 20
      expect(result.fee).toBe(20n);
      expect(result.netAmount).toBe(980n);
      expect(result.vaultFee).toBe(10n);
      expect(result.lpFee).toBe(10n);
    });

    it('should ensure buy and sell flows use same fee calculation', () => {
      const amount = 50_000n;

      const buyResult = calculateNetAfterFee(amount);
      const sellResult = calculateNetPayout(amount);

      // Both should calculate the same fee
      expect(buyResult.fee).toBe(sellResult.fee);
      expect(buyResult.vaultFee).toBe(sellResult.vaultFee);
      expect(buyResult.lpFee).toBe(sellResult.lpFee);

      // Both should result in same net amount
      expect(buyResult.netAmount).toBe(sellResult.netPayout);
    });

    it('should verify ceiling rounding always favors house', () => {
      // Test amounts that don't divide evenly
      const testAmounts = [99n, 101n, 999n, 1_001n, 9_999n, 10_001n];

      for (const amount of testAmounts) {
        const fee = calculateFee(amount);

        // Calculate what floor rounding would give
        const floorFee = (amount * 200n) / 10_000n;

        // Ceiling should always be >= floor
        expect(fee).toBeGreaterThanOrEqual(floorFee);

        // For non-exact divisions, ceiling should be strictly greater
        if ((amount * 200n) % 10_000n !== 0n) {
          expect(fee).toBeGreaterThan(floorFee);
        }
      }
    });
  });
});
