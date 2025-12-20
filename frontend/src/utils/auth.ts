import { redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'
import { queryClient } from '../lib/queryClient'

/**
 * Route guard for authenticated routes.
 * Safe for SSR - skips check during build phase.
 */
export const requireAuth = async ({ location }: { location: { href: string } }) => {
  // Prevent build from hanging by skipping auth checks during SSR/prerender
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const user = await queryClient.ensureQueryData(authQueryOptions)

    if (!user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    return user
  } catch (error) {
    if (error instanceof Error && error.name === 'Redirect') throw error

    throw redirect({
      to: '/login',
      search: {
        redirect: location.href,
      },
    })
  }
}
