import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { onSessionExpired } from '../lib/auth-events'
import { useIsClient } from '../hooks/useIsClient'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

export function SessionManager() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  const isClient = useIsClient()

  useEffect(() => {
    // Only set up session management on client
    if (!isClient) return
    const unsubscribe = onSessionExpired(() => {
      setIsOpen(true)
    })
    return unsubscribe
  }, [isClient])

  const handleLogin = async () => {
    setIsOpen(false)
    // Clear cache
    queryClient.clear()
    // Redirect to login with return URL
    await router.navigate({
      to: '/login',
      search: {
        redirect: window.location.pathname,
      },
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="Session Expired">
      <div className="space-y-4">
        <p className="text-text-muted">
          Your session has expired. Please log in again to continue.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={handleLogin}>Log In</Button>
        </div>
      </div>
    </Modal>
  )
}
