import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useState, useEffect } from 'react'
import {
  marketQueryOptions,
  priceHistoryQueryOptions,
} from '../../hooks/useMarkets'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { ProbabilityBar } from '../../components/market/ProbabilityBar'
import { PriceChart } from '../../components/market/PriceChart'
import { IntervalSelector, type ChartInterval } from '../../components/market/IntervalSelector'
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

// Helper function to get interval parameters based on selected chart interval
function getIntervalParams(interval: ChartInterval, marketCreatedAt: string) {
  const now = new Date()
  const createdAt = new Date(marketCreatedAt)

  switch (interval) {
    case '1H':
      return {
        backendInterval: '1h' as const,
        from: new Date(now.getTime() - 60 * 60 * 1000),
        to: now
      }
    case '24H':
      return {
        backendInterval: '1h' as const,
        from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        to: now
      }
    case '7D':
      return {
        backendInterval: '4h' as const,
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now
      }
    case '30D':
      return {
        backendInterval: '1d' as const,
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now
      }
    case 'All':
      return {
        backendInterval: '1d' as const,
        from: createdAt,
        to: now
      }
  }
}

// Helper function to determine which intervals should be disabled
function getDisabledIntervals(marketCreatedAt: string): ChartInterval[] {
  const now = new Date()
  const createdAt = new Date(marketCreatedAt)
  const ageInMs = now.getTime() - createdAt.getTime()
  const ageInHours = ageInMs / (60 * 60 * 1000)
  const ageInDays = ageInMs / (24 * 60 * 60 * 1000)

  const disabled: ChartInterval[] = []

  if (ageInHours < 1) disabled.push('1H')
  if (ageInDays < 7) disabled.push('7D')
  if (ageInDays < 30) disabled.push('30D')

  return disabled
}

function MarketDetailPage() {
  const { marketId } = Route.useParams()

  // Fetch Market Data
  const { data: market, isLoading: isMarketLoading, error: marketError } = useQuery(
    marketQueryOptions(marketId)
  )

  // State for selected interval with localStorage persistence
  const [selectedInterval, setSelectedInterval] = useState<ChartInterval>(() => {
    if (typeof window === 'undefined') return '24H'
    const stored = localStorage.getItem(`market-chart-interval-${marketId}`)
    return (stored as ChartInterval) || '24H'
  })

  // Save interval preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`market-chart-interval-${marketId}`, selectedInterval)
    }
  }, [selectedInterval, marketId])

  // Get interval parameters for API call
  const intervalParams = market
    ? getIntervalParams(selectedInterval, market.createdAt)
    : null

  // Fetch Price History with dynamic interval
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    ...priceHistoryQueryOptions(marketId, intervalParams?.backendInterval || '1h'),
    enabled: !!intervalParams,
  })

  // Determine disabled intervals based on market age
  const disabledIntervals = market ? getDisabledIntervals(market.createdAt) : []

  if (isMarketLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size={32} />
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
        <Link to="/markets" search={{ status: 'all', page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}>
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
      <Link to="/markets" className="inline-block" search={{ status: 'all', page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}>
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
        <div className="lg:col-span-2 space-y-6">
          {/* Interval Selector */}
          <div className="flex items-center justify-between">
            <IntervalSelector
              selected={selectedInterval}
              onSelect={setSelectedInterval}
              disabledIntervals={disabledIntervals}
            />
          </div>

          {/* Price Chart */}
          <PriceChart
            data={history?.candles || []}
            height={400}
            interval={selectedInterval}
            isLoading={isHistoryLoading}
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
