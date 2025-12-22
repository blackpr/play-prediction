/**
 * Fee Calculator for CPMM Trading Engine
 * 
 * Pure domain logic for fee calculations with zero external dependencies.
 * 
 * Fee Rules:
 * - Fee rate: 2.0% (200 basis points)
 * - Fee split: 50% vault, 50% LP injection
 * - Fees round UP (ceiling) - favors house
 * - User payouts round DOWN (floor) - automatic with BigInt
 * 
 * Fee Application:
 * - Buy: Deduct from input BEFORE swap
 * - Sell: Deduct from output AFTER swap
 * - Mint/Merge/Netting: No fee
 * 
 * @see docs/ENGINE_LOGIC.md Section 4 for detailed specifications
 */

import {
  FEE_RATE_BP,
  BP_DIVISOR,
  FEE_VAULT_SHARE_BP,
  FEE_LP_SHARE_BP,
} from './constants.js';

/**
 * Fee breakdown between vault and liquidity pool
 */
export interface FeeSplit {
  /** Fee allocated to vault (50% of total) */
  vaultFee: bigint;
  /** Fee allocated to liquidity pool (50% of total) */
  lpFee: bigint;
}

/**
 * Result of calculating net amount after fee deduction (for buying)
 */
export interface NetAfterFee {
  /** Net amount after fee deduction (goes to swap) */
  netAmount: bigint;
  /** Total fee charged */
  fee: bigint;
  /** Fee allocated to vault */
  vaultFee: bigint;
  /** Fee allocated to liquidity pool */
  lpFee: bigint;
}

/**
 * Result of calculating net payout after fee deduction (for selling)
 */
export interface NetPayout {
  /** Net payout to user after fee deduction */
  netPayout: bigint;
  /** Total fee charged */
  fee: bigint;
  /** Fee allocated to vault */
  vaultFee: bigint;
  /** Fee allocated to liquidity pool */
  lpFee: bigint;
}

/**
 * Calculate fee with CEILING rounding (favors house)
 * 
 * Formula: ceil(amount × FEE_RATE_BP / BP_DIVISOR)
 * Ceiling division: (a × b + c - 1) / c
 * 
 * @param amount Gross amount to calculate fee on
 * @returns Fee amount (ceiling rounded)
 * 
 * @example
 * calculateFee(100_000n) // 2% of 100,000
 * // = ceil(100,000 × 200 / 10,000)
 * // = ceil(20,000,000 / 10,000)
 * // = 2,000n
 */
export function calculateFee(amount: bigint): bigint {
  if (amount < 0n) {
    throw new Error('Amount cannot be negative');
  }

  if (amount === 0n) {
    return 0n;
  }

  // Ceiling division: (a × b + c - 1) / c
  // This ensures we always round up
  const numerator = amount * FEE_RATE_BP;
  return (numerator + BP_DIVISOR - 1n) / BP_DIVISOR;
}

/**
 * Split fee between vault and liquidity pool
 * 
 * Split: 50% vault, 50% LP
 * Remainder (if any) goes to LP to ensure total is preserved
 * 
 * @param totalFee Total fee to split
 * @returns Fee split between vault and LP
 * 
 * @example
 * splitFee(2_000n)
 * // vaultFee = 2,000 × 5,000 / 10,000 = 1,000
 * // lpFee = 2,000 - 1,000 = 1,000
 * // { vaultFee: 1_000n, lpFee: 1_000n }
 * 
 * @example
 * splitFee(2_001n) // Odd number
 * // vaultFee = 2,001 × 5,000 / 10,000 = 1,000 (floor)
 * // lpFee = 2,001 - 1,000 = 1,001 (gets remainder)
 * // { vaultFee: 1_000n, lpFee: 1_001n }
 */
export function splitFee(totalFee: bigint): FeeSplit {
  if (totalFee < 0n) {
    throw new Error('Total fee cannot be negative');
  }

  if (totalFee === 0n) {
    return { vaultFee: 0n, lpFee: 0n };
  }

  // Calculate vault fee (floor division, automatic with BigInt)
  const vaultFee = (totalFee * FEE_VAULT_SHARE_BP) / BP_DIVISOR;

  // LP gets the remainder to ensure total is preserved
  const lpFee = totalFee - vaultFee;

  return { vaultFee, lpFee };
}

/**
 * Calculate net amount after fee deduction (for buying)
 * 
 * Used when buying shares:
 * 1. User provides gross amount
 * 2. Fee is deducted (ceiling rounded)
 * 3. Net amount goes to CPMM swap
 * 4. Fee is split between vault and LP
 * 
 * @param grossAmount Gross amount provided by user
 * @returns Net amount and fee breakdown
 * 
 * @example
 * calculateNetAfterFee(100_000n)
 * // fee = 2,000 (2% ceiling)
 * // netAmount = 100,000 - 2,000 = 98,000
 * // vaultFee = 1,000, lpFee = 1,000
 * // {
 * //   netAmount: 98_000n,
 * //   fee: 2_000n,
 * //   vaultFee: 1_000n,
 * //   lpFee: 1_000n
 * // }
 */
export function calculateNetAfterFee(grossAmount: bigint): NetAfterFee {
  if (grossAmount < 0n) {
    throw new Error('Gross amount cannot be negative');
  }

  const fee = calculateFee(grossAmount);
  const netAmount = grossAmount - fee;
  const { vaultFee, lpFee } = splitFee(fee);

  return {
    netAmount,
    fee,
    vaultFee,
    lpFee,
  };
}

/**
 * Calculate net payout after fee deduction (for selling)
 * 
 * Used when selling shares:
 * 1. CPMM swap calculates gross payout
 * 2. Fee is deducted from payout (ceiling rounded)
 * 3. Net payout goes to user (floor rounded, automatic)
 * 4. Fee is split between vault and LP
 * 
 * @param grossPayout Gross payout from CPMM swap
 * @returns Net payout and fee breakdown
 * 
 * @example
 * calculateNetPayout(100_000n)
 * // fee = 2,000 (2% ceiling)
 * // netPayout = 100,000 - 2,000 = 98,000 (floor, automatic)
 * // vaultFee = 1,000, lpFee = 1,000
 * // {
 * //   netPayout: 98_000n,
 * //   fee: 2_000n,
 * //   vaultFee: 1_000n,
 * //   lpFee: 1_000n
 * // }
 */
export function calculateNetPayout(grossPayout: bigint): NetPayout {
  if (grossPayout < 0n) {
    throw new Error('Gross payout cannot be negative');
  }

  const fee = calculateFee(grossPayout);
  // Floor rounding is automatic with BigInt subtraction
  const netPayout = grossPayout - fee;
  const { vaultFee, lpFee } = splitFee(fee);

  return {
    netPayout,
    fee,
    vaultFee,
    lpFee,
  };
}
