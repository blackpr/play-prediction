import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  Gift,
  TrendingUp,
  Users
} from 'lucide-react'
import { useAdminStats } from '../../hooks/useAdminStats'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { GrantPointsModal } from '../../components/admin/GrantPointsModal'
import { PendingResolutionsWidget } from '../../components/admin/PendingResolutionsWidget'

export const Route = createFileRoute('/admin/')({
  component: AdminIndex,
})

function AdminIndex() {
  const { data: stats, isLoading, error } = useAdminStats()
  const [grantPointsModalOpen, setGrantPointsModalOpen] = useState(false)

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading dashboard stats...</div>
  // Add debug info if there's an error
  if (error) {
    console.error('Admin stats error:', error)
    return <div className="p-8 text-center text-red-500">Error loading stats: {error.message}</div>
  }
  if (!stats) return null

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Platform overview and activity</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setGrantPointsModalOpen(true)}
          leftIcon={<Gift className="w-4 h-4" />}
        >
          Grant Points
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Users"
          value={stats.users.total}
          icon={<Users className="w-4 h-4 text-blue-400" />}
        />
        <MetricCard
          label="Active Users (7d)"
          value={stats.users.activeLastWeek}
          icon={<Users className="w-4 h-4 text-blue-400" />}
        />
        <MetricCard
          label="Active Markets"
          value={stats.markets.active}
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          label="24h Volume"
          value={`$${(Number(stats.volume.last24h) / 1000000).toLocaleString()}`}
          icon={<BarChart3 className="w-4 h-4 text-purple-400" />}
        />
        <MetricCard
          label="Total Volume"
          value={`$${(Number(stats.volume.total) / 1000000).toLocaleString()}`}
          icon={<BarChart3 className="w-4 h-4 text-purple-400" />}
        />
        <MetricCard
          label="Pending Resolution"
          value={stats.markets.pendingResolution}
          icon={<Clock className="w-4 h-4 text-amber-400" />}
        />
        <MetricCard
          label="Resolved Markets"
          value={stats.markets.resolved}
          icon={<Clock className="w-4 h-4 text-gray-400" />}
        />
        <MetricCard
          label="Cancelled Markets"
          value={stats.markets.cancelled}
          icon={<Clock className="w-4 h-4 text-red-400" />}
        />
      </div>

      {/* Pending Resolutions Widget */}
      <PendingResolutionsWidget />

      {/* Recent Trades */}
      <Card className="border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-800">
          <CardTitle className="text-lg font-medium text-white">Recent Trades</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-400 bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 font-medium">Market</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {stats.recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No recent trades found
                  </td>
                </tr>
              ) : (
                stats.recentTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-200 truncate max-w-xs" title={trade.marketTitle}>
                      {trade.marketTitle}
                    </td>
                    <td className="px-6 py-4">
                      <ActionBadge action={trade.action} />
                    </td>
                    <td className="px-6 py-4 text-gray-300 font-mono">
                      {(Number(trade.amountIn) / 1000000).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(trade.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Grant Points Modal */}
      <GrantPointsModal
        isOpen={grantPointsModalOpen}
        onClose={() => setGrantPointsModalOpen(false)}
      />
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-gray-400">{label}</p>
          {icon}
        </div>
        <div className="text-2xl font-bold text-white mt-2">{value}</div>
      </CardContent>
    </Card>
  )
}

function ActionBadge({ action }: { action: string }) {
  const styles = {
    BUY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    SELL: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    MINT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    MERGE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    default: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }

  const style = styles[action as keyof typeof styles] || styles.default

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${style}`}>
      {action}
      {action === 'BUY' && <ArrowUpRight className="ml-1 w-3 h-3" />}
      {action === 'SELL' && <ArrowDownRight className="ml-1 w-3 h-3" />}
    </span>
  )
}
