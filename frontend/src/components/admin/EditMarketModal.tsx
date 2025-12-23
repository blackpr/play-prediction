import { useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { z } from 'zod';
import { Calendar, Upload, Loader2 } from 'lucide-react';

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
    closeBehavior?: 'auto' | 'manual' | 'auto_with_buffer';
    bufferMinutes?: number | null;
    pool?: { yesQty: string; noQty: string } | null;
  };
}

const MIN_SEED_LIQUIDITY = 1_000_000;

enum CloseBehavior {
  AUTO = 'auto',
  MANUAL = 'manual',
  AUTO_WITH_BUFFER = 'auto_with_buffer',
}

const CATEGORY_DEFAULTS: Record<string, { closeBehavior: CloseBehavior; bufferMinutes: number | null }> = {
  'Sports - Soccer': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
  'Sports - Basketball': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 30 },
  'Sports - Football': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 45 },
  'Sports - Other': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 15 },
  'Crypto': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
  'Weather': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
  'Politics': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
  'Entertainment': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
};

function toDateTimeLocalString(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function EditMarketModal({ isOpen, onClose, market }: EditMarketModalProps) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const closesAtInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form values logic
  const initialYesPrice = market.pool
    ? (Number(market.pool.noQty) / (Number(market.pool.yesQty) + Number(market.pool.noQty)))
    : 0.50;

  const seedLiquidity = market.pool
    ? (Number(market.pool.yesQty) + Number(market.pool.noQty)) / 2
    : 10_000_000;

  const updateMut = useMutation({
    mutationFn: async (values: any) => {
      const updates: Record<string, any> = {};

      if (values.title !== market.title) updates.title = values.title;
      if (values.description !== (market.description || '')) updates.description = values.description;
      if (values.category !== (market.category || '')) updates.category = values.category;
      if (values.imageUrl !== (market.imageUrl || '')) updates.imageUrl = values.imageUrl;

      const newCloseDate = new Date(values.closesAt);
      const oldCloseDate = market.closesAt ? new Date(market.closesAt) : null;
      if (oldCloseDate && newCloseDate.getTime() !== oldCloseDate.getTime()) {
        updates.closesAt = newCloseDate.toISOString();
      }

      // Logic for new fields
      if (values.seedLiquidity !== seedLiquidity) updates.seedLiquidity = values.seedLiquidity.toString();
      // Tolerance for float comparison
      if (Math.abs(values.initialYesPrice - initialYesPrice) > 0.001) updates.initialYesPrice = values.initialYesPrice;

      if (values.closeBehavior !== market.closeBehavior) updates.closeBehavior = values.closeBehavior;
      if (values.bufferMinutes !== (market.bufferMinutes || null)) updates.bufferMinutes = values.bufferMinutes;

      // Unset bufferMinutes for non-buffer modes (just to be safe, though validation handles it)
      if (values.closeBehavior !== CloseBehavior.AUTO_WITH_BUFFER && updates.bufferMinutes) updates.bufferMinutes = null;

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
      toast.error(error.message || 'Failed to update market');
    },
  });

  const form = useForm({
    defaultValues: {
      title: market.title,
      description: market.description || '',
      category: market.category || '',
      imageUrl: market.imageUrl || '',
      closesAt: market.closesAt ? toDateTimeLocalString(new Date(market.closesAt)) : '',
      seedLiquidity: seedLiquidity,
      initialYesPrice: initialYesPrice,
      closeBehavior: (market.closeBehavior as CloseBehavior) || CloseBehavior.AUTO,
      bufferMinutes: market.bufferMinutes || null,
    },
    onSubmit: async ({ value }) => {
      await updateMut.mutateAsync(value);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setValue: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post<{ url: string }>('/admin/upload/image', formData);
      setValue(res.data.url);
      toast.success('Image uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Market">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6 max-h-[80vh] overflow-y-auto px-1"
      >
        <div>
          <p className="text-sm text-text-dim mb-4">
            Editing: <span className="text-white font-medium">{market.title}</span>
          </p>
        </div>

        {/* Title */}
        <form.Field
          name="title"
          validators={{
            onChange: ({ value }) => !value ? 'Title is required' : value.length < 10 ? 'Title too short' : value.length > 500 ? 'Title too long' : undefined
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="title">Title <span className="text-red-400">*</span></Label>
              <Input
                id="title"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors.join(', ')}
              />
              <p className="text-xs text-text-dim mt-1">{field.state.value.length}/500 characters</p>
            </div>
          )}
        </form.Field>

        {/* Description */}
        <form.Field name="description">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Market description"
                rows={3}
                maxLength={5000}
              />
              <p className="text-xs text-text-dim mt-1">{field.state.value.length}/5000 characters</p>
            </div>
          )}
        </form.Field>

        {/* Category */}
        <form.Field
          name="category"
          validators={{
            onChange: ({ value }) => !value ? 'Category is required' : undefined
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={field.state.value}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  field.handleChange(newCategory);
                  // Update behaviors if switching categories (optional UX choice: auto-switch behavior? Yes, why not for consistency)
                  // BUT this is edit mode, maybe don't override user's manual settings unless asked?
                  // Let's stick to CreateMarketForm behavior for now to be "smart"
                  if (newCategory && CATEGORY_DEFAULTS[newCategory]) {
                    // Only if current behavior is default/null? Or just override? 
                    // Let's NOT override automatically on edit, as user might have custom settings.
                  }
                }}
              >
                <option value="">Select Category</option>
                <option value="Crypto">Crypto</option>
                <option value="Weather">Weather</option>
                <option value="Politics">Politics</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Sports - Soccer">Sports - Soccer</option>
                <option value="Sports - Basketball">Sports - Basketball</option>
                <option value="Sports - Football">Sports - Football</option>
                <option value="Sports - Other">Sports - Other</option>
              </Select>
              {field.state.meta.errors.length > 0 && (
                <p className="text-red-500 text-sm">{field.state.meta.errors.join(', ')}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Image URL with Upload */}
        <form.Field
          name="imageUrl"
          validators={{
            onChange: ({ value }) => value && !z.string().url().safeParse(value).success ? 'Invalid URL' : undefined
          }}
        >
          {(field) => (
            <div className="space-y-4">
              <Label htmlFor="imageUrl">Market Image</Label>
              <div className="flex gap-4 items-start">
                <div className="relative w-24 h-24 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                  {field.state.value ? (
                    <img src={field.state.value} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-gray-600 text-xs text-center p-2">No image</div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    id="imageUrl"
                    placeholder="https://..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(', ')}
                    disabled={isUploading}
                  />
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleFileUpload(e, field.handleChange)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form.Field>

        {/* Closes At */}
        <form.Field
          name="closesAt"
          validators={{
            onChange: ({ value }) => {
              if (!value) return 'Required';
              if (new Date(value) <= new Date()) return 'Must be in future';
              return undefined;
            }
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="closesAt">Closes At</Label>
              <div className="relative">
                <Input
                  id="closesAt"
                  ref={closesAtInputRef}
                  type="datetime-local"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.join(', ')}
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-white"
                  onClick={() => closesAtInputRef.current?.showPicker()}>
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}
        </form.Field>

        {/* Seed Liquidity */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <h4 className="text-sm font-medium text-white mb-4">Liquidity & Probability</h4>
          <div className="bg-amber-900/20 border border-amber-900/30 rounded p-3 mb-4">
            <p className="text-xs text-amber-500">
              ⚠️ <strong>Warning:</strong> Changing these values will reset the market's liquidity pool and treasury shares. This is safe for DRAFT markets but effectively restarts the market's genesis state.
            </p>
          </div>

          <form.Field
            name="seedLiquidity"
            validators={{
              onChange: ({ value }) => value < MIN_SEED_LIQUIDITY ? `Min ${MIN_SEED_LIQUIDITY}` : undefined
            }}
          >
            {(field) => (
              <div className="space-y-2 mb-4">
                <Label htmlFor="seedLiquidity">Seed Liquidity (MicroPoints)</Label>
                <Input
                  id="seedLiquidity"
                  type="number"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  error={field.state.meta.errors.join(', ')}
                />
              </div>
            )}
          </form.Field>

          {/* Initial Probability */}
          <form.Field
            name="initialYesPrice"
            validators={{
              onChange: ({ value }) => value < 0.01 || value > 0.99 ? 'Must be between 0.01 and 0.99' : undefined
            }}
          >
            {(field) => (
              <div className="space-y-4 border p-4 rounded-md bg-gray-50/5 dark:bg-gray-800/10">
                <div className="flex justify-between items-center">
                  <Label>Initial YES Probability</Label>
                  <span className="font-mono text-lg font-bold text-emerald-400">
                    {(field.state.value * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                  <div className="p-2 rounded bg-gray-900/50 border border-gray-800">
                    <p className="text-gray-400 text-xs">YES Price</p>
                    <p className="text-white font-mono">{field.state.value.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-gray-900/50 border border-gray-800">
                    <p className="text-gray-400 text-xs">NO Price</p>
                    <p className="text-white font-mono">{(1 - field.state.value).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </form.Field>
        </div>

        {/* Close Behavior */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <h4 className="text-sm font-medium text-white mb-4">Resolution Settings</h4>
          <div className="space-y-4 border p-4 rounded-md bg-gray-50/5 dark:bg-gray-800/10">
            <Label>Close Behavior</Label>
            <form.Field name="closeBehavior">
              {(field) => (
                <div className="grid gap-2">
                  {[
                    { val: CloseBehavior.AUTO, label: 'Auto Close', desc: 'Pauses immediately at close time.' },
                    { val: CloseBehavior.MANUAL, label: 'Manual Close', desc: 'Trading continues until admin closes.' },
                    { val: CloseBehavior.AUTO_WITH_BUFFER, label: 'Auto with Buffer', desc: 'Pauses after buffer period.' },
                  ].map((option) => (
                    <div key={option.val} className="flex items-start space-x-2">
                      <input
                        type="radio"
                        id={option.val}
                        name="closeBehavior"
                        value={option.val}
                        checked={field.state.value === option.val}
                        onChange={() => field.handleChange(option.val)}
                        className="mt-1"
                      />
                      <div>
                        <Label htmlFor={option.val}>{option.label}</Label>
                        <p className="text-sm text-gray-500">{option.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="bufferMinutes">
              {(field) => (
                <form.Subscribe selector={(state) => state.values.closeBehavior}>
                  {(behavior) => behavior === CloseBehavior.AUTO_WITH_BUFFER ? (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="bufferMinutes">Buffer Minutes</Label>
                      <Input
                        id="bufferMinutes"
                        type="number"
                        placeholder="e.g. 30"
                        value={field.state.value || ''}
                        onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                  ) : null}
                </form.Subscribe>
              )}
            </form.Field>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={updateMut.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                variant="primary"
                isLoading={updateMut.isPending || isSubmitting}
                disabled={!canSubmit || updateMut.isPending || isSubmitting}
                className="flex-1"
              >
                Save Changes
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </Modal>
  );
}
