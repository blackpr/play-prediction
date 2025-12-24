import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Label } from '../ui/Label';
import { adminApi } from '../../api/admin';
import type { Category, NewCategory } from '../../api/types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null; // If provided, we're in "Edit" mode
}

export function CategoryModal({ isOpen, onClose, category }: CategoryModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!category;

  const [formData, setFormData] = useState<NewCategory>({
    name: '',
    slug: '',
    description: '',
    sortOrder: 0,
    isActive: true,
    defaultCloseBehavior: 'auto_with_buffer',
    defaultBufferMinutes: 30,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-generate slug from name if not editing
  useEffect(() => {
    if (!isEditing && formData.name) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, isEditing]);

  // Load category data when editing
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        defaultCloseBehavior: category.defaultCloseBehavior,
        defaultBufferMinutes: category.defaultBufferMinutes,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        sortOrder: 0,
        isActive: true,
        defaultCloseBehavior: 'auto_with_buffer',
        defaultBufferMinutes: 30,
      });
    }
    setError(null);
    setSuccess(false);
  }, [category, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await adminApi.updateCategory(category.id, formData);
      } else {
        await adminApi.createCategory(formData);
      }

      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });

      // Close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Category' : 'Create New Category'}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Category {isEditing ? 'updated' : 'created'} successfully!</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">Category Name</Label>
          <Input
            id="name"
            placeholder="e.g. Sports - Basketball"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
            disabled={isLoading || success}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug (URL path)</Label>
          <Input
            id="slug"
            placeholder="e.g. sports-basketball"
            value={formData.slug}
            onChange={e => setFormData({ ...formData, slug: e.target.value })}
            required
            disabled={isLoading || success}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Brief description of this category..."
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            disabled={isLoading || success}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              value={formData.sortOrder}
              onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              required
              disabled={isLoading || success}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="isActive">Status</Label>
            <Select
              id="isActive"
              value={formData.isActive ? 'true' : 'false'}
              onChange={e => setFormData({ ...formData, isActive: e.target.value === 'true' })}
              disabled={isLoading || success}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
        </div>

        <div className="border-t border-white/5 pt-4 mt-4 space-y-4">
          <h3 className="text-sm font-medium text-text-muted">Default Market Settings</h3>

          <div className="space-y-1.5">
            <Label htmlFor="defaultCloseBehavior">Default Close Behavior</Label>
            <Select
              id="defaultCloseBehavior"
              value={formData.defaultCloseBehavior}
              onChange={e => setFormData({ ...formData, defaultCloseBehavior: e.target.value as any })}
              disabled={isLoading || success}
            >
              <option value="auto">Auto (Close at expiresAt)</option>
              <option value="manual">Manual (Admin must close)</option>
              <option value="auto_with_buffer">Auto with Buffer (expiresAt + buffer)</option>
            </Select>
          </div>

          {formData.defaultCloseBehavior === 'auto_with_buffer' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label htmlFor="defaultBufferMinutes">Default Buffer Minutes</Label>
              <Input
                id="defaultBufferMinutes"
                type="number"
                min="1"
                placeholder="30"
                value={formData.defaultBufferMinutes || ''}
                onChange={e => setFormData({ ...formData, defaultBufferMinutes: parseInt(e.target.value) || null })}
                required
                disabled={isLoading || success}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading || success}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={success}
          >
            {isEditing ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
