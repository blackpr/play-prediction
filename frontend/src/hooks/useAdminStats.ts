import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export interface AdminStats {
  users: {
    total: number;
    activeLastWeek: number;
  };
  markets: {
    total: number;
    active: number;
    pendingResolution: number;
    resolved: number;
    cancelled: number;
  };
  volume: {
    total: string;
    last24h: string;
  };
  recentTrades: Array<{
    id: string;
    marketTitle: string;
    action: string;
    amountIn: string;
    createdAt: string;
    user: string | null;
  }>;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await api.get<AdminStats>('/admin/stats');
      return response.data;
    },
    refetchInterval: 60000,
  });
}
