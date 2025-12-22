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
  yesPrice: string // Decimal string
  noPrice: string // Decimal string
}

export interface MarketPool {
  yesQty: MicroPoints
  noQty: MicroPoints
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

// Trading Types

export type TradeSide = 'YES' | 'NO'
export type TradeAction = 'BUY' | 'SELL'

export interface QuoteRequest {
  side: TradeSide
  action: TradeAction
  amount: MicroPoints
}

export interface QuoteResponse {
  side: TradeSide
  action: TradeAction
  amountIn: MicroPoints
  estimatedSharesOut?: MicroPoints // For BUY
  estimatedAmountOut?: MicroPoints // For SELL
  estimatedFee: MicroPoints
  priceImpact: string // Decimal string (percentage)
  spotPrice: string // Decimal string
  avgExecutionPrice: string // Decimal string
  minimumRecommended: MicroPoints
  expiresAt: string
}

export interface BuySharesRequest {
  side: TradeSide
  amount: MicroPoints
  minSharesOut: MicroPoints
  idempotencyKey?: string
}

export interface BuySharesResponse {
  transactionId: string
  action: 'BUY'
  side: TradeSide
  amountIn: MicroPoints
  sharesOut: MicroPoints
  feePaid: MicroPoints
  feeBreakdown: {
    vault: MicroPoints
    liquidity: MicroPoints
  }
  pricePerShare: string
  avgExecutionPrice: string
  newPosition: {
    yesQty: MicroPoints
    noQty: MicroPoints
    yesCostBasis: MicroPoints
    noCostBasis: MicroPoints
  }
  newBalance: MicroPoints
  pool: {
    yesQty: MicroPoints
    noQty: MicroPoints
    yesPrice: string
    noPrice: string
  }
}

export interface SellSharesRequest {
  side: TradeSide
  shares: MicroPoints
  minAmountOut: MicroPoints
  idempotencyKey?: string
}

export interface SellSharesResponse {
  transactionId: string
  action: 'SELL'
  side: TradeSide
  sharesIn: MicroPoints
  amountOut: MicroPoints
  feePaid: MicroPoints
  avgExecutionPrice: string
  newPosition: {
    yesQty: MicroPoints
    noQty: MicroPoints
    yesCostBasis: MicroPoints
    noCostBasis: MicroPoints
  }
  newBalance: MicroPoints
  pool: {
    yesQty: MicroPoints
    noQty: MicroPoints
    yesPrice: string
    noPrice: string
  }
}

export interface MintSharesRequest {
  amount: MicroPoints
}

export interface MintSharesResponse {
  yesOut: MicroPoints
  noOut: MicroPoints
  newBalance: MicroPoints
}

export interface MergeSharesRequest {
  amount: MicroPoints
}

export interface MergeSharesResponse {
  amountOut: MicroPoints
  newBalance: MicroPoints
}

export interface Position {
  marketId: string
  yesQty: MicroPoints
  noQty: MicroPoints
  yesCostBasis: MicroPoints
  noCostBasis: MicroPoints
  avgYesBuyPrice?: string
  avgNoBuyPrice?: string
  currentYesPrice?: string
  currentNoPrice?: string
  unrealizedPnL?: MicroPoints
}
