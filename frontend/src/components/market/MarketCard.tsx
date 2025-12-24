import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Clock, TrendingUp, Zap } from 'lucide-react'
import { formatCompactPoints } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { ProbabilityBar } from './ProbabilityBar'
import type { BadgeVariant } from '../ui/Badge';
import type { Market } from '../../api/types'

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

  const yesPercent = Math.round(Number(market.yesPrice) * 100)
  const noPercent = Math.round(Number(market.noPrice) * 100)

  const displayYes = isNaN(yesPercent) ? 50 : yesPercent
  const displayNo = isNaN(noPercent) ? 50 : noPercent

  const timeLabel = market.closesAt
    ? isActive
      ? formatDistanceToNow(new Date(market.closesAt), { addSuffix: true })
      : formatDistanceToNow(new Date(market.closesAt), { addSuffix: true })
    : 'No closing date'

  return (
    <Link
      to="/markets/$marketId"
      params={{ marketId: market.id }}
      className="block group"
    >
      <div className="data-card rounded-xl p-5 h-full flex flex-col transition-all duration-300 hover:border-accent-cyan/50 hover:shadow-glow-cyan relative overflow-hidden">
        {/* Subtle scan line effect on hover */}
        <div className="scan-line opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          {/* Image */}
          {market.imageUrl ? (
            <img
              src={market.imageUrl}
              alt={market.title}
              className="w-14 h-14 rounded-lg object-cover border-2 border-surface-highlight group-hover:border-accent-cyan/50 transition-colors flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-surface-highlight flex items-center justify-center text-text-dim border-2 border-surface-highlight group-hover:border-accent-cyan/50 transition-colors flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
          )}

          {/* Title & Status */}
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-text leading-tight mb-2 line-clamp-2 group-hover:text-accent-cyan transition-colors">
              {market.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={badgeVariant} className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5">
                {market.status}
              </Badge>
              {market.category && (
                <span className="text-xs text-text-dim font-mono">
                  {market.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="mb-4">
          <ProbabilityBar
            yesPercent={displayYes}
            size="lg"
            className="h-10"
          />
          <div className="flex justify-between mt-2 text-sm font-mono font-bold">
            <span className="text-yes">YES {displayYes}%</span>
            <span className="text-no">NO {displayNo}%</span>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-auto pt-4 border-t border-surface-highlight flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-text-muted font-mono">
            <Zap className="w-3.5 h-3.5 text-accent-amber" />
            <span className="text-text-dim">Vol:</span>
            <span className="text-data text-text font-bold">
              {formatCompactPoints(market.volume24h)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-text-muted font-mono">
            <Clock className="w-3.5 h-3.5 text-accent-cyan" />
            <span className="text-text-dim">{timeLabel}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
