import { createFileRoute } from '@tanstack/react-router'
import { AuditLogTable } from '../../components/admin/AuditLogTable'

export const Route = createFileRoute('/admin/audit-log')({
  component: AuditLogPage,
})

function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
          <p className="text-muted-foreground">
            Track and monitor all administrative actions on the platform.
          </p>
        </div>
      </div>

      <AuditLogTable />
    </div>
  )
}
