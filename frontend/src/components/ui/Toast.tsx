import { useEffect } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '../../utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onDismiss: (id: string) => void
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/10 dark:text-yellow-300 dark:border-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-800',
}

const iconStyles = {
  success: 'text-green-500 dark:text-green-400',
  error: 'text-red-500 dark:text-red-400',
  warning: 'text-yellow-500 dark:text-yellow-400',
  info: 'text-blue-500 dark:text-blue-400',
}

export function Toast({ id, type, message, duration = 5000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [id, duration, onDismiss])

  const Icon = icons[type]

  return (
    <div
      className={cn(
        'flex items-start p-4 w-full max-w-sm rounded-lg border shadow-sm transition-all animate-in slide-in-from-bottom-5 duration-300',
        styles[type]
      )}
      role="alert"
    >
      <div className="flex-shrink-0">
        <Icon className={cn('h-5 w-5', iconStyles[type])} />
      </div>
      <div className="ml-3 flex-1 pt-0.5">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <div className="ml-4 flex flex-shrink-0">
        <button
          type="button"
          className={cn(
            'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
            type === 'success' ? 'hover:bg-green-100 focus:ring-green-500 dark:hover:bg-green-900/20' :
              type === 'error' ? 'hover:bg-red-100 focus:ring-red-500 dark:hover:bg-red-900/20' :
                type === 'warning' ? 'hover:bg-yellow-100 focus:ring-yellow-500 dark:hover:bg-yellow-900/20' :
                  'hover:bg-blue-100 focus:ring-blue-500 dark:hover:bg-blue-900/20'
          )}
          onClick={() => onDismiss(id)}
        >
          <span className="sr-only">Dismiss</span>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
