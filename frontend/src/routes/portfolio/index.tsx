import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../utils/auth'
import { usePortfolio } from '../../hooks/usePortfolio'
import { PositionCard } from '../../components/portfolio/PositionCard'
import { TradeHistory } from '../../components/portfolio/TradeHistory'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatPoints } from '../../lib/format'
import { Loader2, TrendingUp, Wallet } from 'lucide-react'

export const Route = createFileRoute('/portfolio/')({
  beforeLoad: ({ location }) => requireAuth({ location }),
  component: PortfolioIndex,
})

function PortfolioIndex() {
  const { data: portfolio, isLoading, error } = usePortfolio()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-400 mb-2">Failed to load portfolio</div>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <EmptyState
          icon={<Wallet className="w-full h-full" />}
          title="You don't have any positions yet"
          description="Start trading to build your portfolio"
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
      </div>
    )
  }

  const totalPnl = BigInt(portfolio.unrealizedPnL)
  const isPositive = totalPnl >= 0n

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
      {/* Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <div className="text-gray-400 text-sm mb-1">Total Portfolio Value</div>
          <div className="text-2xl font-bold">{formatPoints(portfolio.totalValue)} pts</div>
        </div>
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <div className="text-gray-400 text-sm mb-1">Total Cost Basis</div>
          <div className="text-2xl font-bold">{formatPoints(portfolio.totalCostBasis)} pts</div>
        </div>
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <div className="text-gray-400 text-sm mb-1">Unrealized P&L</div>
          <div className={`text-2xl font-bold flex items-center gap-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            <TrendingUp className={`w-5 h-5 ${!isPositive && 'rotate-180'}`} />
            {isPositive ? '+' : ''}{formatPoints(portfolio.unrealizedPnL)} pts
          </div>
        </div>
      </div>

      {/* Positions Grid */}
      <div>
        <h2 className="text-xl font-bold mb-4">Your Positions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolio.positions.map((position) => (
            <PositionCard key={position.market.id} position={position} />
          ))}
        </div>
      </div>

      {/* Trade History */}
      <div>
        <h2 className="text-xl font-bold mb-4">Trade History</h2>
        <TradeHistory />
      </div>
    </div>
  )
}
