import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Users, Store } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function AdminSidebar() {
  const { user } = useAuth()
  const isTreasury = user?.role === 'treasury'

  const navItems = [
    {
      label: 'Dashboard',
      to: '/admin',
      icon: LayoutDashboard,
      show: true,
    },
    {
      label: 'Markets',
      to: '/admin/markets',
      icon: Store,
      show: true,
    },
    {
      label: 'Users',
      to: '/admin/users',
      icon: Users,
      show: !isTreasury, // Hidden for treasury
    },
  ]

  return (
    <aside className="w-64 bg-surface-card border-r border-surface-highlight flex-shrink-0 min-h-[calc(100vh-4rem)] hidden md:block">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 px-3">
          Admin Console
        </h2>
        <nav className="space-y-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-text-muted rounded-lg hover:bg-surface-highlight hover:text-text transition-colors"
                activeProps={{
                  className: 'bg-surface-highlight text-primary',
                }}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
        </nav>
      </div>
    </aside>
  )
}
