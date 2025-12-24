import { cn } from '../../utils'

interface LiveTickerProps {
  items: Array<{ label: string; value: string | number; trend?: 'up' | 'down' }>
  className?: string
}

export function LiveTicker({ items, className }: LiveTickerProps) {
  // Duplicate items for seamless loop
  const duplicatedItems = [...items, ...items]

  return (
    <div className={cn('relative overflow-hidden bg-surface border-y border-surface-highlight', className)}>
      <div className="animate-ticker flex gap-12 py-3 px-6">
        {duplicatedItems.map((item, index) => (
          <div key={index} className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-text-muted text-sm font-medium uppercase tracking-wider">
              {item.label}
            </span>
            <span className="text-data text-lg font-semibold text-accent-cyan">
              {item.value}
            </span>
            {item.trend && (
              <span className={cn(
                'text-xs font-bold',
                item.trend === 'up' ? 'text-yes' : 'text-no'
              )}>
                {item.trend === 'up' ? '↑' : '↓'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
