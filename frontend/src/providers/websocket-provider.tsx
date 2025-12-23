import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
        // Handled by specific components or we can update cache here
        break;

      case 'balance_update':
        // Invalidate user query to fetch new balance
        void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        toast.info('Balance updated');
        break;

      case 'trade_confirmed':
        toast.success(`Trade Confirmed! ${lastMessage.data?.side} ${lastMessage.data?.sharesOut} shares`);
        void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
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
