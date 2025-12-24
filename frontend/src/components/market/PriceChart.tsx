import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import type { PricePoint } from '../../api/types'

interface PriceChartProps {
  data: Array<PricePoint>
  height?: number
  className?: string
  interval?: string
  isLoading?: boolean
}

export function PriceChart({
  data,
  height = 300,
  className,
  interval,
  isLoading = false,
}: PriceChartProps) {
  // Check if we have data to avoid rendering empty chart glitches
  const hasData = data.length > 0

  // Transform OHLC candle data to simple price points for the chart
  // We'll use the close prices for both YES and NO (NO = 1 - YES)
  const chartData = hasData
    ? data.map((candle) => ({
        timestamp: candle.timestamp,
        yesPrice: parseFloat(candle.yesClose),
        noPrice: 1 - parseFloat(candle.yesClose),
      }))
    : []

  /**
   * Smart X-axis formatting based on time range and data density
   *
   * Strategy:
   * - Intraday views (1H, 24H): Show times for context
   * - Multi-day views (7D, 30D, All): Show dates
   * - Adapt to data span dynamically
   */
  const formatXAxis = (timestamp: string | number) => {
    const date = new Date(timestamp)

    // Calculate time span if we have data
    const timeSpanHours = hasData
      ? (new Date(chartData[chartData.length - 1].timestamp).getTime() -
          new Date(chartData[0].timestamp).getTime()) /
        (60 * 60 * 1000)
      : 0

    // Intraday view (≤24 hours): Show time only
    if (interval === '1H' || interval === '24H' || timeSpanHours <= 24) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }

    // Short multi-day view (7D): Show date, can include abbreviated time if needed
    if (interval === '7D' || timeSpanHours <= 7 * 24) {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })
    }

    // Long multi-day view (30D, All): Show date only
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })
  }

  /**
   * Enhanced tooltip formatter with full context
   * Always shows complete date/time and percentage with 1 decimal place
   */
  const formatTooltipLabel = (value: string | number) => {
    const date = new Date(value)
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const formatTooltipValue = (value: number, name: string) => {
    const percentage = (value * 100).toFixed(1) + '%'
    const label = name === 'yesPrice' ? 'Yes' : 'No'
    return [percentage, label]
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Price History{interval ? ` (${interval})` : ''}</span>
          {hasData && (
            <span className="text-xs font-normal text-gray-400">
              {chartData.length} data point{chartData.length !== 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <div className="p-4 pt-0 w-full relative" style={{ height }}>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">
                Loading chart data...
              </span>
            </div>
          </div>
        )}

        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="timestamp"
                stroke="#606070"
                fontSize={12}
                tickFormatter={formatXAxis}
                minTickGap={50}
              />
              <YAxis
                stroke="#606070"
                fontSize={12}
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a24',
                  border: '1px solid #2a2a36',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '12px',
                }}
                labelFormatter={formatTooltipLabel}
                formatter={formatTooltipValue}
              />
              <Line
                type="monotone"
                dataKey="yesPrice"
                stroke="#10b981" // emerald-500
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="yesPrice"
                animationDuration={500}
              />
              <Line
                type="monotone"
                dataKey="noPrice"
                stroke="#f43f5e" // rose-500
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="noPrice"
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            No price history available
          </div>
        )}
      </div>
    </Card>
  )
}
