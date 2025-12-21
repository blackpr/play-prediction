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
 * Trade sides for binary markets
 */
export type Side = 'YES' | 'NO';
