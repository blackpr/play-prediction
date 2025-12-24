import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from '@tanstack/react-router'
import { Menu, X, LogOut, Wallet, LayoutDashboard, Users, Store, ClipboardList, Tags } from 'lucide-react'
import { useAuth, useLogout } from '../../hooks/useAuth'
import { useIsClient } from '../../hooks/useIsClient'
import { Button } from '../ui/Button'
import { formatPoints } from '../../lib/format'
import { cn } from '../../utils'

export function MobileNav() {
  const isClient = useIsClient()

  if (!isClient) {
    return (
      <div className="md:hidden block">
        <Button variant="ghost" size="sm">
          <Menu className="w-6 h-6" />
        </Button>
      </div>
    )
  }

  return <MobileNavClient />
}

function MobileNavClient() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRendered, setIsRendered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const { user, isAuthenticated } = useAuth()
  const logoutMutation = useLogout()
  const { pathname } = useLocation()
  const isTreasury = user?.role === 'treasury'
  const isAdmin = user?.role === 'admin' || user?.role === 'treasury'

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true)
      // Small delay to ensure DOM is painted before triggering transition
      const timer = setTimeout(() => setIsVisible(true), 20)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
      // Wait for transition to finish before unmounting
      const timer = setTimeout(() => setIsRendered(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const close = () => setIsOpen(false)

  return (
    <div className="md:hidden block">
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        <Menu className="w-6 h-6" />
      </Button>

      {isRendered &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
              className={cn(
                'fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
                isVisible ? 'opacity-100' : 'opacity-0'
              )}
              onClick={close}
            />

            {/* Panel */}
            <div
              className={cn(
                'relative z-[101] w-[80%] max-w-[300px] h-full bg-surface border-l border-surface-highlight p-6 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out transform',
                isVisible ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              <div className="flex items-center justify-between mb-8">
                <span className="text-xl font-bold text-text">Menu</span>
                <Button variant="ghost" size="sm" onClick={close}>
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <nav className="flex flex-col gap-6">
                <Link
                  to="/about"
                  className="text-lg font-medium text-text-muted hover:text-accent-cyan transition-colors"
                  activeProps={{ className: 'text-accent-cyan font-bold' }}
                  onClick={close}
                >
                  About
                </Link>

                {isAuthenticated ? (
                  <>
                    <Link
                      to="/portfolio"
                      className="text-lg font-medium text-text-muted hover:text-text transition-colors"
                      activeProps={{ className: 'text-text' }}
                      onClick={close}
                    >
                      Portfolio
                    </Link>

                    {/* Admin Section */}
                    {isAdmin && (
                      <>
                        <div className="h-px bg-surface-highlight my-2" />
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3">
                            Admin Console
                          </span>
                          <Link
                            to="/admin"
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                              pathname === '/admin'
                                ? "bg-surface-highlight text-primary"
                                : "text-text-muted hover:bg-surface-highlight hover:text-text"
                            )}
                            onClick={close}
                          >
                            <LayoutDashboard className="w-5 h-5" />
                            Dashboard
                          </Link>
                          <Link
                            to="/admin/markets"
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                              pathname.startsWith('/admin/markets') || pathname.startsWith('/admin/market-create')
                                ? "bg-surface-highlight text-primary"
                                : "text-text-muted hover:bg-surface-highlight hover:text-text"
                            )}
                            onClick={close}
                          >
                            <Store className="w-5 h-5" />
                            Markets
                          </Link>
                          {!isTreasury && (
                            <Link
                              to="/admin/users"
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                                pathname.startsWith('/admin/users')
                                  ? "bg-surface-highlight text-primary"
                                  : "text-text-muted hover:bg-surface-highlight hover:text-text"
                              )}
                              onClick={close}
                            >
                              <Users className="w-5 h-5" />
                              Users
                            </Link>
                          )}
                          <Link
                            to="/admin/categories"
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                              pathname.startsWith('/admin/categories')
                                ? "bg-surface-highlight text-primary"
                                : "text-text-muted hover:bg-surface-highlight hover:text-text"
                            )}
                            onClick={close}
                          >
                            <Tags className="w-5 h-5" />
                            Categories
                          </Link>
                          {!isTreasury && (
                            <Link
                              to="/admin/audit-log"
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                                pathname.startsWith('/admin/audit-log')
                                  ? "bg-surface-highlight text-primary"
                                  : "text-text-muted hover:bg-surface-highlight hover:text-text"
                              )}
                              onClick={close}
                            >
                              <ClipboardList className="w-5 h-5" />
                              Audit Log
                            </Link>
                          )}
                        </div>
                      </>
                    )}

                    <div className="h-px bg-surface-highlight my-2" />

                    {/* Balance */}
                    <Link
                      to="/portfolio/history"
                      onClick={close}
                      className="flex flex-col gap-2 p-4 bg-surface-highlight rounded-xl border border-transparent hover:border-primary/50 transition-colors"
                    >
                      <span className="text-sm text-text-muted">Balance</span>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" />
                        <span className="text-xl font-mono font-medium text-text text-wrap break-all">
                          {formatPoints(user?.balance)}
                        </span>
                      </div>
                    </Link>

                    <Button
                      variant="ghost"
                      className="justify-start px-0 text-lg font-medium text-error hover:text-error/80 hover:bg-transparent mt-auto"
                      onClick={() => {
                        logoutMutation.mutate()
                        close()
                      }}
                    >
                      <LogOut className="w-5 h-5 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-4 mt-auto sm:mt-4">
                    <Link to="/login" onClick={close} className="w-full">
                      <Button variant="ghost" className="w-full justify-center">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/register" onClick={close} className="w-full">
                      <Button className="w-full justify-center">
                        Get Started
                      </Button>
                    </Link>
                  </div>
                )}
              </nav>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
