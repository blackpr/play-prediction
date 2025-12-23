import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi, AuditLogItem } from '../../api/admin'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/Table'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { format } from 'date-fns'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

export function AuditLogTable() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [adminIdFilter, setAdminIdFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log', page, pageSize, actionFilter, adminIdFilter],
    queryFn: () => adminApi.getAuditLog({
      page,
      pageSize,
      action: actionFilter === 'ALL' ? undefined : actionFilter,
      adminId: adminIdFilter || undefined
    }),
  })

  // Fetch admins for the filter
  const { data: adminsData } = useQuery({
    queryKey: ['admin-list'],
    queryFn: () => adminApi.listUsers({ role: 'admin', pageSize: 100 }),
  })
  const admins = adminsData?.data?.items || []

  // Extract items correctly from the response structure
  const logs = data?.data?.items || []
  const total = data?.data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  if (isError) {
    return <div className="p-4 text-red-500">Error loading audit logs</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-[200px]">
          <Select
            value={adminIdFilter}
            onChange={(e) => setAdminIdFilter(e.target.value)}
          >
            <option value="">All Admins</option>
            {admins.map((admin: any) => (
              <option key={admin.id} value={admin.id}>
                {admin.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[200px]">
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="ALL">All Actions</option>
            <option value="MARKET_CREATED">Market Created</option>
            <option value="MARKET_UPDATED">Market Updated</option>
            <option value="MARKET_ACTIVATED">Market Activated</option>
            <option value="MARKET_PAUSED">Market Paused</option>
            <option value="MARKET_RESUMED">Market Resumed</option>
            <option value="MARKET_RESOLVED">Market Resolved</option>
            <option value="MARKET_CANCELLED">Market Cancelled</option>
            <option value="POINTS_GRANTED">Points Granted</option>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex justify-center items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log: AuditLogItem) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs">{log.adminEmail || log.adminId}</span>
                      {!log.adminEmail && <span className="text-xs text-muted-foreground">{log.adminId}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="font-medium">{log.entityType}</span>
                      <span className="text-muted-foreground font-mono truncate max-w-[100px]" title={log.entityId || ''}>
                        {log.entityId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <code className="text-xs bg-muted p-1 rounded block overflow-hidden text-ellipsis whitespace-nowrap" title={log.details || ''}>
                      {log.details}
                    </code>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {logs.length} of {total} results
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm font-medium">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages || totalPages === 0 || isLoading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
