import { createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '../components/layout/AdminLayout'

export const Route = createFileRoute('/admin')({
  component: AdminRoute,
})

function AdminRoute() {
  return (
    <AdminLayout />
  )
}
