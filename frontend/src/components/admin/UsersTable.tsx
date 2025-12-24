import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Gift, Search } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { formatPoints } from '../../utils';
import { GrantPointsModal } from './GrantPointsModal';
import type { BadgeVariant } from '../ui/Badge';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'treasury';
  balance: string;
  isActive: boolean;
  createdAt: string;
}

interface UsersResponse {
  items: Array<User>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const ROLE_VARIANTS: Record<string, BadgeVariant> = {
  admin: 'error',
  treasury: 'warning',
  user: 'default',
};

export function UsersTable() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [grantPointsModalOpen, setGrantPointsModalOpen] = useState(false);

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
    queryKey: ['admin-users', page, role, debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: page.toString(),
        pageSize: '10',
      };
      if (role !== 'all') {
        params.role = role;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const response = await api.get<UsersResponse>('/admin/users', { params });
      return response;
    },
    placeholderData: (prev) => prev,
  });

  // Access the actual data from the API response envelope
  const usersData = data?.data;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="w-full sm:w-72 relative">
          <div className="relative">
            <Input
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-full sm:w-48">
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="treasury">Treasury</option>
            </Select>
          </div>
          <Button
            variant="primary"
            onClick={() => setGrantPointsModalOpen(true)}
            leftIcon={<Gift className="w-4 h-4" />}
          >
            Grant Points
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden bg-surface-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface-highlight text-text-muted uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3 text-center">Role</th>
              <th className="px-6 py-3 text-right">Balance</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3 text-right">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-3/4"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16 mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-20 ml-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16 mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-24 ml-auto"></div></td>
                </tr>
              ))
            ) : !usersData?.items || usersData.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-dim">
                  No users found
                </td>
              </tr>
            ) : (
              usersData.items.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant={ROLE_VARIANTS[user.role] ?? 'default'}>
                      {user.role.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-400">
                    {formatPoints(BigInt(user.balance))} Points
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant={user.isActive ? 'success' : 'error'}>
                      {user.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right text-text-dim tabular-nums">
                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Grant Points Modal */}
      <GrantPointsModal
        isOpen={grantPointsModalOpen}
        onClose={() => setGrantPointsModalOpen(false)}
      />

      {/* Pagination */}
      {usersData && usersData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-dim">
            Page {usersData.pagination.page} of {usersData.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!usersData.pagination.hasPrev || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!usersData.pagination.hasNext || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
