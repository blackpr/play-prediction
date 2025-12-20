// MicroPoints are transmitted as strings (BigInt serialization)
export type MicroPoints = string

export interface User {
  id: string
  email: string
  role: 'user' | 'admin' | 'treasury'
  balance: MicroPoints
  createdAt: string
}

export interface Market {
  id: string
  title: string
  description: string
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'RESOLVED' | 'CANCELLED'
  createdBy: string
  resolutionSource: string | null
  expiresAt: string | null
  resolvedAt: string | null
  outcome: boolean | null
  createdAt: string
  updatedAt: string
  // pool: LiquidityPool // To be implemented when Market types are needed
}

export type PointGrantType = 'REGISTRATION_BONUS' | 'ADMIN_GRANT' | 'PROMOTION' | 'CORRECTION'

export interface PointsHistoryItem {
  id: string
  type: PointGrantType
  amount: MicroPoints
  balanceAfter: MicroPoints
  grantedBy: string | null
  reason: string | null
  createdAt: string
}

export interface PointsHistoryResponse {
  items: Array<PointsHistoryItem>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
}
