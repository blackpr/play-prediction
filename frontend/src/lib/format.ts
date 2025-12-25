export const MICRO_POINTS_SCALE = 1_000_000n

/**
 * Formats micro-points to a standard "1,000.00" string.
 * Handles string, number, or BigInt input.
 * Returns "0.00" if input is null or undefined.
 */
export function formatPoints(
  microPoints: number | string | bigint | undefined | null,
): string {
  if (microPoints === undefined || microPoints === null) return '0.00'

  try {
    const value = BigInt(microPoints)
    // Convert to number for formatting (JS number precision is safe for < 9 quadrillion)
    // 1 trillion points = 10^12 * 10^6 = 10^18 (might lose precision if very large)
    // But for display purposes, standard Number is usually fine.
    // If we need strict precision for display of huge numbers, we'd need a custom formatter.
    // For now, dividing by scale as number is simplest.
    const points = Number(value) / Number(MICRO_POINTS_SCALE)
    const absPoints = Math.abs(points)

    // For very small numbers that would round to 0.00, show more precision
    const isSmall = absPoints > 0 && absPoints < 0.01

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: isSmall ? 6 : 2,
    }).format(points)
  } catch (e) {
    console.error('Error formatting points:', e)
    return '0.00'
  }
}

/**
 * Formats micro-points to a compact string (e.g., "10K", "1.5M").
 */
export function formatCompactPoints(
  microPoints: number | string | bigint | undefined | null,
): string {
  if (microPoints === undefined || microPoints === null) return '0'

  try {
    const value = BigInt(microPoints)
    const points = Number(value) / Number(MICRO_POINTS_SCALE)

    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(points)
  } catch (e) {
    return '0'
  }
}

/**
 * Parses a string input (e.g., "1,000.50") into micro-points (BigInt).
 * Returns 0n on error/invalid input.
 */
export function parsePoints(input: string): bigint {
  if (!input) return 0n

  try {
    // Remove non-numeric characters except dot
    const cleaned = input.replace(/[^0-9.]/g, '')

    // Split into whole and fraction
    const parts = cleaned.split('.')
    const wholeStr = parts[0] || '0'
    let fractionStr = parts[1] || ''

    // Normalize fraction to 6 digits (micro-points)
    if (fractionStr.length > 6) {
      fractionStr = fractionStr.slice(0, 6) // Truncate extra decimals
    } else {
      fractionStr = fractionStr.padEnd(6, '0') // Pad with zeros
    }

    const whole = BigInt(wholeStr)
    const fraction = BigInt(fractionStr)

    return whole * MICRO_POINTS_SCALE + fraction
  } catch (e) {
    console.error('Error parsing points:', e)
    return 0n
  }
}
