import { Link } from '@tanstack/react-router'
import { UserSection } from './UserSection'
import { PortfolioLink } from './PortfolioLink'
import { MobileNav } from './MobileNav'

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-surface-highlight">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl" role="img" aria-label="logo">
              🎯
            </span>
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
            <PortfolioLink />
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
