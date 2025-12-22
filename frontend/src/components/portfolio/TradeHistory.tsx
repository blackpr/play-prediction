import { Link } from '@tanstack/react-router'
import { Loader2, History, ArrowUpRight, ArrowDownRight, Coins, Merge } from 'lucide-react'
import { useTradeHistory } from '../../hooks/useTradeHistory'
import { formatPoints } from '../../lib/format'
import { EmptyState } from '../ui/EmptyState'
import type { TradeHistoryItem } from '../../api/types'

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

function getActionIcon(action: string) {
  switch (action) {
    case 'BUY':
      return <ArrowUpRight className="w-4 h-4" />
    case 'SELL':
      return <ArrowDownRight className="w-4 h-4" />
    case 'MINT':
      return <Coins className="w-4 h-4" />
    case 'MERGE':
      return <Merge className="w-4 h-4" />
    default:
      return null
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'BUY':
      return 'text-green-400 bg-green-400/10'
    case 'SELL':
      return 'text-red-400 bg-red-400/10'
    case 'MINT':
      return 'text-blue-400 bg-blue-400/10'
    case 'MERGE':
      return 'text-purple-400 bg-purple-400/10'
    default:
      return 'text-gray-400 bg-gray-400/10'
  }
}

function TradeHistoryRow({ trade }: { trade: TradeHistoryItem }) {
  const actionColor = getActionColor(trade.action)
  const actionIcon = getActionIcon(trade.action)

  return (
    <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <Link
            to="/markets/$marketId"
            params={{ marketId: trade.marketId }}
            className="font-medium hover:text-blue-400 line-clamp-1 block mb-1"
          >
            {trade.marketTitle}
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${actionColor}`}>
              {actionIcon}
              {trade.action}
            </span>
            {trade.side && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${trade.side === 'YES' ? 'text-yes bg-yes/10' : 'text-no bg-no/10'
                }`}>
                {trade.side}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-gray-400">
          {formatRelativeTime(trade.createdAt)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-gray-500 text-xs mb-0.5">Amount In</div>
          <div className="font-medium">{formatPoints(trade.amountIn)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-0.5">Amount Out</div>
          <div className="font-medium">{formatPoints(trade.amountOut)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-0.5">Fee</div>
          <div className="font-medium text-gray-400">{formatPoints(trade.feePaid)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-0.5">Price</div>
          <div className="font-medium">{trade.priceAtExecution}</div>
        </div>
      </div>
    </div>
  )
}

export function TradeHistory() {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTradeHistory({ pageSize: 20 })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <div className="text-red-400 mb-2">Failed to load trade history</div>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-400 hover:text-blue-300 underline text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  const allTrades = data?.pages.flatMap((page) => page.items) ?? []

  if (allTrades.length === 0) {
    return (
      <EmptyState
        icon={<History className="w-full h-full" />}
        title="No trades yet"
        description="Your trade history will appear here once you start trading"
        action={{
          label: 'Explore Markets',
          to: '/markets',
          search: {
            page: 1,
            pageSize: 20,
            sort: 'createdAt',
            order: 'desc',
          },
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      {allTrades.map((trade) => (
        <TradeHistoryRow key={trade.id} trade={trade} />
      ))}

      {hasNextPage && (
        <div className="text-center pt-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
