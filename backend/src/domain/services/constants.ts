/**
 * Domain constants for CPMM trading engine
 * 
 * These constants are used across the domain layer for calculations
 * and type definitions. All values use BigInt for precision.
 */

/**
 * Price precision for display (6 decimal places)
 * 1.0 = 1_000_000n in PRICE_PRECISION units
 * 0.5 = 500_000n
 * 0.123456 = 123_456n
 */
export const PRICE_PRECISION = 1_000_000n;

/**
 * Fee rate in basis points (200 = 2.00%)
 */
export const FEE_RATE_BP = 200n;

/**
 * Basis points divisor (10,000 basis points = 100%)
 */
export const BP_DIVISOR = 10_000n;

/**
 * Fee split: 50% to vault
 */
export const FEE_VAULT_SHARE_BP = 5_000n;

/**
 * Fee split: 50% to liquidity pool
 */
export const FEE_LP_SHARE_BP = 5_000n;

/**
 * Minimum trade size in MicroPoints ($0.001)
 */
export const MIN_TRADE_SIZE = 1_000n;

/**
 * Trade sides for binary markets
 */
export type Side = 'YES' | 'NO';
