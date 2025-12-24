import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'

export function PositionCardSkeleton() {
  return (
    <Card className="p-4">
      {/* Title */}
      <Skeleton className="h-6 w-3/4 mb-4" />

      {/* Positions */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-gray-800/50 rounded-lg space-y-2">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="p-3 bg-gray-800/50 rounded-lg space-y-2">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Footer P&L */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </Card>
  )
}
