import { clsx } from 'clsx'
import { cn } from '../../utils'

interface ProbabilityBarProps {
  yesPercent: number // 0-100
  showLabels?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'h-2 text-xs',
  md: 'h-3 text-sm',
  lg: 'h-4 text-base',
}

export function ProbabilityBar({
  yesPercent,
  showLabels = false,
  size = 'md',
  className,
}: ProbabilityBarProps) {
  // Ensure valid percentage (handle potential NaN from API)
  const saneYesPercent = isNaN(yesPercent) ? 50 : Math.min(100, Math.max(0, yesPercent))
  const saneNoPercent = 100 - saneYesPercent

  return (
    <div className={cn('space-y-1', className)}>
      {showLabels && (
        <div className="flex justify-between text-sm font-medium">
          <span className="text-emerald-400">
            Yes {saneYesPercent.toFixed(0)}%
          </span>
          <span className="text-rose-400">
            No {saneNoPercent.toFixed(0)}%
          </span>
        </div>
      )}

      <div
        className={clsx(
          'w-full flex overflow-hidden rounded-full bg-rose-500/20',
          sizeStyles[size].split(' ')[0] // extract height class
        )}
      >
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${saneYesPercent}%` }}
        />
        <div
          className="bg-rose-500 transition-all duration-500"
          style={{ width: `${saneNoPercent}%` }}
        />
      </div>
    </div>
  )
}
