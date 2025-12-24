import { Link } from '@tanstack/react-router'
import { UserSection } from './UserSection'
import { PortfolioLink } from './PortfolioLink'
import { MobileNav } from './MobileNav'
import { AdminLink } from './AdminLink'
import { Logo } from '../ui/Logo'

import { useWebSocketContext } from '../../providers/websocket-provider'

export function Header() {
  const { status } = useWebSocketContext()

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-surface-highlight">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            search={{ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
          >
            <Logo size="md" />
            <span className="font-display text-xl font-bold text-text">
              Play <span className="text-gradient-cyan">Prediction</span>
            </span>

            {/* WS Status */}
            <div
              className={`w-2 h-2 rounded-full transition-colors ${status === 'connected' ? 'bg-yes animate-pulse-glow' :
                status === 'connecting' ? 'bg-accent-amber' : 'bg-no'
                }`}
              title={`WebSocket: ${status}`}
            />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/about"
              className="text-text-muted hover:text-text transition-colors font-medium"
              activeProps={{ className: 'text-accent-cyan font-bold' }}
            >
              About
            </Link>
            <PortfolioLink />

            <AdminLink />
          </nav>

          {/* User Status (Balance, Sign In/Out) */}
          <div className="flex items-center gap-2 sm:gap-4">
            <UserSection />
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  )
}
