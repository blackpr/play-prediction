import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import type { PricePoint } from '../../api/types'

interface PriceChartProps {
  data: PricePoint[]
  height?: number
  className?: string
}

export function PriceChart({ data, height = 300, className }: PriceChartProps) {
  // Check if we have data to avoid rendering empty chart glitches
  const hasData = data && data.length > 0

  // Transform OHLC candle data to simple price points for the chart
  // We'll use the close prices for both YES and NO (NO = 1 - YES)
  const chartData = hasData ? data.map(candle => ({
    timestamp: candle.timestamp,
    yesPrice: parseFloat(candle.yesClose),
    noPrice: 1 - parseFloat(candle.yesClose),
  })) : []

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Price History</CardTitle>
      </CardHeader>

      <div className="p-4 pt-0 w-full" style={{ height }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="timestamp"
                stroke="#606070"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }}
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
                  color: '#fff'
                }}
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value: number, name: string) => [
                  `${(value * 100).toFixed(1)}%`,
                  name === 'yesPrice' ? 'Yes' : 'No',
                ]}
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
