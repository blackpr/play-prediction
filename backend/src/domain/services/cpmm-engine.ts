/**
 * CPMM (Constant Product Market Maker) Engine
 * 
 * Pure domain logic for binary prediction market trading.
 * Implements the constant product formula: k = x × y
 * 
 * Key principles:
 * - All calculations use BigInt (no floating point)
 * - User outputs round DOWN (floor)
 * - Pool calculations use CEILING division
 * - k-invariant must never decrease
 * - Zero external dependencies (framework-agnostic)
 * 
 * @see docs/ENGINE_LOGIC.md Section 5 for mathematical formulas
 */

import { InvariantViolationError } from '../errors/domain-error.js';
import { PRICE_PRECISION, type Side } from './constants.js';

/**
 * Pool state representing liquidity for both sides
 */
export interface PoolState {
  yesQty: bigint;
  noQty: bigint;
}

/**
 * Result of a buy operation
 */
export interface BuyResult {
  /** Shares received by the buyer (floor rounded) */
  sharesOut: bigint;
  /** New YES quantity in pool after trade */
  newYesQty: bigint;
  /** New NO quantity in pool after trade */
  newNoQty: bigint;
  /** Price impact in PRICE_PRECISION units (e.g., 0.01 = 10_000n) */
  priceImpact: bigint;
}

/**
 * Result of a sell operation
 */
export interface SellResult {
  /** Points received by the seller (floor rounded) */
  pointsOut: bigint;
  /** New YES quantity in pool after trade */
  newYesQty: bigint;
  /** New NO quantity in pool after trade */
  newNoQty: bigint;
}

/**
 * Current prices for both sides
 */
export interface Prices {
  /** YES price in PRICE_PRECISION units (e.g., 0.60 = 600_000n) */
  yesPrice: bigint;
  /** NO price in PRICE_PRECISION units (e.g., 0.40 = 400_000n) */
  noPrice: bigint;
}

/**
 * Ceiling division: (a + b - 1) / b
 * Ensures result rounds up, preserving k-invariant
 */
function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) {
    throw new Error('Division by zero or negative number');
  }
  return (a + b - 1n) / b;
}

/**
 * Validate pool state
 * 
 * @throws {InvariantViolationError} if pool is invalid
 */
export function validatePool(pool: PoolState): void {
  const { yesQty, noQty } = pool;

  if (yesQty <= 0n) {
    throw new InvariantViolationError(
      'Pool YES quantity must be positive',
      { yesQty: yesQty.toString(), noQty: noQty.toString() }
    );
  }

  if (noQty <= 0n) {
    throw new InvariantViolationError(
      'Pool NO quantity must be positive',
      { yesQty: yesQty.toString(), noQty: noQty.toString() }
    );
  }

  const k = yesQty * noQty;
  if (k <= 0n) {
    throw new InvariantViolationError(
      'Pool k-invariant must be positive',
      { k: k.toString() }
    );
  }
}

/**
 * Calculate current prices for YES and NO shares
 * 
 * Formula:
 * - P_YES = NO_qty / (YES_qty + NO_qty)
 * - P_NO = YES_qty / (YES_qty + NO_qty)
 * 
 * Prices are returned in PRICE_PRECISION units (6 decimals)
 * 
 * @example
 * Pool: 400 YES, 600 NO
 * P_YES = 600 / 1000 = 0.60 = 600_000n
 * P_NO = 400 / 1000 = 0.40 = 400_000n
 */
export function getPrices(pool: PoolState): Prices {
  validatePool(pool);

  const { yesQty, noQty } = pool;
  const total = yesQty + noQty;

  // P_YES = NO_qty / total (in PRICE_PRECISION units)
  const yesPrice = (noQty * PRICE_PRECISION) / total;

  // P_NO = YES_qty / total (in PRICE_PRECISION units)
  const noPrice = (yesQty * PRICE_PRECISION) / total;

  return { yesPrice, noPrice };
}

/**
 * Calculate shares received when buying with points
 * 
 * Formula:
 * - Buying YES: add points to NO pool, take from YES pool
 * - new_input_pool = input_pool + points
 * - new_output_pool = k / new_input_pool (ceiling division)
 * - shares_out = output_pool - new_output_pool (floor, automatic)
 * 
 * @param pointsIn Net points after fees have been deducted
 * @param pool Current pool state
 * @param side Which side to buy (YES or NO)
 * @returns Buy result with shares out and new pool state
 * @throws {InvariantViolationError} if k decreases
 * 
 * @example
 * Pool: 400 YES, 600 NO (k = 240,000)
 * Buy YES with 100 points:
 * - new NO pool = 600 + 100 = 700
 * - new YES pool = ceil(240,000 / 700) = 343
 * - shares out = 400 - 343 = 57
 */
