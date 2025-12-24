import { Link } from '@tanstack/react-router'
import { ArrowLeft, Home, TrendingUp } from 'lucide-react'
import { Button } from './ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-20 text-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 space-y-8 max-w-lg mx-auto">
        <div className="relative">
          <h1 className="text-9xl font-black text-white/5 select-none text-center">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="text-3xl font-bold text-white">Page Not Found</h2>
          </div>
        </div>

        <p className="text-lg text-gray-400 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. It might have been removed or the link might be broken.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link to="/" search={{ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}>
            <Button size="lg" className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-500">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
          <Link to="/markets" search={{ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}>
            <Button variant="ghost" size="lg" className="w-full sm:w-auto gap-2 border border-white/10 hover:bg-white/5">
              <TrendingUp className="w-4 h-4" />
              Browse Markets
            </Button>
          </Link>
        </div>

        <div className="pt-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-300"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
