import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'

export function MarketCardSkeleton() {
  return (
    <Card className="p-4">
      {/* Status badge and time */}
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Title */}
      <div className="space-y-2 mb-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>

      {/* Probability Bar */}
      <div className="space-y-1">
        <Skeleton className="h-3 w-full rounded-full" />
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </Card>
  )
}
