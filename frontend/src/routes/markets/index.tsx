import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/markets/')({
  component: MarketsIndex,
})

function MarketsIndex() {
  return <div className="p-2">Markets List</div>
}
