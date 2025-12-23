import { Link, useLocation } from '@tanstack/react-router'
import { LayoutDashboard, Users, Store, ClipboardList, Tags } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../utils'

export function AdminSidebar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isTreasury = user?.role === 'treasury'

  const navItems = [
    {
      label: 'Dashboard',
      to: '/admin',
      icon: LayoutDashboard,
      show: true,
      isActive: pathname === '/admin',
    },
    {
      label: 'Markets',
      to: '/admin/markets',
      icon: Store,
      show: true,
      isActive: pathname.startsWith('/admin/markets') || pathname.startsWith('/admin/market-create'),
    },
    {
      label: 'Users',
      to: '/admin/users',
      icon: Users,
      show: !isTreasury, // Hidden for treasury
      isActive: pathname.startsWith('/admin/users'),
    },
    {
      label: 'Categories',
      to: '/admin/categories',
      icon: Tags,
      show: true,
      isActive: pathname.startsWith('/admin/categories'),
    },
    {
      label: 'Audit Log',
      to: '/admin/audit-log',
      icon: ClipboardList,
      show: !isTreasury,
      isActive: pathname.startsWith('/admin/audit-log'),
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
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  item.isActive
                    ? "bg-surface-highlight text-primary"
                    : "text-text-muted hover:bg-surface-highlight hover:text-text"
                )}
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
