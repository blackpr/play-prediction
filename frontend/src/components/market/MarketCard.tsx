import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import type { Market } from '../../api/types'
import { formatCompactPoints } from '../../lib/format'
import { Badge, type BadgeVariant } from '../ui/Badge'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/Card'
import { cn } from '../../utils'

interface MarketCardProps {
  market: Market
}

export function MarketCard({ market }: MarketCardProps) {
  const isResolved = market.status === 'RESOLVED'
  const isCancelled = market.status === 'CANCELLED'
  const isActive = market.status === 'ACTIVE'

  let badgeVariant: BadgeVariant = 'default'
  if (isActive) badgeVariant = 'success'
  if (isResolved) badgeVariant = 'info'
  if (isCancelled) badgeVariant = 'error'

  const yesPercent = Math.round(Number(market.pool.yesPrice) * 100)
  const noPercent = Math.round(Number(market.pool.noPrice) * 100)

  // Ensure they sum to 100 visually if active, or handles 0/0 edge cases
  const displayYes = isNaN(yesPercent) ? 50 : yesPercent
  const displayNo = isNaN(noPercent) ? 50 : noPercent

  const timeLabel = market.closesAt
    ? isActive
      ? `Ends ${formatDistanceToNow(new Date(market.closesAt), { addSuffix: true })}`
      : `Ended ${formatDistanceToNow(new Date(market.closesAt), { addSuffix: true })}`
    : 'No closing date'

  return (
    <Link
      to="/markets/$marketId"
      params={{ marketId: market.id }}
      className="block transition-transform hover:-translate-y-1"
    >
      <Card className="h-full overflow-hidden border-white/5 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={badgeVariant}>{market.status}</Badge>
            <span className="text-xs text-gray-400">{timeLabel}</span>
          </div>
          <CardTitle className="line-clamp-2 text-lg leading-tight">
            {market.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="pb-3">
          {/* Probability Bar */}
          <div className="mt-4 flex h-8 w-full overflow-hidden rounded-md text-sm font-medium">
            <div
              className={cn(
                "flex items-center justify-start pl-2 text-primary-foreground transition-all",
                "bg-emerald-500/80 text-white"
              )}
              style={{ width: `${displayYes}%` }}
            >
              YES {displayYes}%
            </div>
            <div
              className={cn(
                "flex items-center justify-end pr-2 transition-all",
                "bg-rose-500/80 text-white"
              )}
              style={{ width: `${100 - displayYes}%` }} // Fill remaining space
            >
              NO {displayNo}%
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t border-white/5 pt-4 text-xs text-gray-400">
          <div>
            <span className="mr-1">Vol:</span>
            <span className="font-mono text-gray-300">
              {formatCompactPoints(market.volume24h)}
            </span>
          </div>
          <div>{market.category}</div>
        </CardFooter>
      </Card>
    </Link>
  )
}
