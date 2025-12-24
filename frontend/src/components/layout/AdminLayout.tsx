import { Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useIsClient } from '../../hooks/useIsClient'
import { AdminSidebar } from './AdminSidebar'

export function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const isClient = useIsClient()

  useEffect(() => {
    // Only redirect on client side after auth is loaded
    if (!isClient || isLoading) return

    if (!isAuthenticated) {
      navigate({ to: '/login', replace: true })
      return
    }

    const hasAccess = user?.role === 'admin' || user?.role === 'treasury'
    if (!hasAccess) {
      navigate({ to: '/', search: { page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }, replace: true })
    }
  }, [user, isAuthenticated, isLoading, navigate, isClient])

  if (isLoading || !isClient) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // Double check render safety
  const hasAccess = user?.role === 'admin' || user?.role === 'treasury'
  if (!isAuthenticated || !hasAccess) {
    return null
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <main className="flex-1 bg-background p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
