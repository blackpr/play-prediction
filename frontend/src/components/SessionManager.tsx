
import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { onSessionExpired } from '../lib/auth-events'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

export function SessionManager() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      setIsOpen(true)
    })
    return unsubscribe
  }, [])

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
    <Modal
      isOpen={isOpen}
      onClose={() => { }}
      title="Session Expired"
    >
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
