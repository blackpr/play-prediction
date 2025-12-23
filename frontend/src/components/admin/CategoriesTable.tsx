import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Category } from '../../api/types';
import { CategoryModal } from './CategoryModals';
import { toast } from 'sonner';

export function CategoriesTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories', includeInactive],
    queryFn: async () => {
      const response = await adminApi.listCategories({ includeInactive });
      return response.data;
    },
  });

  // Filter local data for search
  const filteredCategories = data?.filter(cat =>
    cat.name.toLowerCase().includes(search.toLowerCase()) ||
    cat.slug.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Mutations
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete category');
    }
  });

  const handleDelete = (category: Category) => {
    if (window.confirm(`Are you sure you want to delete category "${category.name}"? This will fail if there are linked markets.`)) {
      deleteMut.mutate(category.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="w-full sm:w-72 relative">
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-white/10 bg-white/5 text-primary focus:ring-primary h-4 w-4"
            />
            Show Inactive
          </label>
          <Button
            variant="primary"
            onClick={() => {
              setSelectedCategory(null);
              setModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Category
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden bg-surface-card shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-surface-highlight text-text-muted uppercase text-xs">
              <tr>
                <th className="px-6 py-3 w-16">Order</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Slug</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3">Defaults</th>
                <th className="px-6 py-3 text-right">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-8 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-40"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-24 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-white/5 rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-dim">
                    No categories found
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 text-center font-mono text-text-muted">
                      {cat.sortOrder}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{cat.name}</span>
                        {cat.description && (
                          <span className="text-xs text-text-dim truncate max-w-[200px]" title={cat.description}>
                            {cat.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-dim">
                      /{cat.slug}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={cat.isActive ? 'success' : 'default'}>
                        {cat.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-dim space-y-1">
                      <div>Behavior: <span className="text-text-muted capitalize">{cat.defaultCloseBehavior.replace(/_/g, ' ')}</span></div>
                      {cat.defaultCloseBehavior === 'auto_with_buffer' && (
                        <div>Buffer: <span className="text-text-muted">{cat.defaultBufferMinutes}m</span></div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-text-dim tabular-nums">
                      {format(new Date(cat.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setModalOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                          title="Edit Category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(cat)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Delete Category"
                          isLoading={deleteMut.isPending && deleteMut.variables === cat.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CategoryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCategory(null);
        }}
        category={selectedCategory}
      />
    </div>
  );
}
