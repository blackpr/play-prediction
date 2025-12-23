import { createFileRoute } from '@tanstack/react-router'
import { CategoriesTable } from '../components/admin/CategoriesTable'

export const Route = createFileRoute('/admin/categories')({
  component: CategoriesRoute,
})

function CategoriesRoute() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Categories Management</h1>
        <p className="text-text-dim mt-2">
          Manage market categories and their default behaviors
        </p>
      </div>
      <CategoriesTable />
    </div>
  )
}
