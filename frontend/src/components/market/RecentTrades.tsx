import { formatDistanceToNow } from 'date-fns'
import type { RecentTrade } from '../../api/types'
import { useMarketTrades } from '../../hooks/useMarketTrades'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'

interface RecentTradesProps {
  marketId: string
}

export function RecentTrades({ marketId }: RecentTradesProps) {
  const { data: trades, isLoading } = useMarketTrades(marketId, 15)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex justify-between py-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!trades || trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No trades yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-2 font-medium text-gray-500">Time</th>
                <th className="text-left py-2 px-2 font-medium text-gray-500">Side</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500">Amount</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500">Price</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function TradeRow({ trade }: { trade: RecentTrade }) {
  const sideColor = trade.side === 'YES' ? 'text-green-400' : 'text-red-400'
  const sideBg = trade.side === 'YES' ? 'bg-green-500/10' : 'bg-red-500/10'

  // Convert MicroPoints to Points (divide by 1,000,000)
  const amountInPoints = (parseInt(trade.amountIn) / 1_000_000).toFixed(2)
  const pricePercent = (parseInt(trade.priceAtExecution) / 10_000).toFixed(1)

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
      <td className="py-2 px-2 text-gray-400 text-xs">
        {formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })}
      </td>
      <td className="py-2 px-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sideBg} ${sideColor}`}>
          {trade.side}
        </span>
      </td>
      <td className="py-2 px-2 text-right font-medium text-gray-300">
        {amountInPoints} pts
      </td>
      <td className="py-2 px-2 text-right text-gray-400">
        {pricePercent}%
      </td>
    </tr>
  )
}
