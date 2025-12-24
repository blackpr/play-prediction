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
  Zap,
  Eye,
} from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'

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
import { GridPattern } from '../../components/ui/GridPattern'

export const Route = createFileRoute('/markets/$marketId')({
  loader: async ({ context: { queryClient }, params: { marketId } }) => {
    await queryClient.ensureQueryData(marketQueryOptions(marketId))
    const now = new Date()
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    await queryClient.ensureQueryData(
      priceHistoryQueryOptions(marketId, '15m', from, now),
    )
  },
  component: MarketDetailPage,
})

function getIntervalParams(interval: ChartInterval, marketCreatedAt: string) {
  const now = new Date()
  const createdAt = new Date(marketCreatedAt)
  const ageInHours = (now.getTime() - createdAt.getTime()) / (60 * 60 * 1000)
  const ageInDays = ageInHours / 24

  switch (interval) {
    case '1H':
      return {
        backendInterval: '1m' as const,
        from: new Date(now.getTime() - 60 * 60 * 1000),
        to: now,
      }
    case '24H':
      return {
        backendInterval: '15m' as const,
        from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        to: now,
      }
    case '7D':
      return {
        backendInterval: '1h' as const,
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
      }
    case '30D':
      return {
        backendInterval: '4h' as const,
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
      }
    case 'All':
      let allInterval: '1h' | '4h' | '1d'
      if (ageInDays <= 7) {
        allInterval = '1h'
      } else if (ageInDays <= 30) {
        allInterval = '4h'
      } else {
        allInterval = '1d'
      }
      return {
        backendInterval: allInterval,
        from: createdAt,
        to: now,
      }
  }
}

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

  useEffect(() => {
    const channel = `market:${marketId}`
    subscribe(channel)
    return () => unsubscribe(channel)
  }, [marketId, subscribe, unsubscribe])

  const {
    data: market,
    isLoading: isMarketLoading,
    error: marketError,
  } = useQuery(marketQueryOptions(marketId))

  const [selectedInterval, setSelectedInterval] = useState<ChartInterval>('24H')

  useEffect(() => {
    const stored = localStorage.getItem(`market-chart-interval-${marketId}`)
    if (stored) {
      setSelectedInterval(stored as ChartInterval)
    }
  }, [marketId])

  useEffect(() => {
    localStorage.setItem(`market-chart-interval-${marketId}`, selectedInterval)
  }, [selectedInterval, marketId])

  const intervalParams = useMemo(() => {
    return market ? getIntervalParams(selectedInterval, market.createdAt) : null
  }, [selectedInterval, market?.createdAt])

  const { data: history, isLoading: isHistoryLoading } = useQuery({
    ...priceHistoryQueryOptions(
      marketId,
      intervalParams?.backendInterval || '1h',
      intervalParams?.from,
      intervalParams?.to,
    ),
    enabled: !!intervalParams,
  })

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
        <h2 className="text-2xl font-bold text-text mb-4">Market Not Found</h2>
        <p className="text-text-muted mb-8">
          The market you are looking for does not exist or has been removed.
        </p>
        <Link
          to="/"
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
    <div className="min-h-screen bg-background relative">
      {/* Background Grid Pattern */}
      <GridPattern className="opacity-10 fixed inset-0" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation */}
        <Link
          to="/"
          search={{
            page: 1,
            pageSize: 20,
            sort: 'createdAt',
            order: 'desc',
          }}
          className="inline-flex items-center gap-2 text-text-muted hover:text-accent-cyan transition-colors font-mono text-sm uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Markets</span>
        </Link>

        {/* Header Section - Terminal Style */}
        <div className="data-card rounded-xl p-6 border-accent-cyan/30 relative overflow-hidden">
          <div className="scan-line" />

          <div className="flex flex-col md:flex-row gap-6">
            {/* Image */}
            {market.imageUrl && (
              <div className="flex-shrink-0">
                <img
                  src={market.imageUrl}
                  alt={market.title}
                  className="w-20 h-20 rounded-lg object-cover border-2 border-surface-highlight"
                />
              </div>
            )}

            {/* Title & Meta */}
            <div className="flex-1 space-y-3">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-text leading-tight">
                {market.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge
                  variant={market.status === 'ACTIVE' ? 'success' : 'default'}
                  className="font-mono uppercase tracking-wider"
                >
                  {market.status}
                </Badge>

                <div className="flex items-center gap-1.5 text-text-muted font-mono">
                  <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                  {market.closesAt
                    ? `Ends ${formatDistanceToNow(new Date(market.closesAt), { addSuffix: true })}`
                    : 'No closing date'}
                </div>

                {market.category && (
                  <Link
                    to="/"
                    search={{
                      categoryId: market.categoryId || undefined,
                      page: 1,
                      pageSize: 20,
                      sort: 'createdAt',
                      order: 'desc',
                    }}
                    className="flex items-center gap-1.5 text-text-muted hover:text-accent-cyan transition-colors font-mono"
                  >
                    <Users className="w-3.5 h-3.5" />
                    {market.category}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart & Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart Card */}
            <div className="data-card rounded-xl p-6 relative overflow-hidden">
              <div className="scan-line" />

              {/* Chart Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-mono text-accent-cyan uppercase tracking-wider text-sm font-bold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Price History ({selectedInterval})
                </h2>
                <IntervalSelector
                  selected={selectedInterval}
                  onSelect={setSelectedInterval}
                  disabledIntervals={disabledIntervals}
                />
              </div>

              {/* Chart */}
              <PriceChart
                data={history?.candles || []}
                height={400}
                interval={selectedInterval}
                isLoading={isHistoryLoading}
              />
            </div>

            {/* Current Odds Card */}
            <div className="data-card rounded-xl p-6">
              <h2 className="font-mono text-accent-cyan uppercase tracking-wider text-sm font-bold mb-6 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Current Odds
              </h2>

              <ProbabilityBar yesPercent={yesPercent} showLabels size="lg" />

              {market.description && (
                <div className="mt-6 p-4 rounded-lg bg-surface/50 border border-surface-highlight">
                  <p className="text-text-muted leading-relaxed">{market.description}</p>
                </div>
              )}
            </div>

            {/* Recent Trades */}
            <RecentTrades marketId={marketId} />
          </div>

          {/* Right Column - Stats & Trade */}
          <div className="space-y-6">
            {/* Market Stats Card - FIXED LAYOUT */}
            <div className="data-card rounded-xl p-6">
              <h2 className="font-mono text-accent-cyan uppercase tracking-wider text-sm font-bold mb-6">
                Market Stats
              </h2>

              <div className="space-y-4">
                {/* 24h Volume */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-accent-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-dim font-mono uppercase tracking-wider">24h Volume</div>
                    <div className="text-data text-lg font-bold text-text">
                      {formatCompactPoints(market.volume24h)}
                    </div>
                  </div>
                </div>

                {/* Total Liquidity */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-lime/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-accent-lime" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-dim font-mono uppercase tracking-wider">Total Liquidity</div>
                    <div className="text-data text-lg font-bold text-text">
                      {formatCompactPoints(
                        (BigInt(market.pool.yesQty) + BigInt(market.pool.noQty)).toString(),
                      )}
                    </div>
                  </div>
                </div>

                {/* Created */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
                    <BarChart2 className="w-4 h-4 text-accent-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-dim font-mono uppercase tracking-wider">Created</div>
                    <div className="text-sm font-medium text-text">
                      {new Date(market.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Creator */}
                {market.creator && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-pink/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-accent-pink" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-text-dim font-mono uppercase tracking-wider">Creator</div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text truncate">
                          {market.creator.displayName || market.creator.email}
                        </span>
                        {(market.creator.role === 'admin' || market.creator.role === 'treasury') && (
                          <Badge variant="default" className="text-xs font-mono">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Trade Form */}
            <TradeForm market={market} />
          </div>
        </div>
      </div>
    </div>
  )
}
