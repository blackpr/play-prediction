import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export interface AdminStats {
  totalUsers: number;
  activeMarkets: number;
  pendingResolutionMarkets: number;
  volume24h: string;
  recentTrades: {
    id: string;
    marketTitle: string;
    action: string;
    amountIn: string;
    createdAt: string;
    user: string | null;
  }[];
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
