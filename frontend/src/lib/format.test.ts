
import { describe, it, expect } from 'vitest'
import { formatPoints, MICRO_POINTS_SCALE } from './format'

describe('formatPoints', () => {
  it('formats standard amounts', () => {
    expect(formatPoints(MICRO_POINTS_SCALE)).toBe('1.00')
    expect(formatPoints(MICRO_POINTS_SCALE * 123n)).toBe('123.00')
    expect(formatPoints(500000n)).toBe('0.50')
  })

  it('formats zero and undefined', () => {
    expect(formatPoints(0n)).toBe('0.00')
    expect(formatPoints(undefined)).toBe('0.00')
    expect(formatPoints(null)).toBe('0.00')
  })

  it('formats small amounts with high precision', () => {
    // 0.001 points (1000 micro points)
    expect(formatPoints(1000n)).toBe('0.001')

    // 0.0001 points (100 micro points)
    expect(formatPoints(100n)).toBe('0.0001')

    // 0.000001 points (1 micro point)
    expect(formatPoints(1n)).toBe('0.000001')
  })

  it('maintains standard precision for larger numbers', () => {
    // 1.001 points - should probably round to 1.00 with current logic
    expect(formatPoints(1001000n)).toBe('1.00')

    // 0.01 points - boundary case, should be 0.01
    expect(formatPoints(10000n)).toBe('0.01')
  })
})
