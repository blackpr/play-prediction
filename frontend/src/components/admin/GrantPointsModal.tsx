import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { toast } from 'sonner'
import { formatPoints } from '../../utils'
import { useDebounce } from '../../hooks/useDebounce'

interface GrantPointsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface User {
  id: string
  email: string
  role: string
  balance: string
  isActive: boolean
  createdAt: string
}

export function GrantPointsModal({ isOpen, onClose }: GrantPointsModalProps) {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({
    left: 0,
    width: 0,
    top: 0,
    maxHeight: 0,
  })

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Update dropdown position when it opens
  useEffect(() => {
    if (!showDropdown || !inputRef.current || typeof window === 'undefined') {
      return
    }

    const updateDropdownPosition = () => {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      const padding = 8
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - padding)

      setDropdownPosition({
        left: rect.left,
        width: rect.width,
        top: rect.bottom,
        maxHeight: spaceBelow,
      })
    }

    updateDropdownPosition()
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)

    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [showDropdown, debouncedSearch])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
      setSelectedUser(null)
      setAmount('')
      setReason('')
      setShowDropdown(false)
    }
  }, [isOpen])

  // Fetch users based on search
  const { data: usersData, isLoading: isSearching } = useQuery({
    queryKey: ['admin-users-search', debouncedSearch],
    queryFn: async () => {
      const response = await api.get<{
        items: User[]
        pagination: { page: number; pageSize: number; totalItems: number }
      }>('/admin/users', {
        params: {
          search: debouncedSearch || undefined,
          pageSize: 10,
        },
      })
      return response.data
    },
    enabled: isOpen && debouncedSearch.length >= 2,
  })

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('No user selected')

      const amountInMicroPoints = BigInt(
        Math.floor(parseFloat(amount) * 1_000_000),
      )

      return api.post(`/admin/users/${selectedUser.id}/grant-points`, {
        amount: amountInMicroPoints.toString(),
        reason,
      })
    },
    onSuccess: () => {
      toast.success('Points granted successfully', {
        description: `Granted ${amount} Points to ${selectedUser?.email}`,
      })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users-search'] })
      onClose()
    },
    onError: (error: any) => {
      toast.error('Failed to grant points', {
        description: error.response?.data?.error?.message || error.message,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUser) {
      toast.error('Please select a user')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }

    grantMutation.mutate()
  }

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setSearchTerm(user.email)
    setShowDropdown(false)
  }

  const newBalance = useMemo(() => {
    if (!selectedUser || !amount || parseFloat(amount) <= 0) return null

    const currentBalance = BigInt(selectedUser.balance)
    const amountToAdd = BigInt(Math.floor(parseFloat(amount) * 1_000_000))
    return currentBalance + amountToAdd
  }, [selectedUser, amount])

  // Render dropdown in portal
  const dropdownContent = showDropdown &&
    debouncedSearch.length >= 2 &&
    typeof document !== 'undefined' && (
      <div
        className="fixed z-[9999] bg-surface-card border border-white/10 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          maxHeight: `${Math.min(240, dropdownPosition.maxHeight)}px`,
        }}
      >
        {isSearching ? (
          <div className="p-3 text-sm text-text-dim">Searching...</div>
        ) : usersData?.items && usersData.items.length > 0 ? (
          usersData.items.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleUserSelect(user)}
              className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            >
              <div className="text-sm text-white">{user.email}</div>
              <div className="text-xs text-text-dim mt-0.5">
                {user.role} • Balance: {formatPoints(BigInt(user.balance))}{' '}
                Points
              </div>
            </button>
          ))
        ) : (
          <div className="p-3 text-sm text-text-dim">No users found</div>
        )}
      </div>
    )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Grant Points to User">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User Search */}
        <div className="relative">
          <Label htmlFor="userSearch">Search User by Email</Label>
          <Input
            ref={inputRef}
            id="userSearch"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setShowDropdown(true)
              if (selectedUser && e.target.value !== selectedUser.email) {
                setSelectedUser(null)
              }
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => {
              // Delay hiding to allow click on dropdown
              setTimeout(() => setShowDropdown(false), 200)
            }}
            placeholder="Type to search by email..."
            className="mt-1"
            autoComplete="off"
          />

          {debouncedSearch.length > 0 && debouncedSearch.length < 2 && (
            <p className="text-xs text-text-dim mt-1">
              Type at least 2 characters to search
            </p>
          )}
        </div>

        {/* Selected User Info */}
        {selectedUser && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-400 mb-1">
              Selected User
            </p>
            <p className="text-sm text-white">{selectedUser.email}</p>
            <p className="text-xs text-text-dim mt-1">
              Current Balance: {formatPoints(BigInt(selectedUser.balance))}{' '}
              Points
            </p>
          </div>
        )}

        {/* Amount Input */}
        <div>
          <Label htmlFor="amount">Amount (Points)</Label>
          <Input
            id="amount"
            type="number"
            step="0.000001"
            min="0.000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 5"
            required
            className="mt-1"
            disabled={!selectedUser}
          />
          <p className="text-xs text-text-dim mt-1">
            Enter the amount in Points (e.g., 5 = 5,000,000 micro-points)
          </p>
        </div>

        {/* New Balance Preview */}
        {newBalance !== null && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <p className="text-sm font-medium text-green-400">
              New Balance Preview
            </p>
            <p className="text-lg text-white font-medium mt-1">
              {formatPoints(newBalance)} Points
            </p>
            <p className="text-xs text-text-dim mt-1">+{amount} Points</p>
          </div>
        )}

        {/* Reason */}
        <div>
          <Label htmlFor="reason">Reason (Required)</Label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Contest winner reward, Compensation for bug, etc."
            required
            rows={3}
            maxLength={1000}
            className="mt-1 w-full px-3 py-2 bg-surface-card border border-white/10 rounded-lg text-white placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={!selectedUser}
          />
          <p className="text-xs text-text-dim mt-1">
            {reason.length}/1000 characters
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={grantMutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={grantMutation.isPending}
            disabled={!selectedUser || !amount || !reason.trim()}
            className="flex-1"
          >
            Grant Points
          </Button>
        </div>
      </form>
      {dropdownContent &&
        typeof document !== 'undefined' &&
        createPortal(dropdownContent, document.body)}
    </Modal>
  )
}
