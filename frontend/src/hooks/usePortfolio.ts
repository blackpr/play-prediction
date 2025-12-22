import { queryOptions, useQuery } from '@tanstack/react-query'
import { getPosition } from '../api/markets'

export const positionQueryOptions = (marketId: string) =>
  queryOptions({
    queryKey: ['portfolio', marketId],
    queryFn: () => getPosition(marketId),
    staleTime: 30_000, // 30 seconds
  })

export const usePosition = (marketId: string) => {
  return useQuery(positionQueryOptions(marketId))
}
