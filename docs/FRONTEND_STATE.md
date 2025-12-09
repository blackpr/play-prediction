# Frontend State Management

**Version:** 1.0  
**Library:** TanStack Query v5  
**Framework:** React 19 + TanStack Start  
**Validation:** Zod v4  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Query Client Configuration](#2-query-client-configuration)
3. [Query Patterns](#3-query-patterns)
4. [Mutation Patterns](#4-mutation-patterns)
5. [Real-Time Updates](#5-real-time-updates)
6. [Optimistic Updates](#6-optimistic-updates)
7. [Query Keys](#7-query-keys)
8. [Error Handling](#8-error-handling)

---

## 1. Overview

### 1.1 State Categories

| Category | Tool | Description |
|----------|------|-------------|
| **Server State** | TanStack Query | API data, market info, user data |
| **URL State** | TanStack Router | Search params, route params |
| **Form State** | TanStack Form | Form inputs, validation |
| **Client State** | React state / Zustand | WebSocket connection, UI toggles |

### 1.2 Principles

- **Server state is the source of truth** for all business data
- **No manual cache management** - let TanStack Query handle it
- **Invalidate, don't update** - prefer invalidation over manual cache updates
- **Optimistic updates** only for frequently used mutations (trading)

---

## 2. Query Client Configuration

```tsx
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 1 minute
      staleTime: 1000 * 60,
      // Cached data garbage collected after 5 minutes
      gcTime: 1000 * 60 * 5,
      // Retry failed requests once
      retry: 1,
      // Don't refetch on window focus (we use WebSocket for real-time)
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect (WebSocket handles this)
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
})
```

---

## 3. Query Patterns

### 3.1 Markets List Query

```tsx
// src/hooks/useMarkets.ts
import { useQuery, queryOptions } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Market, PaginatedResponse } from '../api/types'

interface MarketsParams {
  status?: 'all' | 'active' | 'resolved'
  page?: number
  pageSize?: number
  sort?: 'newest' | 'volume' | 'ending'
}

// Query options factory
export const marketsQueryOptions = (params: MarketsParams = {}) =>
  queryOptions({
    queryKey: ['markets', 'list', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params.status && params.status !== 'all') {
        searchParams.set('status', params.status.toUpperCase())
      }
      if (params.page) searchParams.set('page', String(params.page))
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
      if (params.sort) searchParams.set('sort', params.sort)
      
      const response = await api.get<PaginatedResponse<Market>>(
        `/markets?${searchParams.toString()}`
      )
      return response.data
    },
    staleTime: 1000 * 30, // 30 seconds - markets update frequently
  })

// Hook
export function useMarkets(params: MarketsParams = {}) {
  return useQuery(marketsQueryOptions(params))
}
```

### 3.2 Single Market Query

```tsx
// src/hooks/useMarket.ts
import { useQuery, queryOptions } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Market } from '../api/types'

export const marketQueryOptions = (marketId: string) =>
  queryOptions({
    queryKey: ['markets', 'detail', marketId],
    queryFn: async () => {
      const response = await api.get<Market>(`/markets/${marketId}`)
      return response.data
    },
    staleTime: 1000 * 10, // 10 seconds
    enabled: !!marketId,
  })

export function useMarket(marketId: string) {
  return useQuery(marketQueryOptions(marketId))
}
```

### 3.3 Portfolio Query

```tsx
// src/hooks/usePortfolio.ts
import { useQuery, queryOptions } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Portfolio, PaginatedResponse } from '../api/types'

export const portfolioQueryOptions = () =>
  queryOptions({
    queryKey: ['portfolio', 'positions'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Portfolio>>('/portfolio')
      return response.data
    },
    staleTime: 1000 * 60, // 1 minute
  })

export function usePortfolio() {
  return useQuery(portfolioQueryOptions())
}

// Position for a specific market
export const positionQueryOptions = (marketId: string) =>
  queryOptions({
    queryKey: ['portfolio', 'position', marketId],
    queryFn: async () => {
      const response = await api.get<Portfolio>(`/portfolio/${marketId}`)
      return response.data
    },
    staleTime: 1000 * 30,
    enabled: !!marketId,
  })

export function usePosition(marketId: string) {
  return useQuery(positionQueryOptions(marketId))
}
```

### 3.4 Trade History Query

```tsx
// src/hooks/useTradeHistory.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Trade, PaginatedResponse } from '../api/types'

interface TradeHistoryParams {
  marketId?: string
}

export function useTradeHistory(params: TradeHistoryParams = {}) {
  return useInfiniteQuery({
    queryKey: ['trades', 'history', params],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams()
      searchParams.set('page', String(pageParam))
      if (params.marketId) searchParams.set('marketId', params.marketId)
      
      const response = await api.get<PaginatedResponse<Trade>>(
        `/portfolio/history?${searchParams.toString()}`
      )
      return response.data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
  })
}
```

---

## 4. Mutation Patterns

### 4.1 Buy Shares Mutation

```tsx
// src/hooks/useTrading.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { BuyRequest, BuyResponse, SellRequest } from '../api/types'

export function useBuyShares() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (request: BuyRequest) => {
      const response = await api.post<BuyResponse>('/trading/buy', request)
      return response.data
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries after successful trade
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }) // Balance
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ 
        queryKey: ['markets', 'detail', variables.marketId] 
      })
    },
    // Retry network errors once
    retry: (failureCount, error) => {
      // Don't retry business logic errors
      if (error instanceof ApiError && error.status < 500) {
        return false
      }
      return failureCount < 1
    },
  })
}

export function useSellShares() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (request: SellRequest) => {
      const response = await api.post('/trading/sell', request)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ 
        queryKey: ['markets', 'detail', variables.marketId] 
      })
    },
  })
}
```

### 4.2 Create Market Mutation (Admin)

```tsx
// src/hooks/useAdminMarkets.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface CreateMarketRequest {
  title: string
  description: string
  expiresAt?: string
  resolutionSource?: string
  initialYesQty: string
  initialNoQty: string
}

export function useCreateMarket() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (request: CreateMarketRequest) => {
      const response = await api.post('/admin/markets', request)
      return response.data
    },
    onSuccess: () => {
      // Invalidate markets list
      queryClient.invalidateQueries({ queryKey: ['markets', 'list'] })
    },
  })
}

export function useResolveMarket() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      marketId, 
      outcome 
    }: { 
      marketId: string
      outcome: boolean 
    }) => {
      const response = await api.post(`/admin/markets/${marketId}/resolve`, {
        outcome,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      // Force refetch of all portfolios (payouts happened)
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}
```

---

## 5. Real-Time Updates

### 5.1 WebSocket Integration

```tsx
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { env } from '../lib/env'

type WebSocketMessage =
  | { type: 'price_update'; data: { marketId: string; yesPrice: number; noPrice: number } }
  | { type: 'trade_confirmed'; data: { tradeId: string; marketId: string } }
  | { type: 'balance_update'; data: { newBalance: string } }
  | { type: 'market_status'; data: { marketId: string; status: string } }

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  const connect = useCallback(() => {
    // Session cookie sent automatically
    const ws = new WebSocket(env.WS_URL + '/ws')
    wsRef.current = ws
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      // Subscribe to relevant channels
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'prices' }))
    }
    
    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      // Handle different message types
      switch (message.type) {
        case 'price_update':
          // Update market price in cache
          queryClient.setQueryData(
            ['markets', 'detail', message.data.marketId],
            (old: any) => old ? {
              ...old,
              pool: {
                ...old.pool,
                yesPrice: message.data.yesPrice,
                noPrice: message.data.noPrice,
              },
            } : old
          )
          break
          
        case 'balance_update':
          // Update user balance in cache
          queryClient.setQueryData(['auth', 'me'], (old: any) =>
            old ? { ...old, balance: message.data.newBalance } : old
          )
          break
          
        case 'market_status':
          // Invalidate market queries
          queryClient.invalidateQueries({
            queryKey: ['markets', 'detail', message.data.marketId],
          })
          break
          
        case 'trade_confirmed':
          // Invalidate portfolio
          queryClient.invalidateQueries({ queryKey: ['portfolio'] })
          break
      }
      
      // Call custom handler
      options.onMessage?.(message)
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...')
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }, [queryClient, options.onMessage])
  
  useEffect(() => {
    connect()
    
    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])
  
  const subscribe = useCallback((channel: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'subscribe', channel }))
  }, [])
  
  const unsubscribe = useCallback((channel: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'unsubscribe', channel }))
  }, [])
  
  return { subscribe, unsubscribe }
}
```

### 5.2 Market Price Subscription

```tsx
// src/hooks/useMarketPrices.ts
import { useEffect } from 'react'
import { useWebSocket } from './useWebSocket'

export function useMarketPrices(marketId: string) {
  const { subscribe, unsubscribe } = useWebSocket()
  
  useEffect(() => {
    if (marketId) {
      subscribe(`market:${marketId}`)
      return () => unsubscribe(`market:${marketId}`)
    }
  }, [marketId, subscribe, unsubscribe])
}
```

---

## 6. Optimistic Updates

### 6.1 Optimistic Buy

```tsx
// src/hooks/useOptimisticTrading.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { BuyRequest, BuyResponse, User, Market } from '../api/types'

export function useOptimisticBuy() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (request: BuyRequest) => {
      const response = await api.post<BuyResponse>('/trading/buy', request)
      return response.data
    },
    
    // Optimistically update before server responds
    onMutate: async (request) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] })
      await queryClient.cancelQueries({ 
        queryKey: ['markets', 'detail', request.marketId] 
      })
      
      // Snapshot previous values
      const previousUser = queryClient.getQueryData<User>(['auth', 'me'])
      const previousMarket = queryClient.getQueryData<Market>(
        ['markets', 'detail', request.marketId]
      )
      
      // Optimistically update user balance
      if (previousUser) {
        const newBalance = (
          BigInt(previousUser.balance) - BigInt(request.amount)
        ).toString()
        
        queryClient.setQueryData<User>(['auth', 'me'], {
          ...previousUser,
          balance: newBalance,
        })
      }
      
      return { previousUser, previousMarket }
    },
    
    // Rollback on error
    onError: (err, request, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(['auth', 'me'], context.previousUser)
      }
      if (context?.previousMarket) {
        queryClient.setQueryData(
          ['markets', 'detail', request.marketId],
          context.previousMarket
        )
      }
    },
    
    // Always refetch after mutation
    onSettled: (_, __, request) => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ 
        queryKey: ['markets', 'detail', request.marketId] 
      })
    },
  })
}
```

---

## 7. Query Keys

### 7.1 Query Key Factory

```typescript
// src/lib/query-keys.ts

export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
  
  // Markets
  markets: {
    all: ['markets'] as const,
    lists: () => [...queryKeys.markets.all, 'list'] as const,
    list: (params: Record<string, unknown>) => 
      [...queryKeys.markets.lists(), params] as const,
    details: () => [...queryKeys.markets.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.markets.details(), id] as const,
  },
  
  // Portfolio
  portfolio: {
    all: ['portfolio'] as const,
    positions: () => [...queryKeys.portfolio.all, 'positions'] as const,
    position: (marketId: string) => 
      [...queryKeys.portfolio.all, 'position', marketId] as const,
    history: () => [...queryKeys.portfolio.all, 'history'] as const,
  },
  
  // Trades
  trades: {
    all: ['trades'] as const,
    history: (params: Record<string, unknown>) => 
      [...queryKeys.trades.all, 'history', params] as const,
  },
} as const
```

### 7.2 Usage

```tsx
// In components or hooks
import { queryKeys } from '../lib/query-keys'

// Invalidate all markets
queryClient.invalidateQueries({ queryKey: queryKeys.markets.all })

// Invalidate specific market
queryClient.invalidateQueries({ 
  queryKey: queryKeys.markets.detail('mkt_123') 
})

// Invalidate all portfolio data
queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all })
```

---

## 8. Error Handling

### 8.1 Global Error Handler

```tsx
// src/components/QueryErrorBoundary.tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

interface Props {
  children: React.ReactNode
}

export function QueryErrorBoundary({ children }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="p-8 text-center">
              <h2 className="text-xl font-bold text-red-400 mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-400 mb-4">{error.message}</p>
              <button
                onClick={resetErrorBoundary}
                className="px-4 py-2 bg-blue-600 rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
```

### 8.2 Mutation Error Handling

```tsx
// In components
function TradeForm() {
  const buyMutation = useBuyShares()
  
  const handleTrade = async () => {
    try {
      await buyMutation.mutateAsync({
        marketId: 'mkt_123',
        side: 'YES',
        amount: '1000000',
      })
      // Success - show toast or redirect
    } catch (error) {
      if (error instanceof ApiError) {
        switch (error.code) {
          case 'INSUFFICIENT_BALANCE':
            // Show specific error message
            break
          case 'SLIPPAGE_EXCEEDED':
            // Offer to retry with higher slippage
            break
          default:
            // Generic error
        }
      }
    }
  }
  
  return (
    <form>
      {buyMutation.isError && (
        <div className="text-red-400 mb-4">
          {buyMutation.error instanceof ApiError
            ? buyMutation.error.message
            : 'An error occurred'}
        </div>
      )}
      {/* ... form fields ... */}
    </form>
  )
}
```

---

## Summary

| Pattern | When to Use |
|---------|-------------|
| `useQuery` | Read-only data fetching |
| `useInfiniteQuery` | Paginated lists with "load more" |
| `useMutation` | Data modifications (create, update, delete) |
| `queryClient.invalidateQueries` | Refetch data after mutation |
| `queryClient.setQueryData` | Manual cache updates (WebSocket) |
| Optimistic updates | High-frequency actions (trading) |

