import { Link } from '@tanstack/react-router'
import { LogOut, Wallet } from 'lucide-react'
import { useAuth, useLogout } from '../../hooks/useAuth'
import { useIsClient } from '../../hooks/useIsClient'
import { Button } from '../ui/Button'
import { formatPoints } from '../../lib/format'

/**
 * Handles the user balance and sign-in/out buttons.
 * Uses a hydration guard to prevent build hangs and Rule of Hooks errors.
 */
export function UserSection() {
  const isClient = useIsClient()

  // During SSR (prerendering), we show the skeleton placeholder.
  // This prevents the server from ever seeing the authenticated hooks inside UserSectionClient.
  if (!isClient) {
    return (
      <div className="w-24 h-8 bg-surface-highlight rounded-lg animate-pulse" />
    )
  }

  return <UserSectionClient />
}

/**
 * This sub-component ONLY mounts on the client.
 * Hooks inside here are unconditional and stable, satisfying React's Rules of Hooks.
 */
function UserSectionClient() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const logoutMutation = useLogout()

  if (isLoading) {
    return (
      <div className="w-24 h-8 bg-surface-highlight rounded-lg animate-pulse" />
    )
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        {/* Balance Link */}
        <Link
          to="/portfolio/history"
          search={{ page: 1, pageSize: 20 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-highlight rounded-lg border border-transparent hover:border-primary/50 hover:bg-surface-pressed transition-all group"
        >
          <Wallet className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-mono font-medium text-text tabular-nums">
            {formatPoints(user?.balance)}
          </span>
        </Link>

        {/* Sign Out Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logoutMutation.mutate()}
          className="hidden sm:flex"
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link to="/login">
        <Button variant="ghost" size="sm">
          Sign In
        </Button>
      </Link>
      <Link to="/register">
        <Button size="sm">Get Started</Button>
      </Link>
    </div>
  )
}
