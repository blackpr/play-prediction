import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Button } from '../ui/Button';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { format } from 'date-fns';
import { Search, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { ResolveMarketModal } from './ResolveMarketModal';
import { EditMarketModal } from './EditMarketModal';
import { ExtendMarketCloseTimeModal } from './ExtendMarketCloseTimeModal';

interface Market {
  id: string;
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'RESOLVED' | 'CANCELLED';
  volume24h: string;
  createdAt: string;
  closesAt?: string | null;
  closeBehavior?: 'auto' | 'manual' | 'auto_with_buffer';
  bufferMinutes?: number | null;
  eventEndedAt?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  category?: string | null;
  categoryId?: string | null;
  pool?: {
    yesQty: string;
    noQty: string;
  } | null;
  holdersCount?: number;
  stats?: {
    totalVolume: string;
    volume24h: string;
  };
  creator?: {
    email: string;
    role: string;
  };
}

interface MarketsResponse {
  items: Market[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  RESOLVED: 'info',
  CANCELLED: 'error',
  DRAFT: 'default',
};

export function MarketsTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<{
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    categoryId?: string | null;
    imageUrl?: string | null;
    closesAt?: string | null;
    closeBehavior?: 'auto' | 'manual' | 'auto_with_buffer';
    bufferMinutes?: number | null;
    eventEndedAt?: string | null;
    pool?: { yesQty: string; noQty: string } | null;
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search change
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['admin-markets', page, status, debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: page.toString(),
        pageSize: '10',
        status,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      // api.get returns ApiResponse<T> where T is MarketsResponse
      // So data will be ApiResponse<MarketsResponse>
      const response = await api.get<MarketsResponse>('/admin/markets', { params });
      return response;
    },
    placeholderData: (prev) => prev,
  });

  // Access the actual data from the API response envelope
  const marketsData = data?.data;

  // Actions
  const activateMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/markets/${id}/activate`, {}),
    onSuccess: () => { toast.success('Market activated'); queryClient.invalidateQueries({ queryKey: ['admin-markets'] }); }
  });

  const pauseMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/markets/${id}/pause`, {}),
    onSuccess: () => { toast.success('Market paused'); queryClient.invalidateQueries({ queryKey: ['admin-markets'] }); }
  });

  const resumeMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/markets/${id}/resume`, {}),
    onSuccess: () => { toast.success('Market resumed'); queryClient.invalidateQueries({ queryKey: ['admin-markets'] }); }
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="w-full sm:w-72 relative">
          {/* Input likely doesn't support leftIcon directly if not seen in props, wrapping it */}
          <div className="relative">
            <Input
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden bg-surface-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-surface-highlight text-text-muted uppercase text-xs">
              <tr>
                <th className="px-6 py-3 w-16">Image</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Holders</th>
                <th className="px-6 py-3 text-right">Volume (24h)</th>
                <th className="px-6 py-3 text-right">Total Volume</th>
                <th className="px-6 py-3 text-left">Creator</th>
                <th className="px-6 py-3 text-right">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-8 w-8 bg-white/5 rounded-full"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-24 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-white/5 rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : !marketsData?.items || marketsData.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-text-dim">
                    No markets found
                  </td>
                </tr>
              ) : (
                marketsData.items.map((market) => (
                  <tr key={market.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      {market.imageUrl ? (
                        <img
                          src={market.imageUrl}
                          alt=""
                          className="w-10 h-10 rounded object-cover bg-white/5"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-white/20">
                          <span className="text-xs">No Img</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-white max-w-sm truncate" title={market.title}>
                      {market.title}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={STATUS_VARIANTS[market.status] || 'default'}>
                        {market.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {market.holdersCount ?? '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400">
                      {market.volume24h ? `$${(Number(market.volume24h) / 1_000_000).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-text-dim">
                      {market.stats?.totalVolume ? `$${(Number(market.stats.totalVolume) / 1_000_000).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-text-dim text-xs">
                      {market.creator?.email || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-right text-text-dim tabular-nums">
                      {format(new Date(market.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {market.status === 'DRAFT' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedMarket({
                                  id: market.id,
                                  title: market.title,
                                  description: market.description,
                                  category: market.category,
                                  categoryId: market.categoryId,
                                  imageUrl: market.imageUrl,
                                  closesAt: market.closesAt,
                                  closeBehavior: market.closeBehavior,
                                  bufferMinutes: market.bufferMinutes,
                                  pool: market.pool
                                });
                                setEditModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => activateMut.mutate(market.id)}
                              isLoading={activateMut.isPending && activateMut.variables === market.id}
                              leftIcon={<Play className="w-3 h-3" />}
                            >
                              Activate
                            </Button>
                          </div>
                        )}
                        {market.status === 'ACTIVE' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => pauseMut.mutate(market.id)}
                              isLoading={pauseMut.isPending && pauseMut.variables === market.id}
                              leftIcon={<Pause className="w-3 h-3" />}
                            >
                              Pause
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedMarket({
                                  id: market.id,
                                  title: market.title,
                                  closesAt: market.closesAt,
                                });
                                setExtendModalOpen(true);
                              }}
                              className="text-xs"
                            >
                              Extend Close Time
                            </Button>
                          </div>
                        )}
                        {market.status === 'PAUSED' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => resumeMut.mutate(market.id)}
                              isLoading={resumeMut.isPending && resumeMut.variables === market.id}
                              leftIcon={<Play className="w-3 h-3" />}
                            >
                              Resume
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedMarket({
                                  id: market.id,
                                  title: market.title,
                                  closesAt: market.closesAt,
                                  closeBehavior: market.closeBehavior,
                                  eventEndedAt: market.eventEndedAt,
                                });
                                setResolveModalOpen(true);
                              }}
                              leftIcon={<span className="text-xs">✓</span>}
                            >
                              Resolve
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Market Modal */}
      {selectedMarket && editModalOpen && (
        <EditMarketModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedMarket(null);
          }}
          market={{
            id: selectedMarket.id,
            title: selectedMarket.title,
            description: selectedMarket.description || null,
            category: selectedMarket.category || null,
            categoryId: selectedMarket.categoryId || null,
            imageUrl: selectedMarket.imageUrl || null,
            closesAt: selectedMarket.closesAt || null,
            closeBehavior: selectedMarket.closeBehavior,
            bufferMinutes: selectedMarket.bufferMinutes ?? null,
            pool: selectedMarket.pool ?? null
          }}
        />
      )}

      {/* Resolve Market Modal */}
      {selectedMarket && resolveModalOpen && (
        <ResolveMarketModal
          isOpen={resolveModalOpen}
          onClose={() => {
            setResolveModalOpen(false);
            setSelectedMarket(null);
          }}
          marketId={selectedMarket.id}
          marketTitle={selectedMarket.title}
          closesAt={selectedMarket.closesAt}
          closeBehavior={selectedMarket.closeBehavior}
          eventEndedAt={selectedMarket.eventEndedAt}
        />
      )}

      {/* Extend Market Close Time Modal */}
      {selectedMarket && extendModalOpen && (
        <ExtendMarketCloseTimeModal
          isOpen={extendModalOpen}
          onClose={() => {
            setExtendModalOpen(false);
            setSelectedMarket(null);
          }}
          marketId={selectedMarket.id}
          marketTitle={selectedMarket.title}
          currentClosesAt={selectedMarket.closesAt || null}
        />
      )}

      {/* Pagination */}
      {marketsData && marketsData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-dim">
            Page {marketsData.pagination.page} of {marketsData.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!marketsData.pagination.hasPrev || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!marketsData.pagination.hasNext || isLoading}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
