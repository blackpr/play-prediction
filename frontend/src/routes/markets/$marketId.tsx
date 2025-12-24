import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Clock,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import {
  IntervalSelector,
  type ChartInterval,
} from '../../components/market/IntervalSelector'
import { PriceChart } from '../../components/market/PriceChart'
import { ProbabilityBar } from '../../components/market/ProbabilityBar'
import { RecentTrades } from '../../components/market/RecentTrades'
import { TradeForm } from '../../components/market/TradeForm'
import {
  marketQueryOptions,
  priceHistoryQueryOptions,
} from '../../hooks/useMarkets'
import { formatCompactPoints } from '../../lib/format'
import { useWebSocketContext } from '../../providers/websocket-provider'

export const Route = createFileRoute('/markets/$marketId')({
  loader: async ({ context: { queryClient }, params: { marketId } }) => {
    // Prefetch market data
    await queryClient.ensureQueryData(marketQueryOptions(marketId))
    // Prefetch initial price history (last 24 hours with 15m interval)
    const now = new Date()
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    await queryClient.ensureQueryData(
      priceHistoryQueryOptions(marketId, '15m', from, now),
    )
  },
  component: MarketDetailPage,
})

/**
 * Get optimal interval parameters for price history chart
 *
 * Strategy:
 * - Target 50-200 data points per chart for optimal performance/clarity
 * - Balance detail vs. readability
 * - Scale "All" interval based on market age
 *
 * @param interval - Selected chart interval (1H, 24H, 7D, 30D, All)
 * @param marketCreatedAt - ISO timestamp of market creation
 * @returns Object with backendInterval, from, and to dates
 */
function getIntervalParams(interval: ChartInterval, marketCreatedAt: string) {
  const now = new Date()
  const createdAt = new Date(marketCreatedAt)
  const ageInHours = (now.getTime() - createdAt.getTime()) / (60 * 60 * 1000)
  const ageInDays = ageInHours / 24

  switch (interval) {
    case '1H':
      // 1-hour view: Use 1m candles (60 points)
      // Shows detailed recent price movement
      return {
        backendInterval: '1m' as const,
        from: new Date(now.getTime() - 60 * 60 * 1000),
        to: now,
      }

    case '24H':
      // 24-hour view: Use 15m candles (96 points)
      // Good balance of detail and clarity
      return {
        backendInterval: '15m' as const,
        from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        to: now,
      }

    case '7D':
      // 7-day view: Use 1h candles (168 points)
      // Shows daily patterns clearly
      return {
        backendInterval: '1h' as const,
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
      }

    case '30D':
      // 30-day view: Use 4h candles (180 points)
      // Weekly patterns visible, not too dense
      return {
        backendInterval: '4h' as const,
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
      }

    case 'All':
      // All-time view: Dynamic interval based on market age
      // Ensures reasonable data point count regardless of market age
      let allInterval: '1h' | '4h' | '1d'

      if (ageInDays <= 7) {
        // Young market (≤7 days): Use 1h candles (~168 points max)
        allInterval = '1h'
      } else if (ageInDays <= 30) {
        // Month-old market (≤30 days): Use 4h candles (~180 points max)
        allInterval = '4h'
      } else {
        // Older market (>30 days): Use 1d candles (avoids thousands of points)
        allInterval = '1d'
      }

      return {
        backendInterval: allInterval,
        from: createdAt,
        to: now,
      }
  }
}

// Helper function to determine which intervals should be disabled
function getDisabledIntervals(marketCreatedAt: string): Array<ChartInterval> {
  const now = new Date()
  const createdAt = new Date(marketCreatedAt)
  const ageInMs = now.getTime() - createdAt.getTime()
  const ageInHours = ageInMs / (60 * 60 * 1000)
  const ageInDays = ageInMs / (24 * 60 * 60 * 1000)

  const disabled: Array<ChartInterval> = []

  if (ageInHours < 1) disabled.push('1H')
  if (ageInDays < 7) disabled.push('7D')
  if (ageInDays < 30) disabled.push('30D')

  return disabled
}

