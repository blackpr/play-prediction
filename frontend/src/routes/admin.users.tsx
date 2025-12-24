import { createFileRoute } from '@tanstack/react-router'
import { UsersTable } from '../components/admin/UsersTable'

export const Route = createFileRoute('/admin/users')({
  component: UsersRoute,
})

function UsersRoute() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Users Management</h1>
        <p className="text-text-dim mt-2">
          Manage users, view activity, and grant points
        </p>
      </div>
      <UsersTable />
    </div>
  )
}
