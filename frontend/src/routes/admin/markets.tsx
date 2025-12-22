import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '../../components/ui/Button'
import { Plus } from 'lucide-react'

export const Route = createFileRoute('/admin/markets')({
  component: AdminMarkets,
})

function AdminMarkets() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Markets</h1>
        <Link to="/admin/market-create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Market
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-400">
        <p>Market list will be implemented here.</p>
      </div>
    </div>
  )
}
