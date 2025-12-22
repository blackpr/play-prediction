import { Link } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'

export function AdminLink() {
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
