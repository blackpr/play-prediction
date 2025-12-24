import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { useMarkets } from '../hooks/useMarkets'
import { MarketCard } from '../components/market/MarketCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useEffect, useState } from 'react'
import { cn } from '../utils'
import { MarketCardSkeleton } from '../components/market/MarketCardSkeleton'
import { getCategories } from '../api/markets'

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

export const Route = createFileRoute('/')({
  validateSearch: marketsSearchSchema,
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // Local state for search input
  const [searchInput, setSearchInput] = useState(search.search || '')

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search.search) {
        navigate({
          search: (prev) => ({
            ...prev,
            search: searchInput || undefined,
            page: 1,
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
        category: undefined,
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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters and Search */}
          <div className="space-y-4 rounded-xl border border-surface-highlight bg-surface-card/50 p-6 backdrop-blur-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Status Tabs */}
              <div className="flex rounded-lg bg-background/50 p-1 border border-surface-highlight">
                {['ACTIVE', 'RESOLVED', 'all'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatus(status)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-md transition-all font-mono uppercase tracking-wider',
                      (search.status || 'ACTIVE') === status
                        ? 'bg-accent-cyan text-background shadow-lg'
                        : 'text-text-muted hover:text-text hover:bg-surface-highlight'
                    )}
                  >
                    {status === 'all' ? 'All' : status}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 h-5 w-5 text-text-dim" />
                <Input
                  placeholder="Search markets..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 bg-background/50 border-surface-highlight text-text placeholder:text-text-dim focus:border-accent-cyan"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput('')}
                    className="absolute right-3 top-3 text-text-dim hover:text-text transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCategory(undefined)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                  !search.categoryId
                    ? 'bg-accent-cyan text-background border-accent-cyan shadow-glow-cyan'
                    : 'bg-transparent text-text-muted border-surface-highlight hover:border-accent-cyan/50'
                )}
              >
                ALL
              </button>
              {categoriesData?.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                    search.categoryId === cat.id
                      ? 'bg-accent-cyan text-background border-accent-cyan shadow-glow-cyan'
                      : 'bg-transparent text-text-muted border-surface-highlight hover:border-accent-cyan/50'
                  )}
                >
                  {cat.name.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-text-muted font-mono uppercase tracking-wider">Sort:</span>
              <select
                value={search.sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="bg-background/50 border border-surface-highlight text-text font-mono px-3 py-1.5 rounded-md focus:outline-none focus:border-accent-cyan cursor-pointer"
              >
                <option value="createdAt">NEWEST</option>
                <option value="volume">VOLUME</option>
                <option value="closesAt">ENDING SOON</option>
              </select>
            </div>
          </div>

          {/* Markets Grid */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <MarketCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="py-20 text-center">
              <div className="data-card rounded-xl p-12 max-w-md mx-auto">
                <div className="text-no text-5xl mb-4">⚠</div>
                <h3 className="font-display text-xl font-bold text-text mb-2">
                  Error Loading Markets
                </h3>
                <p className="text-text-muted">Please try again later.</p>
              </div>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="py-20 text-center">
              <div className="data-card rounded-xl p-12 max-w-md mx-auto">
                <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-surface-highlight flex items-center justify-center">
                  <Search className="h-8 w-8 text-text-dim" />
                </div>
                <h3 className="font-display text-xl font-bold text-text mb-2">
                  No Markets Found
                </h3>
                <p className="text-text-muted mb-6">
                  Try adjusting your filters or search terms
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchInput('')
                    setCategory(undefined)
                    setStatus('ACTIVE')
                  }}
                  className="border-accent-cyan/30 hover:bg-accent-cyan/10"
                >
                  Clear Filters
                </Button>
              </div>
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
                <div className="flex justify-center gap-3 mt-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(Math.max(1, (search.page || 1) - 1))}
                    disabled={(search.page || 1) <= 1}
                    className="border border-surface-highlight hover:border-accent-cyan/50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    <span className="font-mono">PREV</span>
                  </Button>
                  <div className="flex items-center px-6 text-sm font-mono border border-surface-highlight rounded-md bg-surface-card">
                    <span className="text-accent-cyan font-bold">{search.page || 1}</span>
                    <span className="text-text-dim mx-2">/</span>
                    <span className="text-text-muted">{data.pagination.totalPages}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(Math.min(data.pagination.totalPages, (search.page || 1) + 1))}
                    disabled={(search.page || 1) >= data.pagination.totalPages}
                    className="border border-surface-highlight hover:border-accent-cyan/50 disabled:opacity-50"
                  >
                    <span className="font-mono">NEXT</span>
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
