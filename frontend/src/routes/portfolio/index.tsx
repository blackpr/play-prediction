import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../utils/auth'

export const Route = createFileRoute('/portfolio/')({
  beforeLoad: ({ location }) => requireAuth({ location }),
  component: PortfolioIndex,
})

function PortfolioIndex() {
  return <div className="p-2">Portfolio</div>
}
