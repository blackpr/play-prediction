import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { ResolveMarketModal } from './ResolveMarketModal';

interface Market {
  id: string;
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'RESOLVED' | 'CANCELLED';
  closesAt?: string | null;
  closeBehavior?: 'auto' | 'manual' | 'auto_with_buffer';
  eventEndedAt?: string | null;
  holdersCount?: number;
  stats?: {
    totalVolume: string;
    volume24h: string;
  };
}

interface MarketsResponse {
  items: Array<Market>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function PendingResolutionsWidget() {
  const [selectedMarket, setSelectedMarket] = useState<{
    id: string;
    title: string;
    closesAt?: string | null;
    closeBehavior?: 'auto' | 'manual' | 'auto_with_buffer';
    eventEndedAt?: string | null;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-markets', { status: 'PAUSED' }],
    queryFn: async () => {
      const response = await api.get<MarketsResponse>('/admin/markets', {
        params: { status: 'PAUSED', pageSize: '100' }
      });
      return response;
    },
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  // Access the actual data from the API response envelope
  const marketsData = data?.data;

  // Filter for markets past their close time and sort by oldest first
  const pendingMarkets = (marketsData?.items || [])
    .filter((m: Market) => m.closesAt && new Date(m.closesAt) < new Date())
    .sort((a: Market, b: Market) =>
      new Date(a.closesAt!).getTime() - new Date(b.closesAt!).getTime()
    );

  // Calculate urgency level based on hours since closed
  const getUrgency = (closesAt: string) => {
    const hours = (Date.now() - new Date(closesAt).getTime()) / (1000 * 60 * 60);
    if (hours >= 48) return { level: 'critical', color: 'red', emoji: '🔴' };
    if (hours >= 24) return { level: 'warning', color: 'yellow', emoji: '🟡' };
    return { level: 'info', color: 'green', emoji: '🟢' };
  };

  if (isLoading) {
    return (
      <Card className="border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-800">
          <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Markets Pending Resolution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading pending resolutions...</div>
        </CardContent>
      </Card>
    );
  }

  if (pendingMarkets.length === 0) {
    return (
      <Card className="border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-800">
          <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Markets Pending Resolution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No markets pending resolution
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Markets Pending Resolution ({pendingMarkets.length})
            </CardTitle>
            <span className="text-xs text-gray-500">Auto-refreshes every 60s</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-800/50">
            {pendingMarkets.map((market: Market) => {
              const urgency = getUrgency(market.closesAt!);
              const hoursSinceClosed = (Date.now() - new Date(market.closesAt!).getTime()) / (1000 * 60 * 60);

              return (
                <div
                  key={market.id}
                  className={`p-4 hover:bg-gray-800/50 transition-colors ${urgency.level === 'critical' ? 'border-l-4 border-red-500' :
                      urgency.level === 'warning' ? 'border-l-4 border-yellow-500' :
                        'border-l-4 border-green-500'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{urgency.emoji}</span>
                        <h3 className="font-medium text-white truncate" title={market.title}>
                          {market.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Closed {formatDistanceToNow(new Date(market.closesAt!), { addSuffix: true })}
                        </span>
                        <span>
                          {market.holdersCount || 0} holders
                        </span>
                        <span>
                          {market.stats?.totalVolume
                            ? `${(Number(market.stats.totalVolume) / 1000000).toFixed(0)} Points volume`
                            : 'No volume'}
                        </span>
                      </div>
                      {urgency.level === 'critical' && (
                        <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          URGENT: {Math.floor(hoursSinceClosed)} hours overdue
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedMarket({
                          id: market.id,
                          title: market.title,
                          closesAt: market.closesAt,
                          closeBehavior: market.closeBehavior,
                          eventEndedAt: market.eventEndedAt,
                        })}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resolve Market Modal */}
      {selectedMarket && (
        <ResolveMarketModal
          isOpen={!!selectedMarket}
          onClose={() => setSelectedMarket(null)}
          marketId={selectedMarket.id}
          marketTitle={selectedMarket.title}
          closesAt={selectedMarket.closesAt}
          closeBehavior={selectedMarket.closeBehavior}
          eventEndedAt={selectedMarket.eventEndedAt}
        />
      )}
    </>
  );
}
