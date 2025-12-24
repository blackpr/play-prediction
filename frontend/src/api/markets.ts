import { api } from './client'
import type {
  BuySharesRequest,
  BuySharesResponse,
  Category,
  Market,
  MergeSharesRequest,
  MergeSharesResponse,
  MintSharesRequest,
  MintSharesResponse,
  Position,
  PriceHistoryResponse,
  QuoteRequest,
  QuoteResponse,
  RecentTrade,
  SellSharesRequest,
  SellSharesResponse,
  TradeHistoryResponse,
} from './types'

export interface GetMarketsParams {
  status?: 'ACTIVE' | 'RESOLVED' | 'CANCELLED'
  category?: string
  categoryId?: string
  page?: number
  pageSize?: number
  sort?: 'createdAt' | 'closesAt' | 'volume'
  order?: 'asc' | 'desc'
  search?: string
}

export interface GetMarketsResponse {
  items: Array<Market>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export const getMarkets = async (params: GetMarketsParams): Promise<GetMarketsResponse> => {
  const query = new URLSearchParams()
  if (params.status) query.append('status', params.status)
  if (params.category) query.append('category', params.category)
  if (params.categoryId) query.append('categoryId', params.categoryId)
  if (params.page) query.append('page', params.page.toString())
  if (params.pageSize) query.append('pageSize', params.pageSize.toString())
  if (params.sort) query.append('sort', params.sort)
  if (params.order) query.append('order', params.order)
  if (params.search) query.append('search', params.search)

  const response = await api.get<GetMarketsResponse>(`/markets?${query.toString()}`)
  return response.data
}

export const getMarket = async (id: string): Promise<Market> => {
  const response = await api.get<Market>(`/markets/${id}`)
  return response.data
}

export const getMarketPriceHistory = async (
  id: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
  from?: Date,
  to?: Date
): Promise<PriceHistoryResponse> => {
  const query = new URLSearchParams()
  query.append('interval', interval)
  if (from) query.append('from', from.toISOString())
  if (to) query.append('to', to.toISOString())

  const response = await api.get<PriceHistoryResponse>(
    `/markets/${id}/price-history?${query.toString()}`
  )
  return response.data
}

export const getMarketTrades = async (
  id: string,
  limit: number = 20
): Promise<Array<RecentTrade>> => {
  const query = new URLSearchParams()
  query.append('limit', limit.toString())

  const response = await api.get<Array<RecentTrade>>(
    `/markets/${id}/trades?${query.toString()}`
  )
  return response.data
}

// Trading API

export const getQuote = async (
  marketId: string,
  params: QuoteRequest
): Promise<QuoteResponse> => {
  const query = new URLSearchParams()
  query.append('side', params.side)
  query.append('action', params.action)
  query.append('amount', params.amount)

  const response = await api.get<QuoteResponse>(
    `/markets/${marketId}/quote?${query.toString()}`
  )
  return response.data
}

export const buyShares = async (
  marketId: string,
  request: BuySharesRequest
): Promise<BuySharesResponse> => {
  const response = await api.post<BuySharesResponse>(
    `/markets/${marketId}/buy`,
    request
  )
  return response.data
}

export const sellShares = async (
  marketId: string,
  request: SellSharesRequest
): Promise<SellSharesResponse> => {
  const response = await api.post<SellSharesResponse>(
    `/markets/${marketId}/sell`,
    request
  )
  return response.data
}


export const mintShares = async (
  marketId: string,
  request: MintSharesRequest
): Promise<MintSharesResponse> => {
  const response = await api.post<MintSharesResponse>(
    `/markets/${marketId}/mint`,
    request
  )
  return response.data
}

export const mergeShares = async (
  marketId: string,
  request: MergeSharesRequest
): Promise<MergeSharesResponse> => {
  const response = await api.post<MergeSharesResponse>(
    `/markets/${marketId}/merge`,
    request
  )
  return response.data
}

export const getPosition = async (marketId: string): Promise<Position | null> => {
  try {
    const response = await api.get<Position>(`/portfolio/${marketId}`)
    return response.data
  } catch (error) {
    // Return null if no position exists (404)
    return null
  }
}

export interface PortfolioResponse {
  totalValue: string
  totalCostBasis: string
  unrealizedPnL: string
  positions: Array<{
    market: {
      id: string
      title: string
      status: string
      yesPrice: string
      noPrice: string
    }
    yesQty: string
    noQty: string
    yesCostBasis: string
    noCostBasis: string
    currentValue: string
    unrealizedPnL: string
  }>
}

export const getPortfolio = async (): Promise<PortfolioResponse> => {
  const response = await api.get<PortfolioResponse>('/portfolio')
  return response.data
}

export interface GetTradeHistoryParams {
  marketId?: string
  action?: 'BUY' | 'SELL' | 'MINT' | 'MERGE'
  page?: number
  pageSize?: number
}

export const getTradeHistory = async (
  params: GetTradeHistoryParams
): Promise<TradeHistoryResponse> => {
  const query = new URLSearchParams()
  if (params.marketId) query.append('marketId', params.marketId)
  if (params.action) query.append('action', params.action)
  if (params.page) query.append('page', params.page.toString())
  const response = await api.get<TradeHistoryResponse>(
    `/portfolio/history?${query.toString()}`
  )
  return response.data
}

export const getCategories = async (): Promise<Array<Category>> => {
  const response = await api.get<Array<Category>>('/categories')
  return response.data
}
