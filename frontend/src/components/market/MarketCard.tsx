import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import type { Market } from '../../api/types'
import { formatCompactPoints } from '../../lib/format'
import { Badge, type BadgeVariant } from '../ui/Badge'
import {
  Card,
  CardFooter,
} from '../ui/Card'
import { ProbabilityBar } from './ProbabilityBar'

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

  const yesPercent = Math.round(Number(market.yesPrice ?? 0) * 100)
  const noPercent = Math.round(Number(market.noPrice ?? 0) * 100)

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
      <Card className="h-full overflow-hidden border-white/5 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10 flex flex-col p-4 group">
        <div className="flex gap-3 mb-3">
          {/* Image Icon */}
          <div className="flex-shrink-0">
            {market.imageUrl ? (
              <img
                src={market.imageUrl}
                alt={market.title}
                className="w-12 h-12 rounded bg-white/5 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center text-white/20">
                <span className="text-xs">No Img</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="flex-grow min-w-0">
            <h3 className="line-clamp-2 text-base font-semibold text-white leading-tight mb-1 group-hover:text-primary transition-colors">
              {market.title}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant={badgeVariant} className="text-[10px] px-1.5 h-5">{market.status}</Badge>
              <span className="text-xs text-gray-500">{timeLabel}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto px-4 pb-4">
          <ProbabilityBar
            yesPercent={displayYes}
            size="lg"
            className="h-8"
          />
          <div className="flex justify-between mt-1 text-xs font-medium text-gray-400">
            <span className="text-emerald-400">YES {displayYes}%</span>
            <span className="text-rose-400">NO {displayNo}%</span>
          </div>
        </div>

        <CardFooter className="flex justify-between border-t border-white/5 pt-3 pb-3 px-4 text-xs text-gray-400 mt-2 bg-white/5">
          <div className="flex items-center gap-4">
            <div>
              <span className="mr-1 text-gray-500">Vol:</span>
              <span className="font-mono text-gray-300">
                {formatCompactPoints(market.volume24h)}
              </span>
            </div>
            <div>{market.category}</div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
