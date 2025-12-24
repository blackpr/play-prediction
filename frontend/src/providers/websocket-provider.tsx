import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';

import { useWebSocket, type WebSocketStatus } from '../hooks/use-websocket';

interface WebSocketContextType {
  status: WebSocketStatus;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { status, subscribe, unsubscribe, lastMessage } = useWebSocket();
  const queryClient = useQueryClient();

  // Global event handling
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'price_update':
        // Update market cache instantly with setQueryData
        if (lastMessage.data?.marketId) {
          queryClient.setQueryData(
            ['market', lastMessage.data.marketId],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                yesPrice: lastMessage.data.yesPrice,
                noPrice: lastMessage.data.noPrice,
                pool: {
                  ...old.pool,
                  yesQty: lastMessage.data.yesQty,
                  noQty: lastMessage.data.noQty,
                },
                volume24h: lastMessage.data.volume24h,
              };
            }
          );
        }
        break;

      case 'balance_update':
        void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        toast.info('Balance updated');
        break;

      case 'trade_confirmed':
        toast.success(`Trade Confirmed! ${lastMessage.data?.side} ${lastMessage.data?.sharesOut} shares`);
        void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        break;

      case 'market_resolved':
        if (lastMessage.data?.marketId) {
          void queryClient.invalidateQueries({ queryKey: ['market', lastMessage.data.marketId] });
        }
        void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        toast.info(`Market resolved: ${lastMessage.data?.resolution}`);
        break;

      case 'market_state':
        if (lastMessage.data?.marketId) {
          void queryClient.invalidateQueries({ queryKey: ['market', lastMessage.data.marketId] });
        }
        toast.info(`Market ${lastMessage.data?.newStatus?.toLowerCase()}`);
        break;

      case 'new_market':
        if (lastMessage.data?.marketId && lastMessage.data?.title) {
          toast.success(
            <div>
              <div className="font-semibold">New Market Available!</div>
              <Link
                to="/markets/$marketId"
                params={{ marketId: lastMessage.data.marketId }}
                className="text-sm text-blue-400 hover:underline"
              >
                {lastMessage.data.title}
              </Link>
            </div>,
            { duration: 5000 }
          );
        }
        void queryClient.invalidateQueries({ queryKey: ['markets'] });
        break;

      case 'resolution_payout':
        if (lastMessage.data?.payout) {
          toast.success(
            <div>
              <div className="font-semibold">Resolution Payout!</div>
              <div className="text-sm">You received {Number(lastMessage.data.payout) / 1_000_000} points</div>
              {lastMessage.data.marketTitle && (
                <div className="text-xs text-gray-400">{lastMessage.data.marketTitle}</div>
              )}
            </div>,
            { duration: 7000 }
          );
        }
        void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        break;
    }
  }, [lastMessage, queryClient]);

  return (
    <WebSocketContext.Provider value={{ status, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
