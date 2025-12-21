import { useQuery, queryOptions } from '@tanstack/react-query'
import { getMarkets, getMarket, type GetMarketsParams } from '../api/markets'

export const marketsQueryOptions = (params: GetMarketsParams) => queryOptions({
  queryKey: ['markets', params],
  queryFn: () => getMarkets(params),
  placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
})

export const marketQueryOptions = (id: string) => queryOptions({
  queryKey: ['markets', id],
  queryFn: () => getMarket(id),
})

export function useMarkets(params: GetMarketsParams) {
  return useQuery(marketsQueryOptions(params))
}

export function useMarket(id: string) {
  return useQuery(marketQueryOptions(id))
}
