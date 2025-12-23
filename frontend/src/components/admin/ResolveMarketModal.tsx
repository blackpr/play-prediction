import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import { formatPoints } from '../../utils';

interface ResolveMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketId: string;
  marketTitle: string;
  closesAt?: string | null;
  closeBehavior?: 'auto' | 'manual' | 'auto_with_buffer';
  eventEndedAt?: string | null;
}

interface Trade {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  side: string | null;
  amountIn: string;
  amountOut: string;
  createdAt: string;
}

function toDateTimeLocalString(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function parseDateTimeLocal(value: string) {
  return parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
}

function getDefaultEventEndedAt(props: Pick<ResolveMarketModalProps, 'closeBehavior' | 'closesAt' | 'eventEndedAt'>) {
  if (props.eventEndedAt) return toDateTimeLocalString(new Date(props.eventEndedAt));

  // For auto-close markets, default to closesAt (acceptance criteria)
  if ((props.closeBehavior === 'auto' || props.closeBehavior === 'auto_with_buffer') && props.closesAt) {
    return toDateTimeLocalString(new Date(props.closesAt));
  }

  // Otherwise default to "now" (manual close markets)
  return toDateTimeLocalString(new Date());
}

export function ResolveMarketModal({
  isOpen,
  onClose,
  marketId,
  marketTitle,
  closesAt,
  closeBehavior,
  eventEndedAt: initialEventEndedAt,
}: ResolveMarketModalProps) {
  const queryClient = useQueryClient();
  const [resolution, setResolution] = useState<'YES' | 'NO'>('YES');
  const [evidence, setEvidence] = useState('');
  const [eventEndedAt, setEventEndedAt] = useState(() =>
    getDefaultEventEndedAt({ closeBehavior, closesAt, eventEndedAt: initialEventEndedAt }),
  );

  useEffect(() => {
    if (!isOpen) return;
    setResolution('YES');
    setEvidence('');
    setEventEndedAt(getDefaultEventEndedAt({ closeBehavior, closesAt, eventEndedAt: initialEventEndedAt }));
  }, [isOpen, marketId, closeBehavior, closesAt, initialEventEndedAt]);

  // Fetch market trades
  const { data: tradesData } = useQuery({
    queryKey: ['market-trades', marketId],
    queryFn: async () => {
      const response = await api.get<Trade[]>(`/markets/${marketId}/trades`, {
        params: { limit: 50 }, // Backend max is 50
      });
      return response.data; // Backend returns array directly in data field
    },
    enabled: isOpen && !!marketId, // Only fetch when modal is open and marketId exists
  });

  // Filter trades that will be voided (placed after event ended)
  const tradesToVoid = useMemo(() => {
    if (!tradesData || !Array.isArray(tradesData)) {
      return [];
    }

    const eventEndTime = parseDateTimeLocal(eventEndedAt);

    const filtered = tradesData.filter(trade => {
      const tradeTime = new Date(trade.createdAt);
      const isAfter = tradeTime > eventEndTime;
      const isTradeAction = trade.action === 'BUY' || trade.action === 'SELL';
      return isAfter && isTradeAction;
    });

    return filtered;
  }, [tradesData, eventEndedAt]);

  const totalRefund = useMemo(() => {
    return tradesToVoid.reduce((sum, trade) => sum + BigInt(trade.amountIn), 0n);
  }, [tradesToVoid]);

  const resolveMut = useMutation({
    mutationFn: async () => {
      return api.post(`/admin/markets/${marketId}/resolve`, {
        resolution,
        evidence,
        eventEndedAt: parseDateTimeLocal(eventEndedAt).toISOString(),
      });
    },
    onSuccess: (response) => {
      const data = response.data as any; // Type assertion for API response envelope
      toast.success(`Market resolved as ${resolution}`, {
        description: data.voidedTrades?.count
          ? `${data.totalWinners} winners paid. ${data.voidedTrades.count} post-event trades voided.`
          : `${data.totalWinners} winners paid.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-markets'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to resolve market', {
        description: error.response?.data?.error?.message || error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidence.trim()) {
      toast.error('Evidence is required');
      return;
    }
    resolveMut.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resolve Market">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-text-dim mb-4">
            Resolving: <span className="text-white font-medium">{marketTitle}</span>
          </p>
        </div>

        {/* Resolution Outcome */}
        <div>
          <Label htmlFor="resolution">Outcome</Label>
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant={resolution === 'YES' ? 'primary' : 'secondary'}
              onClick={() => setResolution('YES')}
              className="flex-1"
            >
              YES
            </Button>
            <Button
              type="button"
              variant={resolution === 'NO' ? 'primary' : 'secondary'}
              onClick={() => setResolution('NO')}
              className="flex-1"
            >
              NO
            </Button>
          </div>
        </div>

        {/* Event Ended At */}
        <div>
          <Label htmlFor="eventEndedAt">
            Event Ended At
            <span className="text-text-dim text-xs ml-2">(for voiding post-event trades)</span>
          </Label>
          <Input
            id="eventEndedAt"
            type="datetime-local"
            value={eventEndedAt}
            onChange={(e) => setEventEndedAt(e.target.value)}
            required
            className="mt-1"
          />
          <p className="text-xs text-text-dim mt-1">
            Trades placed after this time will be voided and refunded
          </p>
        </div>

        {/* Trades to Void Preview */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-400 mb-2">
            ⚠️ {tradesToVoid.length} trade{tradesToVoid.length === 1 ? '' : 's'} will be voided (placed after event ended)
          </p>
          {tradesToVoid.length > 0 ? (
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-text-dim">
                  <tr>
                    <th className="text-left pb-1">User</th>
                    <th className="text-left pb-1">Action</th>
                    <th className="text-right pb-1">Amount</th>
                    <th className="text-right pb-1">Time</th>
                  </tr>
                </thead>
                <tbody className="text-white/90">
                  {tradesToVoid.map((trade) => (
                    <tr key={trade.id} className="border-t border-white/5">
                      <td className="py-1">{trade.userId.slice(0, 8)}...</td>
                      <td className="py-1">{trade.action} {trade.side}</td>
                      <td className="text-right py-1">{formatPoints(BigInt(trade.amountIn))} pts</td>
                      <td className="text-right py-1">{format(new Date(trade.createdAt), 'h:mm a')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-text-dim">No post-event trades for this time.</p>
          )}
          <p className="text-xs text-yellow-400 mt-2 font-medium">
            Total to refund: {formatPoints(totalRefund)} Points
          </p>
        </div>

        {/* Evidence */}
        <div>
          <Label htmlFor="evidence">Evidence / Notes</Label>
          <textarea
            id="evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="e.g., BTC reached $102,450 at 14:32 UTC on Dec 15"
            required
            rows={3}
            className="mt-1 w-full px-3 py-2 bg-surface-card border border-white/10 rounded-lg text-white placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Info Alert */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-blue-400">
            <strong>ℹ️ Note:</strong> Winners will receive 1 Point per winning share.
            Any trades placed after the event ended will be automatically voided and refunded.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={resolveMut.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={resolveMut.isPending}
            className="flex-1"
          >
            Resolve Market
          </Button>
        </div>
      </form>
    </Modal>
  );
}