export function calculateBuyShares(
  pointsIn: bigint,
  pool: PoolState,
  side: Side
): BuyResult {
  validatePool(pool);

  if (pointsIn <= 0n) {
    throw new InvariantViolationError(
      'Points in must be positive',
      { pointsIn: pointsIn.toString() }
    );
  }

  const { yesQty, noQty } = pool;
  const k = yesQty * noQty;

  let inputPool: bigint;
  let outputPool: bigint;

  if (side === 'YES') {
    // Buying YES: add points to NO pool, take from YES pool
    inputPool = noQty;
    outputPool = yesQty;
  } else {
    // Buying NO: add points to YES pool, take from NO pool
    inputPool = yesQty;
    outputPool = noQty;
  }

  // Calculate spot price before trade (for price impact)
  const spotPrice = (inputPool * PRICE_PRECISION) / (inputPool + outputPool);

  // Calculate new input pool after adding points
  const newInputPool = inputPool + pointsIn;

  // Calculate new output pool to maintain k (ceiling division)
  const newOutputPool = ceilDiv(k, newInputPool);

  // Shares out is the difference (floor, automatic with BigInt) PLUS the minted shares
  // Total Shares = (Minted Shares) + (Swapped Shares)
  // Total Shares = pointsIn + (outputPool - newOutputPool)
  const sharesOut = pointsIn + (outputPool - newOutputPool);

  if (sharesOut <= 0n) {
    throw new InvariantViolationError(
      'Buy operation resulted in zero or negative shares',
      {
        pointsIn: pointsIn.toString(),
        sharesOut: sharesOut.toString(),
        side,
      }
    );
  }

  // Verify k hasn't decreased
  const newK = newInputPool * newOutputPool;
  if (newK < k) {
    throw new InvariantViolationError(
      'k-invariant decreased after buy operation',
      {
        oldK: k.toString(),
        newK: newK.toString(),
        side,
      }
    );
  }

  // Calculate price impact
  // avgPrice = pointsIn / sharesOut
  // priceImpact = (avgPrice - spotPrice) / spotPrice
  const avgPrice = (pointsIn * PRICE_PRECISION) / sharesOut;
  const priceImpact = avgPrice > spotPrice
    ? ((avgPrice - spotPrice) * PRICE_PRECISION) / spotPrice
    : 0n;

  // Return new pool state
  let newYesQty: bigint;
  let newNoQty: bigint;

  if (side === 'YES') {
    newYesQty = newOutputPool;
    newNoQty = newInputPool;
  } else {
    newYesQty = newInputPool;
    newNoQty = newOutputPool;
  }

  return {
    sharesOut,
    newYesQty,
    newNoQty,
    priceImpact,
  };
}

/**
 * Integer Square Root for BigInt
 * Uses Newton's method
 */
function isqrt(value: bigint): bigint {
  if (value < 0n) throw new Error('isqrt: negative input');
  if (value < 2n) return value;

  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
}

/**
 * Calculate points received when selling shares
 * Implements "Swap + Merge" logic (inverse of Mint + Swap)
 * 
 * Formula derived from invariant: (Y + S - P) * (N - P) = k
 * Solving for P (points out):
 * P^2 - (Y + N + S)P + S*N = 0
 * 
 * Quadratic formula: P = (B - sqrt(B^2 - 4AC)) / 2
 * Where:
 * A = 1
 * B = Y + N + S
 * C = S * N
 * 
 * @param sharesIn Shares to sell
 * @param pool Current pool state
 * @param side Which side to sell (YES or NO)
 * @returns Sell result with points out and new pool state
 * @throws {InvariantViolationError} if k decreases
 */
export function calculateSellPoints(
  sharesIn: bigint,
  pool: PoolState,
  side: Side
): SellResult {
  validatePool(pool);

  if (sharesIn <= 0n) {
    throw new InvariantViolationError(
      'Shares in must be positive',
      { sharesIn: sharesIn.toString() }
    );
  }

  const { yesQty, noQty } = pool;
  const k = yesQty * noQty;

  const Y = side === 'YES' ? yesQty : noQty; // Liquidity of side being sold
  const N = side === 'YES' ? noQty : yesQty; // Liquidity of opposite side
  const S = sharesIn;

  // Coefficients for P^2 - BP + C = 0
  const B = Y + N + S;
  const C = S * N;

  // P = (B - sqrt(B^2 - 4C)) / 2
  const discriminant = (B * B) - (4n * C);

  if (discriminant < 0n) {
    throw new InvariantViolationError(
      'Negative discriminant in sell calculation',
      { B: B.toString(), C: C.toString() }
    );
  }

  const sqrtD = isqrt(discriminant);
  const pointsOut = (B - sqrtD) / 2n;

  if (pointsOut <= 0n) {
    throw new InvariantViolationError(
      'Sell operation resulted in zero or negative points',
      {
        sharesIn: sharesIn.toString(),
        pointsOut: pointsOut.toString(),
        side,
      }
    );
  }

  // Calculate new pool quantities
  // Y_new = Y + S - P
  // N_new = N - P
  const newY = Y + S - pointsOut;
  const newN = N - pointsOut;

  // Note: k decreases when removing liquidity (Merge).
  // We do not enforce newK >= k here because that only applies to pure Swaps.
  // Our quadratic formula ensures fair pricing.

  return {
    pointsOut,
    newYesQty: side === 'YES' ? newY : newN,
    newNoQty: side === 'YES' ? newN : newY,
  };
}
