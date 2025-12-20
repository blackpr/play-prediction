import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
} from 'lucide-react'
import { requireAuth } from '../../utils/auth'
import { usePointsHistory } from '../../hooks/useAuth'
import { formatPoints } from '../../lib/format'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import type { BadgeVariant } from '../../components/ui/Badge'

const historySearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(20),
})

export const Route = createFileRoute('/portfolio/history')({
  validateSearch: (search) => historySearchSchema.parse(search),
  beforeLoad: ({ location }) => requireAuth({ location }),
  component: PointsHistoryPage,
})

function PointsHistoryPage() {
  const { page, pageSize } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isLoading } = usePointsHistory({ page, pageSize })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={40} />
      </div>
    )
  }

  const items = data?.items ?? []
  const pagination = data?.pagination

  const getGrantTypeConfig = (
    type: string,
  ): { label: string; variant: BadgeVariant } => {
    switch (type) {
      case 'REGISTRATION_BONUS':
        return { label: 'Welcome Bonus', variant: 'success' }
      case 'ADMIN_GRANT':
        return { label: 'Admin Grant', variant: 'info' }
      case 'PROMOTION':
        return { label: 'Promotion', variant: 'success' }
      case 'CORRECTION':
        return { label: 'Correction', variant: 'warning' }
      default:
        return { label: type, variant: 'default' }
    }
  }

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    })
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-10 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Points History
        </h1>
        <p className="text-lg text-text-muted max-w-2xl">
          A detailed record of all point movements in your account, including
          bonuses and manual adjustments.
        </p>
      </div>

      <Card className="overflow-hidden border-white/5 bg-surface/50 backdrop-blur-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-text-dim">
                  Date & Time
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-text-dim">
                  Transaction Type
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-text-dim">
                  Description
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-text-dim text-right">
                  Amount
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-text-dim text-right">
                  Running Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-20 text-center text-text-dim"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="rounded-full bg-surface-highlight p-4">
                        <Info className="h-10 w-10 text-text-dim" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-medium text-text">
                          No Transactions Yet
                        </p>
                        <p className="text-sm">
                          When you receive points or bonuses, they will appear
                          here.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const config = getGrantTypeConfig(item.type)
                  const amountBigInt = BigInt(item.amount)
                  const isPositive = amountBigInt > 0n

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-white/5 transition-all duration-200 group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-text">
                            {new Date(item.createdAt).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              },
                            )}
                          </span>
                          <span className="text-[11px] text-text-dim flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={config.variant} className="py-1 px-3">
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-text-muted group-hover:text-text transition-colors">
                            {item.reason || 'Standard system adjustment'}
                          </span>
                          {item.grantedBy && (
                            <span className="text-[10px] text-text-dim/70 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-primary/40" />
                              Approved by {item.grantedBy}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div
                          className={`inline-flex items-center gap-1.5 text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          )}
                          {formatPoints(item.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-sm font-bold text-text tabular-nums">
                          {formatPoints(item.balanceAfter)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalItems > 0 && (
          <div className="flex items-center justify-between border-t border-white/5 bg-surface-highlight/30 px-6 py-5">
            <div className="text-sm text-text-dim">
              Showing{' '}
              <span className="font-semibold text-text">
                {(page - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-text">
                {Math.min(page * pageSize, pagination.totalItems)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-text">
                {pagination.totalItems}
              </span>{' '}
              entries
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-surface-highlight text-text-muted hover:bg-surface-pressed hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Previous Page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-1 px-2">
                <span className="text-sm font-medium text-text">
                  Page {page}
                </span>
                <span className="text-sm text-text-dim">
                  of {Math.ceil(pagination.totalItems / pageSize)}
                </span>
              </div>

              <button
                disabled={page * pageSize >= pagination.totalItems}
                onClick={() => handlePageChange(page + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-surface-highlight text-text-muted hover:bg-surface-pressed hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Next Page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
