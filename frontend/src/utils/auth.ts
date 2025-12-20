import { redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'
import { queryClient } from '../lib/queryClient'

export const requireAuth = async ({ location }: { location: { href: string } }) => {
  // Ensure we have the latest auth data
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
}
