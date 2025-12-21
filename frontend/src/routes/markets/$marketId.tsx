import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  marketQueryOptions,
  priceHistoryQueryOptions,
} from '../../hooks/useMarkets'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ProbabilityBar } from '../../components/market/ProbabilityBar'
import { PriceChart } from '../../components/market/PriceChart'
import { formatCompactPoints } from '../../lib/format'
import { ArrowLeft, Clock, TrendingUp, BarChart2, Users, Activity } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Spinner } from '../../components/ui/Spinner'

export const Route = createFileRoute('/markets/$marketId')({
  loader: async ({ context: { queryClient }, params: { marketId } }) => {
    // Prefetch market data
    await queryClient.ensureQueryData(marketQueryOptions(marketId))
    // Prefetch initial price history (1h interval default)
    await queryClient.ensureQueryData(priceHistoryQueryOptions(marketId, '1h'))
  },
  component: MarketDetailPage,
})

function MarketDetailPage() {
  const { marketId } = Route.useParams()

  // Fetch Market Data
  const { data: market, isLoading: isMarketLoading, error: marketError } = useQuery(
    marketQueryOptions(marketId)
  )

  // Fetch Price History (default 1h for now)
  const { data: history, isLoading: isHistoryLoading } = useQuery(
    priceHistoryQueryOptions(marketId, '1h')
  )

  if (isMarketLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (marketError || !market) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Market Not Found</h2>
        <p className="text-gray-400 mb-8">
          The market you are looking for does not exist or has been removed.
        </p>
        <Link to="/markets" search={{ status: 'all', page: 1, sort: 'newest' }}>
          <Button leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Markets
          </Button>
        </Link>
      </div>
    )
  }

  const yesPercent = Number(market.pool.yesPrice) * 100

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation */}
      <Link to="/markets" className="inline-block" search={{ status: 'all', page: 1, sort: 'newest' }}>
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Markets
        </Button>
      </Link>

      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-3xl font-bold text-white leading-tight">
              {market.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <Badge variant={market.status === 'ACTIVE' ? 'success' : 'default'}>
                {market.status}
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {market.closesAt
                  ? `Ends ${formatDistanceToNow(new Date(market.closesAt), { addSuffix: true })}`
                  : 'No closing date'}
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <Users className="w-3 h-3" />
                Category: {market.category}
              </span>
            </div>
          </div>

          {/* Action Button (Placeholder for Trade logic) */}
          <div className="flex gap-2">
            {/* Future: Trade Button or Trade Form Modal Trigger */}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (Chart & Graph) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Price Chart */}
          <PriceChart
            data={history?.candles || []}
            height={400}
            className={isHistoryLoading ? 'opacity-50' : ''}
          />

          {/* Probability Bar */}
          <Card>
            <CardHeader>
              <CardTitle>Current Odds</CardTitle>
            </CardHeader>
            <CardContent>
              <ProbabilityBar
                yesPercent={yesPercent}
                showLabels
                size="lg"
              />
              <div className="mt-6 text-sm text-gray-400">
                <p>{market.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Stats & Trade Form Placeholder) */}
        <div className="space-y-8">
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle>Market Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>24h Volume</span>
                </div>
                <span className="font-mono font-medium text-white">
                  {formatCompactPoints(market.volume24h)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <Activity className="w-4 h-4" />
                  <span>Total Liquidity</span>
                </div>
                {/* Calculate approx liquidity or show pool amounts */}
                <span className="font-mono font-medium text-white">
                  {formatCompactPoints((BigInt(market.pool.yesQty) + BigInt(market.pool.noQty)).toString())}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <BarChart2 className="w-4 h-4" />
                  <span>Created</span>
                </div>
                <span className="text-white">
                  {new Date(market.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Placeholder for TradeForm (Detail-6 implementation usually) */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="py-8 text-center">
              <p className="text-blue-200">Trading functionality coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
