import { useQuery, queryOptions } from '@tanstack/react-query'
import { getMarkets, getMarket, getMarketPriceHistory, type GetMarketsParams } from '../api/markets'

export const marketsQueryOptions = (params: GetMarketsParams) => queryOptions({
  queryKey: ['markets', params],
  queryFn: () => getMarkets(params),
  placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
})

export const marketQueryOptions = (id: string) => queryOptions({
  queryKey: ['markets', id],
  queryFn: () => getMarket(id),
})

export const priceHistoryQueryOptions = (
  id: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h'
) => queryOptions({
  queryKey: ['markets', id, 'history', interval],
  queryFn: () => getMarketPriceHistory(id, interval),
})

export function useMarkets(params: GetMarketsParams) {
  return useQuery(marketsQueryOptions(params))
}

export function useMarket(id: string) {
  return useQuery(marketQueryOptions(id))
}

export function useMarketPriceHistory(
  id: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h'
) {
  return useQuery(priceHistoryQueryOptions(id, interval))
}
