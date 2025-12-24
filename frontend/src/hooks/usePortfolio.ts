import { queryOptions, useQuery } from '@tanstack/react-query'
import { getPortfolio, getPosition } from '../api/markets'
import { useAuth } from './useAuth'


export const positionQueryOptions = (marketId: string) =>
  queryOptions({
    queryKey: ['portfolio', marketId],
    queryFn: () => getPosition(marketId),
    staleTime: 30_000, // 30 seconds
  })

export const usePosition = (marketId: string) => {
  const { isAuthenticated } = useAuth()
  return useQuery({
    ...positionQueryOptions(marketId),
    enabled: isAuthenticated,
  })
}

export const portfolioQueryOptions = queryOptions({
  queryKey: ['portfolio', 'all'],
  queryFn: () => getPortfolio(),
})

export const usePortfolio = () => {
  const { isAuthenticated } = useAuth()
  return useQuery({
    ...portfolioQueryOptions,
    enabled: isAuthenticated,
  })
}
