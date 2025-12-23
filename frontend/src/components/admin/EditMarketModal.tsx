import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EditMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    imageUrl: string | null;
    closesAt: string | null;
  };
}

function toDateTimeLocalString(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function EditMarketModal({ isOpen, onClose, market }: EditMarketModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [closesAt, setClosesAt] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle(market.title);
    setDescription(market.description || '');
    setCategory(market.category || '');
    setImageUrl(market.imageUrl || '');
    setClosesAt(market.closesAt ? toDateTimeLocalString(new Date(market.closesAt)) : '');
  }, [isOpen, market]);

  const updateMut = useMutation({
    mutationFn: async () => {
      const updates: Record<string, any> = {};
      if (title !== market.title) updates.title = title;
      if (description !== (market.description || '')) updates.description = description;
      if (category !== (market.category || '')) updates.category = category;
      if (imageUrl !== (market.imageUrl || '')) updates.imageUrl = imageUrl;
      if (closesAt && closesAt !== toDateTimeLocalString(new Date(market.closesAt!))) {
        updates.closesAt = new Date(closesAt).toISOString();
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No changes to save');
      }

      return api.patch(`/admin/markets/${market.id}`, updates);
    },
    onSuccess: () => {
      toast.success('Market updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-markets'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to update market', {
        description: error.response?.data?.error?.message || error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.length < 10) {
      toast.error('Title must be at least 10 characters');
      return;
    }
    updateMut.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Market">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-text-dim mb-4">
            Editing: <span className="text-white font-medium">{market.title}</span>
          </p>
        </div>

        {/* Title */}
        <div>
          <Label htmlFor="title">
            Title <span className="text-red-400">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Market title (min 10 characters)"
            required
            minLength={10}
            maxLength={500}
            className="mt-1"
          />
          <p className="text-xs text-text-dim mt-1">
            {title.length}/500 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Market description"
            rows={3}
            maxLength={5000}
            className="mt-1 w-full px-3 py-2 bg-surface-card border border-white/10 rounded-lg text-white placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-text-dim mt-1">
            {description.length}/5000 characters
          </p>
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Crypto, Sports, Politics"
            maxLength={100}
            className="mt-1"
          />
        </div>

        {/* Image URL */}
        <div>
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input
            id="imageUrl"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            maxLength={2048}
            className="mt-1"
          />
        </div>

        {/* Closes At */}
        <div>
          <Label htmlFor="closesAt">Closes At</Label>
          <Input
            id="closesAt"
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-text-dim mt-1">
            When the market will close for trading
          </p>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-blue-400">
            <strong>ℹ️ Note:</strong> Only DRAFT markets can be edited. Seed liquidity and close behavior cannot be changed.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={updateMut.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMut.isPending}
            className="flex-1"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
