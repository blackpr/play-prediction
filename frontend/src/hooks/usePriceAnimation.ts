import { useEffect, useRef, useState } from 'react'

/**
 * Hook to detect when a value changes and trigger a flash animation
 * Returns a boolean that's true for a brief moment when the value changes
 */
export function usePriceFlash(value: string | number | undefined, duration = 1000) {
  const [isFlashing, setIsFlashing] = useState(false)
  const prevValueRef = useRef(value)

  useEffect(() => {
    if (prevValueRef.current !== undefined && prevValueRef.current !== value) {
      setIsFlashing(true)
      const timer = setTimeout(() => setIsFlashing(false), duration)
      return () => clearTimeout(timer)
    }
    prevValueRef.current = value
  }, [value, duration])

  return isFlashing
}

/**
 * Hook to detect price direction (up or down)
 * Returns 'up', 'down', or null
 */
export function usePriceDirection(value: string | number | undefined) {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)
  const prevValueRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value

    if (prevValueRef.current !== undefined && numValue !== undefined && !isNaN(numValue)) {
      if (numValue > prevValueRef.current) {
        setDirection('up')
      } else if (numValue < prevValueRef.current) {
        setDirection('down')
      }

      // Clear direction after animation
      const timer = setTimeout(() => setDirection(null), 1000)
      return () => clearTimeout(timer)
    }

    prevValueRef.current = numValue
  }, [value])

  return direction
}
