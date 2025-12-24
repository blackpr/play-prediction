import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { PointsHistoryResponse, User } from '../api/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface PointsHistoryParams {
  page?: number
  pageSize?: number
}

// Query for current auth status
export const authQueryOptions = {
  queryKey: ['auth', 'me'],
  queryFn: async (): Promise<User | null> => {
    if (typeof window === 'undefined') return null
    try {
      // Use skipNotify: true to prevent session expired modal for initial check
      const response = await api.get<User>('/auth/me', { skipNotify: true })
      return response.data
    } catch {
      return null
    }
  },
  staleTime: 1000 * 60 * 5,
  retry: false,
  refetchOnMount: 'always' as const,
}

export function useAuth(): AuthState {
  const { data: user, isLoading } = useQuery(authQueryOptions)

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    // On server, isLoading should be false if we aren't fetching
    isLoading: typeof window === 'undefined' ? false : isLoading,
  }
}

// Points History query
export function usePointsHistory({
  page = 1,
  pageSize = 20,
}: PointsHistoryParams = {}) {
  const query = useQuery({
    queryKey: ['users', 'me', 'points-history', { page, pageSize }],
    queryFn: async () => {
      if (typeof window === 'undefined') return null
      const response = await api.get<PointsHistoryResponse>(
        '/users/me/points-history',
        {
          params: { page, pageSize },
        },
      )
      return response.data
    },
    // Only enable on client
    enabled: typeof window !== 'undefined',
  })

  return {
    ...query,
    // On server, isLoading should be false to prevent build hangs
    isLoading: typeof window === 'undefined' ? false : query.isLoading,
  }
}

// Mutations below...
export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await api.post<{ user: User }>(
        '/auth/login',
        credentials,
      )
      return response.data.user
    },
    onSuccess: async (user) => {
      // Update cache immediately with the user from login response
      queryClient.setQueryData(['auth', 'me'], user)
      // Mark as stale to trigger background refresh, but KEEP the data
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSuccess: async () => {
      queryClient.clear()
      await queryClient.refetchQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await api.post<{ user: User; message: string }>(
        '/auth/register',
        data,
      )
      return response.data
    },
    onSuccess: async () => {
      // After registration, we should force a check, but we don't have user data yet
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post<{ message: string }>(
        '/auth/forgot-password',
        { email },
      )
      return response.data
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const response = await api.post<{ message: string }>(
        '/auth/reset-password',
        { password },
      )
      return response.data
    },
  })
}
