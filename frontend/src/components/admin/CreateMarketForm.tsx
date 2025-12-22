import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { api } from '../../api/client';
import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

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

export function CreateMarketForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<any>(null);
  const closesAtInputRef = useRef<HTMLInputElement>(null);

  const createMarketMut = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        closesAt: new Date(data.closesAt).toISOString(),
        seedLiquidity: data.seedLiquidity.toString(),
      };

      if (!payload.imageUrl) delete payload.imageUrl;
      if (payload.closeBehavior !== CloseBehavior.AUTO_WITH_BUFFER) delete payload.bufferMinutes;

      return api.post('/admin/markets', payload);
    },
    onSuccess: () => {
      toast.success('Market created successfully');
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      setModalOpen(false);
      navigate({ to: '/admin/markets' });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create market');
      setModalOpen(false);
    },
  });

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      category: '',
      imageUrl: '',
      closesAt: '',
      seedLiquidity: 10_000_000,
      closeBehavior: CloseBehavior.AUTO as CloseBehavior,
      bufferMinutes: null as number | null,
    },
    onSubmit: async ({ value }) => {
      setPendingValues(value);
      setModalOpen(true);
    },
  });

  const handleConfirm = async () => {
    if (pendingValues) {
      await createMarketMut.mutateAsync(pendingValues);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Market</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            {/* Title */}
            <form.Field
              name="title"
              validators={{
                onChange: ({ value }) => !value ? 'Title is required' : value.length > 500 ? 'Title too long' : undefined
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Will Bitcoin hit $100k?"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(', ')}
                  />
                </div>
              )}
            </form.Field>

            {/* Description */}
            <form.Field
              name="description"
              validators={{
                onChange: ({ value }) => !value ? 'Description is required' : undefined
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Market resolution details..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-red-500 text-sm">{field.state.meta.errors.join(', ')}</p>
                  )}
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

                      // Side effect: update defaults
                      if (newCategory && CATEGORY_DEFAULTS[newCategory]) {
                        const defaults = CATEGORY_DEFAULTS[newCategory];
                        form.setFieldValue('closeBehavior', defaults.closeBehavior);
                        form.setFieldValue('bufferMinutes', defaults.bufferMinutes);
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

            {/* Image URL */}
            <form.Field
              name="imageUrl"
              validators={{
                onChange: ({ value }) => value && !z.string().url().safeParse(value).success ? 'Invalid URL' : undefined
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(', ')}
                  />
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
                      className="pr-10" // Add padding for icon
                    />
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-white"
                      onClick={() => {
                        closesAtInputRef.current?.showPicker();
                      }}
                    >
                      <Calendar className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              )}
            </form.Field>

            {/* Seed Liquidity */}
            <form.Field
              name="seedLiquidity"
              validators={{
                onChange: ({ value }) => value < MIN_SEED_LIQUIDITY ? `Min ${MIN_SEED_LIQUIDITY}` : undefined
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="seedLiquidity">Seed Liquidity (MicroPoints)</Label>
                  <Input
                    id="seedLiquidity"
                    type="number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(', ')}
                  />
                  <p className="text-xs text-gray-500">Default: 10,000,000 (10 Points)</p>
                </div>
              )}
            </form.Field>

            {/* Close Behavior */}
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

              <form.Subscribe
                selector={(state) => [state.values.category, state.values.closeBehavior]}
              >
                {([cat, behavior]) => (
                  cat?.includes('Sports') && behavior === CloseBehavior.AUTO ? (
                    <div className="text-amber-500 text-sm bg-amber-100/10 p-2 rounded">
                      ⚠️ Sports matches often have added time. Consider "Manual" or "Buffer".
                    </div>
                  ) : null
                )}
              </form.Subscribe>

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

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting || createMarketMut.isPending} className="w-full">
                  {isSubmitting || createMarketMut.isPending ? 'Review Market' : 'Create Market'}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm Market Creation"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Title</p>
            <p className="font-medium text-white">{pendingValues?.title}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Description</p>
            <p className="text-sm text-white line-clamp-3">{pendingValues?.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Category</p>
              <p className="text-white">{pendingValues?.category}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Seed Liquidity</p>
              <p className="text-white">{(pendingValues?.seedLiquidity / 1_000_000).toFixed(2)} Points</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Closes At</p>
              <p className="text-white">{pendingValues?.closesAt ? format(new Date(pendingValues.closesAt), 'PPP p') : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Close Behavior</p>
              <p className="text-white capitalize">{pendingValues?.closeBehavior?.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={createMarketMut.isPending}
              isLoading={createMarketMut.isPending}
            >
              Confirm & Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
