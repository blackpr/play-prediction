import { useEffect, useState } from 'react'
import { cn } from '../../utils'

interface StatCardProps {
  label: string
  value: string | number
  previousValue?: string | number
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  className?: string
  animate?: boolean
}

export function StatCard({
  label,
  value,
  previousValue,
  trend = 'neutral',
  icon,
  className,
  animate = true
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isFlashing, setIsFlashing] = useState(false)

  useEffect(() => {
    if (animate && previousValue !== undefined && previousValue !== value) {
      setIsFlashing(true)
      const timer = setTimeout(() => {
        setDisplayValue(value)
        setIsFlashing(false)
      }, 150)
      return () => clearTimeout(timer)
    } else {
      setDisplayValue(value)
    }
  }, [value, previousValue, animate])

  return (
    <div className={cn(
      'data-card rounded-lg p-6 transition-all duration-300',
      'hover:border-accent-cyan/50 hover:shadow-glow-cyan',
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-text-muted text-sm font-medium uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className="text-accent-cyan opacity-60">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-3">
        <span className={cn(
          'text-data text-3xl font-bold text-text',
          isFlashing && 'animate-number-flash'
        )}>
          {displayValue}
        </span>

        {trend !== 'neutral' && (
          <span className={cn(
            'text-sm font-bold flex items-center gap-1',
            trend === 'up' ? 'text-yes' : 'text-no'
          )}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  )
}
