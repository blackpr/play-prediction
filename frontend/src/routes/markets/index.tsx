import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMarkets } from '../../hooks/useMarkets'
import { MarketCard } from '../../components/market/MarketCard'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { cn } from '../../utils'
import { MarketCardSkeleton } from '../../components/market/MarketCardSkeleton'

import { getCategories } from '../../api/markets'

const marketsSearchSchema = z.object({
  status: z.enum(['ACTIVE', 'RESOLVED', 'CANCELLED', 'all']).optional(),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  page: z.number().catch(1),
  pageSize: z.number().catch(20),
  sort: z.enum(['createdAt', 'closesAt', 'volume']).catch('createdAt'),
  order: z.enum(['asc', 'desc']).catch('desc'),
  search: z.string().optional(),
})

export const Route = createFileRoute('/markets/')({
  validateSearch: marketsSearchSchema,
  component: MarketsPage,
})

function MarketsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // Local state for search input to handle debounce
  const [searchInput, setSearchInput] = useState(search.search || '')

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search.search) {
        navigate({
          search: (prev) => ({
            ...prev,
            search: searchInput || undefined,
            page: 1, // Reset to page 1 on search
          }),
        })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, search.search, navigate])

  const { data: categoriesData } = useQuery({
    queryKey: ['categories', 'public'],
    queryFn: getCategories,
  })

  const { data, isLoading, error } = useMarkets({
    // @ts-ignore - 'all' is handled in UI but API expects undefined for all
    status: search.status === 'all' ? undefined : search.status,
    categoryId: search.categoryId,
    category: search.category,
    page: search.page,
    pageSize: search.pageSize,
    sort: search.sort,
    order: search.order,
    search: search.search,
  })

  // Handlers
  const setStatus = (status: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        status: status as any,
        page: 1,
      }),
    })
  }

  const setCategory = (categoryId: string | undefined) => {
    navigate({
      search: (prev) => ({
        ...prev,
        categoryId,
        category: undefined, // Clear legacy category string
        page: 1,
      }),
    })
  }

  const setSort = (sort: 'createdAt' | 'closesAt' | 'volume') => {
    navigate({
      search: (prev) => ({
        ...prev,
        sort,
        page: 1,
      }),
    })
  }

  const setPage = (page: number) => {
    navigate({
      search: (prev) => ({ ...prev, page }),
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Markets</h1>
          <p className="text-gray-400">Explore and trade on real-world events</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="space-y-4 rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Status Tabs */}
          <div className="flex rounded-lg bg-gray-950/50 p-1">
            {['ACTIVE', 'RESOLVED', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setStatus(status)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                  (search.status || 'ACTIVE') === status
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search markets..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-gray-950/50 border-white/10"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategory(undefined)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              !search.categoryId
                ? "bg-white text-gray-950 border-white"
                : "bg-transparent text-gray-400 border-white/10 hover:border-white/30"
            )}
          >
            All Categories
          </button>
          {categoriesData?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                search.categoryId === cat.id
                  ? "bg-white text-gray-950 border-white"
                  : "bg-transparent text-gray-400 border-white/10 hover:border-white/30"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Sort by:</span>
          <select
            value={search.sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
          >
            <option value="createdAt">Newest</option>
            <option value="volume">Most Volume</option>
            <option value="closesAt">Ending Soon</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="text-red-400">Error loading markets. Please try again.</p>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white">No markets found</h3>
          <p className="text-gray-400">Try adjusting your filters or search terms</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setSearchInput('')
              setCategory(undefined)
              setStatus('ACTIVE')
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(Math.max(1, (search.page || 1) - 1))}
                disabled={(search.page || 1) <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-400">
                Page {search.page || 1} of {data.pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(Math.min(data.pagination.totalPages, (search.page || 1) + 1))}
                disabled={(search.page || 1) >= data.pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