function MarketDetailPage() {
  const { marketId } = Route.useParams()
  const { subscribe, unsubscribe } = useWebSocketContext()

  // WebSocket Subscription
  useEffect(() => {
    const channel = `market:${marketId}`
    subscribe(channel)
    return () => unsubscribe(channel)
  }, [marketId, subscribe, unsubscribe])

  // Fetch Market Data
  const {
    data: market,
    isLoading: isMarketLoading,
    error: marketError,
  } = useQuery(marketQueryOptions(marketId))

  // State for selected interval with localStorage persistence protection against hydration
  const [selectedInterval, setSelectedInterval] = useState<ChartInterval>('24H')

  // Restore from local storage after mount
  useEffect(() => {
    const stored = localStorage.getItem(`market-chart-interval-${marketId}`)
    if (stored) {
      setSelectedInterval(stored as ChartInterval)
    }
  }, [marketId])

  // Save interval preference to localStorage
  useEffect(() => {
    localStorage.setItem(`market-chart-interval-${marketId}`, selectedInterval)
  }, [selectedInterval, marketId])

  // Get interval parameters for API call (memoized to prevent infinite refetches)
  const intervalParams = useMemo(() => {
    return market ? getIntervalParams(selectedInterval, market.createdAt) : null
  }, [selectedInterval, market?.createdAt])

  // Fetch Price History with dynamic interval
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    ...priceHistoryQueryOptions(
      marketId,
      intervalParams?.backendInterval || '1h',
      intervalParams?.from,
      intervalParams?.to,
    ),
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
        <Link
          to="/markets"
          search={{
            status: 'all',
            page: 1,
            pageSize: 20,
            sort: 'createdAt',
            order: 'desc',
          }}
        >
          <Button leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Markets
          </Button>
        </Link>
      </div>
    )
  }

  const yesPercent = Number(market.yesPrice) * 100

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation */}
      <Link
        to="/markets"
        className="inline-block"
        search={{
          status: 'all',
          page: 1,
          pageSize: 20,
          sort: 'createdAt',
          order: 'desc',
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Markets
        </Button>
      </Link>

      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Main Image Icon */}
          <div className="flex-shrink-0">
            {market.imageUrl ? (
              <img
                src={market.imageUrl}
                alt={market.title}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover bg-white/5 shadow-lg shadow-black/20"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-white/5 flex items-center justify-center text-white/20 shadow-lg shadow-black/20">
                <span className="text-xs font-medium">No Img</span>
              </div>
            )}
          </div>

          <div className="space-y-2 max-w-3xl flex-grow">
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {market.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <Badge
                variant={market.status === 'ACTIVE' ? 'success' : 'default'}
              >
                {market.status}
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {market.closesAt
                  ? `Ends ${formatDistanceToNow(new Date(market.closesAt), { addSuffix: true })}`
                  : 'No closing date'}
              </span>
              <Link
                to="/markets"
                search={{
                  categoryId: market.categoryId || undefined,
                  status: 'all',
                  page: 1,
                  pageSize: 20,
                  sort: 'createdAt',
                  order: 'desc',
                }}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <Users className="w-3 h-3" />
                {market.category}
              </Link>
            </div>
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
              <ProbabilityBar yesPercent={yesPercent} showLabels size="lg" />
              <div className="mt-6 text-sm text-gray-400">
                <p>{market.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Trades */}
          <RecentTrades marketId={marketId} />
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
                  {formatCompactPoints(
                    (
                      BigInt(market.pool.yesQty) + BigInt(market.pool.noQty)
                    ).toString(),
                  )}
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

              {market.creator && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400">
                    <User className="w-4 h-4" />
                    <span>Creator</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white">
                      {market.creator.displayName || market.creator.email}
                    </span>
                    {(market.creator.role === 'admin' ||
                      market.creator.role === 'treasury') && (
                      <Badge variant="default" className="text-xs">
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trade Form */}
          <TradeForm market={market} />
        </div>
      </div>
    </div>
  )
}
