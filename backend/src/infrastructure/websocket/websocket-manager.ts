import { WebSocket } from '@fastify/websocket';

export interface WebSocketMessage {
  type: string;
  id?: string;
  channel?: string;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  id?: string;
  channel?: string;
  params?: any;
}

export class WebSocketClient {
  public readonly sessionId: string;
  public readonly subscriptions: Set<string> = new Set();
  private lastPing: number = Date.now();

  constructor(
    public readonly socket: WebSocket,
    public readonly userId: string
  ) {
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  send(message: Partial<WebSocketMessage>): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  sendError(code: string, message: string, id?: string): void {
    this.send({
      type: 'error',
      id,
      error: { code, message },
    });
  }

  subscribe(channel: string): void {
    this.subscriptions.add(channel);
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
  }

  updatePing(): void {
    this.lastPing = Date.now();
  }

  isAlive(): boolean {
    return Date.now() - this.lastPing < 60000; // 60 seconds timeout
  }
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private clients: Map<string, WebSocketClient[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  add(client: WebSocketClient): void {
    const userClients = this.clients.get(client.userId) || [];

    // Limit connections per user
    if (userClients.length >= 5) {
      client.sendError('MAX_CONNECTIONS', 'Maximum connections per user reached');
      client.socket.close(1008, 'Too many connections');
      return;
    }

    userClients.push(client);
    this.clients.set(client.userId, userClients);
  }

  remove(client: WebSocketClient): void {
    const userClients = this.clients.get(client.userId);
    if (userClients) {
      const index = userClients.indexOf(client);
      if (index > -1) {
        userClients.splice(index, 1);
      }
      if (userClients.length === 0) {
        this.clients.delete(client.userId);
      }
    }
  }

  broadcast(channel: string, message: Partial<WebSocketMessage>): void {
    for (const userClients of this.clients.values()) {
      for (const client of userClients) {
        if (client.subscriptions.has(channel)) {
          client.send({
            ...message,
            channel,
          });
        }
      }
    }
  }

  sendToUser(userId: string, message: Partial<WebSocketMessage>): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      for (const client of userClients) {
        client.send(message);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const userClients of this.clients.values()) {
        for (const client of userClients) {
          if (!client.isAlive()) {
            client.socket.close(1000, 'Heartbeat timeout');
            this.remove(client);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const userClients of this.clients.values()) {
      for (const client of userClients) {
        client.socket.close(1001, 'Server shutting down');
      }
    }
    this.clients.clear();
  }
}
