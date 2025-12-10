import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/markets/$marketId')({
  component: MarketDetail,
})

function MarketDetail() {
  const { marketId } = Route.useParams()
  return <div className="p-2">Market Detail: {marketId}</div>
}
