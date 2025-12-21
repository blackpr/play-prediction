import { api } from './client'
import type { Market } from './types'

export interface GetMarketsParams {
  status?: 'ACTIVE' | 'RESOLVED' | 'CANCELLED'
  category?: string
  page?: number
  pageSize?: number
  sort?: 'createdAt' | 'closesAt' | 'volume'
  order?: 'asc' | 'desc'
  search?: string
}

export interface GetMarketsResponse {
  items: Market[]
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
