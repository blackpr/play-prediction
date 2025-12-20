import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { User } from '../api/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

// Query for current auth status
export const authQueryOptions = {
  queryKey: ['auth', 'me'],
  queryFn: async (): Promise<User | null> => {
    try {
      const response = await api.get<User>('/auth/me')
      return response.data
    } catch {
      return null
    }
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
  retry: false,
}

export function useAuth(): AuthState {
  const { data: user, isLoading } = useQuery(authQueryOptions)

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
  }
}

// Login mutation
export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await api.post<{ user: User }>('/auth/login', credentials)
      return response.data.user
    },
    onSuccess: (user) => {
      // Update auth cache
      queryClient.setQueryData(['auth', 'me'], user)
      // Invalidate user-specific queries
      // queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

// Logout mutation
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear()
    },
  })
}

// Register mutation
export function useRegister() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await api.post<{ user: User; message: string }>('/auth/register', data)
      return response.data
    },
    // Note: We don't set auth state here because user needs to verify email first
  })
}

// Forgot Password mutation
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post<{ message: string }>('/auth/forgot-password', { email })
      return response.data
    },
  })
}

// Reset Password mutation
export function useResetPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const response = await api.post<{ message: string }>('/auth/reset-password', { password })
      return response.data
    },
  })
}
