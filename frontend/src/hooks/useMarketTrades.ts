import { useQuery } from '@tanstack/react-query'
import { getMarketTrades } from '../api/markets'

export function useMarketTrades(marketId: string, limit: number = 20) {
  return useQuery({
    queryKey: ['market-trades', marketId, limit],
    queryFn: () => getMarketTrades(marketId, limit),
    refetchInterval: 5000, // Refetch every 5 seconds for now (WebSocket enhancement later)
  })
}
