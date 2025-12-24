import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { formatPoints } from '../../lib/format'

interface PositionCardProps {
  position: {
    market: {
      id: string
      title: string
      status: string
      yesPrice: string
      noPrice: string
    }
    yesQty: string
    noQty: string
    currentValue: string
    unrealizedPnL: string
  }
}

export function PositionCard({ position }: PositionCardProps) {
  const pnl = BigInt(position.unrealizedPnL)
  const isPositive = pnl >= 0n

  return (
    <Card className="hover:border-blue-500/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-4">
          <Link
            to="/markets/$marketId"
            params={{ marketId: position.market.id }}
            className="font-medium text-lg hover:text-blue-400 line-clamp-2"
          >
            {position.market.title}
          </Link>
          <div className="flex flex-col items-end">
            <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
              {isPositive ? '+' : ''}{formatPoints(pnl.toString())}
            </span>
            <span className="text-xs text-gray-400">P&L</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400 mb-1">Holdings</div>
            {BigInt(position.yesQty) > 0n && (
              <div className="flex items-center gap-2 text-yes">
                <span className="font-medium">YES</span>
                <span>{formatPoints(position.yesQty)}</span>
              </div>
            )}
            {BigInt(position.noQty) > 0n && (
              <div className="flex items-center gap-2 text-no">
                <span className="font-medium">NO</span>
                <span>{formatPoints(position.noQty)}</span>
              </div>
            )}
          </div>
          <div>
            <div className="text-gray-400 mb-1">Current Value</div>
            <div className="font-medium">{formatPoints(position.currentValue)} pts</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
