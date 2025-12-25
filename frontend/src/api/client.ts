// In production, API is served from same origin. In dev, use env var or default to localhost:4000
import { notifySessionExpired } from '../lib/auth-events'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : '/api/v1')

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  method: string,
  path: string,
  options?: {
    body?: unknown
    headers?: Record<string, string>
    skipNotify?: boolean
  },
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`

  const headers: Record<string, string> = {
    ...options?.headers,
  }

  if (options?.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options?.body instanceof FormData
      ? options.body
      : (options?.body !== undefined ? JSON.stringify(options.body) : undefined),
    credentials: 'include', // Important: include cookies for auth
  })

  const json = await response.json()

  if (!response.ok || !json.success) {
    if (response.status === 401 && !options?.skipNotify) {
      notifySessionExpired()
    }

    throw new ApiError(
      json.error?.code ?? 'UNKNOWN_ERROR',
      json.error?.message ?? 'An error occurred',
      response.status,
      json.error?.details,
    )
  }

  return json
}

export const api = {
  get: <T>(
    path: string,
    options?: {
      headers?: Record<string, string>
      params?: Record<string, any>
      skipNotify?: boolean
    },
  ) => {
    let url = path
    if (options?.params) {
      const searchParams = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `${url.includes('?') ? '&' : '?'}${queryString}`
      }
    }
    return request<T>('GET', url, options)
  },
  post: <T>(path: string, body?: unknown, options?: { skipNotify?: boolean }) =>
    request<T>('POST', path, { body, ...options }),
  put: <T>(path: string, body?: unknown, options?: { skipNotify?: boolean }) =>
    request<T>('PUT', path, { body, ...options }),
  patch: <T>(
    path: string,
    body?: unknown,
    options?: { skipNotify?: boolean },
  ) => request<T>('PATCH', path, { body, ...options }),
  delete: <T>(path: string, options?: { skipNotify?: boolean }) =>
    request<T>('DELETE', path, options),
}

export { ApiError }
