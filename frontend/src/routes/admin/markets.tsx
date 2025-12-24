import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { MarketsTable } from '../../components/admin/MarketsTable'

export const Route = createFileRoute('/admin/markets')({
  component: AdminMarkets,
})

function AdminMarkets() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Markets</h1>
          <p className="text-text-dim mt-1">Create and manage prediction markets.</p>
        </div>
        <Link to="/admin/market-create">
          <Button leftIcon={<Plus className="h-4 w-4" />}>
            Create Market
          </Button>
        </Link>
      </div>

      <MarketsTable />
    </div>
  )
}
