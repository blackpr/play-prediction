import { Link } from '@tanstack/react-router'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    to: string
    search?: Record<string, any>
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="bg-gray-900/50 rounded-xl p-12 border border-gray-800">
        <div className="w-16 h-16 text-gray-600 mx-auto mb-4">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-gray-400 mb-8">{description}</p>
        {action && (
          <Link
            to={action.to}
            search={action.search}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  )
}
