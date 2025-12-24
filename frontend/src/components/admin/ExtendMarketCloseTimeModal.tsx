import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { differenceInHours, differenceInMinutes, format, parse } from 'date-fns';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';

interface ExtendMarketCloseTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketId: string;
  marketTitle: string;
  currentClosesAt: string | null;
}

function toDateTimeLocalString(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function parseDateTimeLocal(value: string) {
  return parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
}

export function ExtendMarketCloseTimeModal({
  isOpen,
  onClose,
  marketId,
  marketTitle,
  currentClosesAt,
}: ExtendMarketCloseTimeModalProps) {
  const queryClient = useQueryClient();
  const [newClosesAt, setNewClosesAt] = useState(() => {
    // Default to current close time + 1 hour
    if (currentClosesAt) {
      const current = new Date(currentClosesAt);
      current.setHours(current.getHours() + 1);
      return toDateTimeLocalString(current);
    }
    return toDateTimeLocalString(new Date());
  });
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // Reset form when modal opens
    if (currentClosesAt) {
      const current = new Date(currentClosesAt);
      current.setHours(current.getHours() + 1);
      setNewClosesAt(toDateTimeLocalString(current));
    } else {
      setNewClosesAt(toDateTimeLocalString(new Date()));
    }
    setReason('');
  }, [isOpen, currentClosesAt]);

  // Calculate extension duration
  const extensionDuration = useMemo(() => {
    if (!currentClosesAt) return null;

    const currentDate = new Date(currentClosesAt);
    const newDate = parseDateTimeLocal(newClosesAt);

    const hours = differenceInHours(newDate, currentDate);
    const minutes = differenceInMinutes(newDate, currentDate) % 60;

    if (hours < 0 || (hours === 0 && minutes < 0)) {
      return 'Invalid: new time is before current close time';
    }

    if (hours === 0 && minutes === 0) {
      return 'No extension';
    }

    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);

    return `Extending by ${parts.join(' ')}`;
  }, [currentClosesAt, newClosesAt]);

  // Validation
  const validationError = useMemo(() => {
    if (!currentClosesAt) return 'Market does not have a close time';

    const now = new Date();
    const newDate = parseDateTimeLocal(newClosesAt);
    const currentDate = new Date(currentClosesAt);

    if (newDate <= now) {
      return 'New close time must be in the future';
    }

    if (newDate <= currentDate) {
      return 'New close time must be after current close time';
    }

    return null;
  }, [currentClosesAt, newClosesAt]);

  const extendMut = useMutation({
    mutationFn: async () => {
      return api.patch(`/admin/markets/${marketId}/extend`, {
        newClosesAt: parseDateTimeLocal(newClosesAt).toISOString(),
        reason: reason.trim(),
      });
    },
    onSuccess: (response) => {
      const data = response.data as any;
      toast.success('Market close time extended', {
        description: `New close time: ${format(new Date(data.newClosesAt), 'PPp')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-markets'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to extend market close time', {
        description: error.response?.data?.error?.message || error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error('Reason is required');
      return;
    }

    if (validationError) {
      toast.error(validationError);
      return;
    }

    extendMut.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Extend Market Close Time">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-text-dim mb-4">
            Market: <span className="text-white font-medium">{marketTitle}</span>
          </p>
        </div>

        {/* Current Close Time */}
        {currentClosesAt && (
          <div className="bg-surface-highlight border border-white/10 rounded-lg p-3">
            <p className="text-xs text-text-dim mb-1">Current Close Time</p>
            <p className="text-sm text-white font-medium">
              {format(new Date(currentClosesAt), 'PPp')}
            </p>
          </div>
        )}

        {/* New Close Time */}
        <div>
          <Label htmlFor="newClosesAt">New Close Time</Label>
          <Input
            id="newClosesAt"
            type="datetime-local"
            value={newClosesAt}
            onChange={(e) => setNewClosesAt(e.target.value)}
            required
            className="mt-1"
          />
          {extensionDuration && (
            <p className={`text-xs mt-1 ${validationError ? 'text-red-400' : 'text-emerald-400'
              }`}>
              {validationError || extensionDuration}
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <Label htmlFor="reason">
            Reason
            <span className="text-red-400 ml-1">*</span>
          </Label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Event delayed due to weather conditions"
            required
            maxLength={500}
            rows={3}
            className="mt-1 w-full px-3 py-2 bg-surface-card border border-white/10 rounded-lg text-white placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-text-dim mt-1">
            {reason.length}/500 characters
          </p>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-blue-400">
            <strong>ℹ️ Note:</strong> Extending the close time allows more time for trading before the market closes.
            This action will be logged in the audit trail.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={extendMut.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={extendMut.isPending}
            disabled={!!validationError}
            className="flex-1"
          >
            Extend Close Time
          </Button>
        </div>
      </form>
    </Modal>
  );
}
