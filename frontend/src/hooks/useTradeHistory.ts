import { useInfiniteQuery } from '@tanstack/react-query'
import { getTradeHistory, GetTradeHistoryParams } from '../api/markets'

export const useTradeHistory = (params: GetTradeHistoryParams = {}) => {
  return useInfiniteQuery({
    queryKey: ['portfolio', 'history', params],
    queryFn: async ({ pageParam = 1 }) => {
      return getTradeHistory({ ...params, page: pageParam })
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  })
}
