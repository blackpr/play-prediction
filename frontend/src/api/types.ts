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
  category: string
  imageUrl: string | null
  closesAt: string | null
  pool: MarketPool
  volume24h: MicroPoints
  creator?: {
    email: string
    displayName: string | null
    role: string
  }
}

export interface MarketPool {
  yesQty: MicroPoints
  noQty: MicroPoints
  yesPrice: string // Decimal string
  noPrice: string // Decimal string
}

export type PointGrantType =
  | 'REGISTRATION_BONUS'
  | 'ADMIN_GRANT'
  | 'PROMOTION'
  | 'CORRECTION'

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

export interface PricePoint {
  timestamp: string
  yesOpen: string
  yesHigh: string
  yesLow: string
  yesClose: string
  volume: string
}

export interface PriceHistoryResponse {
  marketId: string
  interval: string
  candles: PricePoint[]
}

export interface RecentTrade {
  id: string
  userId: string
  action: 'BUY' | 'SELL'
  side: 'YES' | 'NO'
  amountIn: MicroPoints
  amountOut: MicroPoints
  priceAtExecution: MicroPoints
  createdAt: string
}

