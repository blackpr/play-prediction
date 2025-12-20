import { Link } from '@tanstack/react-router'
import { useAuth, useLogout } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { formatPoints } from '../../lib/format'
import { Wallet, LogOut } from 'lucide-react'

export function Header() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const logoutMutation = useLogout()

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-surface-highlight">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🎯</span>
            <span className="text-xl font-bold text-text">Play Prediction</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/markets"
              className="text-text-muted hover:text-text transition-colors"
              activeProps={{ className: 'text-text font-medium' }}
            >
              Markets
            </Link>
            {isAuthenticated && (
              <Link
                to="/portfolio"
                className="text-text-muted hover:text-text transition-colors"
                activeProps={{ className: 'text-text font-medium' }}
              >
                Portfolio
              </Link>
            )}
          </nav>

          {/* User section */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-24 h-8 bg-surface-highlight rounded-lg animate-pulse" />
            ) : isAuthenticated ? (
              <>
                {/* Balance */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-highlight rounded-lg border border-transparent hover:border-surface-pressed transition-colors">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="font-mono font-medium text-text">
                    {formatPoints(user?.balance)}
                  </span>
                </div>

                {/* User menu */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logoutMutation.mutate()}
                  leftIcon={<LogOut className="w-4 h-4" />}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
