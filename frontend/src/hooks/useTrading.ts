import { useMutation, useQuery, useQueryClient, queryOptions } from '@tanstack/react-query'

import type {
  QuoteRequest,
  BuySharesRequest,
  SellSharesRequest,
  BuySharesResponse,
  SellSharesResponse,
  MintSharesRequest,
  MintSharesResponse,
  MergeSharesRequest,
  MergeSharesResponse,
} from '../api/types'
import { getQuote, buyShares, sellShares, mintShares, mergeShares } from '../api/markets'

// Quote query hook with debouncing handled at component level
export const quoteQueryOptions = (marketId: string, params: QuoteRequest | null) =>
  queryOptions({
    queryKey: ['quote', marketId, params],
    queryFn: () => {
      if (!params) throw new Error('Quote params required')
      return getQuote(marketId, params)
    },
    enabled: !!params && !!params.amount && BigInt(params.amount) > 0n,
    staleTime: 5_000, // 5 seconds
    gcTime: 10_000, // 10 seconds
  })

export const useQuote = (marketId: string, params: QuoteRequest | null) => {
  return useQuery(quoteQueryOptions(marketId, params))
}

// Buy shares mutation
export const useBuyShares = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      marketId,
      request,
    }: {
      marketId: string
      request: BuySharesRequest
    }) => {
      // Generate idempotency key if not provided
      const requestWithKey = {
        ...request,
        idempotencyKey: request.idempotencyKey || crypto.randomUUID(),
      }
      return buyShares(marketId, requestWithKey)
    },
    onSuccess: (_data: BuySharesResponse, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
    },
  })
}

// Sell shares mutation
export const useSellShares = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      marketId,
      request,
    }: {
      marketId: string
      request: SellSharesRequest
    }) => {
      // Generate idempotency key if not provided
      const requestWithKey = {
        ...request,
        idempotencyKey: request.idempotencyKey || crypto.randomUUID(),
      }
      return sellShares(marketId, requestWithKey)
    },
    onSuccess: (_data: SellSharesResponse, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
    },
  })
}

// Mint shares mutation
export const useMintShares = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      marketId,
      request,
    }: {
      marketId: string
      request: MintSharesRequest
    }) => {
      return mintShares(marketId, request)
    },
    onSuccess: (_data: MintSharesResponse, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
    },
  })
}

// Merge shares mutation
export const useMergeShares = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      marketId,
      request,
    }: {
      marketId: string
      request: MergeSharesRequest
    }) => {
      return mergeShares(marketId, request)
    },
    onSuccess: (_data: MergeSharesResponse, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets', variables.marketId] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
    },
  })
}
