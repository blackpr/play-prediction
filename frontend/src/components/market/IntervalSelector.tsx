import { cn } from '../../utils'

export type ChartInterval = '1H' | '24H' | '7D' | '30D' | 'All'

interface IntervalSelectorProps {
  selected: ChartInterval
  onSelect: (interval: ChartInterval) => void
  disabledIntervals?: Array<ChartInterval>
  className?: string
}

const intervals: Array<ChartInterval> = ['1H', '24H', '7D', '30D', 'All']

export function IntervalSelector({
  selected,
  onSelect,
  disabledIntervals = [],
  className,
}: IntervalSelectorProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {intervals.map((interval) => {
        const isSelected = selected === interval
        const isDisabled = disabledIntervals.includes(interval)

        return (
          <button
            key={interval}
            onClick={() => !isDisabled && onSelect(interval)}
            disabled={isDisabled}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950',
              isSelected
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : isDisabled
                  ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            )}
            title={
              isDisabled
                ? 'Insufficient data for this time range'
                : `View ${interval} price history`
            }
          >
            {interval}
          </button>
        )
      })}
    </div>
  )
}
