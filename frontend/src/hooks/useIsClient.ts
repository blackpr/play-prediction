import { useEffect, useState } from 'react'

/**
 * Hook to detect if code is running on the client (browser) vs server (SSR/prerendering).
 * Returns false during SSR/prerendering, true once hydrated on client.
 *
 * Use this to conditionally run client-only code (API calls, localStorage, etc.)
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}
