import { Link } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { useIsClient } from '../../hooks/useIsClient'

/**
 * Only renders the Portfolio link on the client once authenticated.
 * This prevents hook/prerender issues during the build phase.
 */
export function PortfolioLink() {
  const isClient = useIsClient()

  // Return nothing on server to avoid running hooks below
  if (!isClient) return null

  return <PortfolioLinkClient />
}

function PortfolioLinkClient() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) return null

  return (
    <Link
      to="/portfolio"
      className="text-text-muted hover:text-text transition-colors"
      activeProps={{ className: 'text-text font-medium' }}
    >
      Portfolio
    </Link>
  )
}
