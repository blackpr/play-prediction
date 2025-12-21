import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import { Button } from './ui/Button'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

export function ErrorBoundary({ children }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ReactErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-in fade-in zoom-in duration-300">
              <div className="bg-red-500/10 p-4 rounded-full mb-6">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-400 mb-6 max-w-md">
                {error.message || 'An unexpected error occurred. Please try again.'}
              </p>
              <div className="flex gap-4">
                <Button
                  variant="secondary"
                  onClick={() => window.location.href = '/'}
                >
                  Go Home
                </Button>
                <Button
                  variant="primary"
                  onClick={resetErrorBoundary}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        >
          {children}
        </ReactErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
