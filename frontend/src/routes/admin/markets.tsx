import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/markets')({
  component: AdminMarkets,
})

function AdminMarkets() {
  return <div className="p-2">Admin Markets Management</div>
}
