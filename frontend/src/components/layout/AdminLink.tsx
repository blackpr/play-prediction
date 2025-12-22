import { Link } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { useIsClient } from '../../hooks/useIsClient'

/**
 * Component Guard Pattern: AdminLink only renders on client.
 * This prevents useAuth from running during SSR/prerendering.
 */
export function AdminLink() {
  const isClient = useIsClient()

  // Return nothing on server to avoid running hooks below
  if (!isClient) return null

  return <AdminLinkClient />
}

function AdminLinkClient() {
  const { user } = useAuth()

  const hasAccess = user?.role === 'admin' || user?.role === 'treasury'

  if (!hasAccess) return null

  return (
    <Link
      to="/admin"
      className="text-text-muted hover:text-text transition-colors"
      activeProps={{ className: 'text-text font-medium' }}
    >
      Admin
    </Link>
  )
}
