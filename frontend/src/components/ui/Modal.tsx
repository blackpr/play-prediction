import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  // Handle Escape key
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Trap focus
  React.useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement

      const modalElement = modalRef.current
      if (modalElement) {
        // Focusable elements selector
        const focusableElementsSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        const focusableElements = modalElement.querySelectorAll(focusableElementsSelector)
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        // Focus the first element or the modal itself
        if (focusableElements.length > 0) {
          firstElement.focus()
        } else {
          modalElement.focus()
        }

        const handleTabKey = (e: KeyboardEvent) => {
          if (e.key === 'Tab') {
            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault()
                lastElement.focus()
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault()
                firstElement.focus()
              }
            }
          }
        }

        modalElement.addEventListener('keydown', handleTabKey)
        return () => {
          modalElement.removeEventListener('keydown', handleTabKey)
          // Restore focus
          if (previousActiveElement.current) {
            previousActiveElement.current.focus()
          }
        }
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        ref={modalRef}
        className={cn(
          'relative w-full max-w-lg rounded-xl bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 outline-none overflow-visible',
          className,
        )}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 id="modal-title" className="text-xl font-semibold text-text">{title}</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close modal"
          >
            <X size={20} />
          </Button>
        </div>
        <div className="overflow-visible">{children}</div>
      </div>
    </div>
  )

  // Use portal if document is defined (browser environment)
  if (typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }
  return content;
}
