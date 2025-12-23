import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  send: (type: string, payload?: any) => void;
  lastMessage: WebSocketMessage | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const subscriptions = useRef<Set<string>>(new Set());
  const pingInterval = useRef<NodeJS.Timeout | undefined>(undefined);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      console.log('WS Connected');

      // Resubscribe to active channels
      subscriptions.current.forEach(channel => {
        socket.send(JSON.stringify({ type: 'subscribe', channel }));
      });

      // Start ping interval
      pingInterval.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);

        // Handle errors
        if (message.type === 'error') {
          console.error('WS Error:', message.error);
          toast.error(`WebSocket Error: ${message.error.message}`);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    socket.onclose = () => {
      setStatus('disconnected');
      clearInterval(pingInterval.current);

      // Attempt reconnect
      reconnectTimeout.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = (err) => {
      console.error('WS Connection Error:', err);
      setStatus('error');
      socket.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    clearTimeout(reconnectTimeout.current);
    clearInterval(pingInterval.current);
  }, []);

  const subscribe = useCallback((channel: string) => {
    subscriptions.current.add(channel);
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'subscribe', channel }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    subscriptions.current.delete(channel);
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
    }
  }, []);

  const send = useCallback((type: string, payload?: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    subscribe,
    unsubscribe,
    send,
    lastMessage
  };
}
