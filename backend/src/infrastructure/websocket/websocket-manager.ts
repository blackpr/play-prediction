import { WebSocket } from 'ws';
import type { RedisPubSubService } from './redis-pubsub.service';

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
  private redisPubSub: RedisPubSubService | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Initialize Redis pub/sub for multi-server broadcasting.
   * Should be called during app startup after DI container is ready.
   */
  async initializeRedisPubSub(redisPubSub: RedisPubSubService): Promise<void> {
    this.redisPubSub = redisPubSub;

    // Set up message handler to forward Redis messages to local WebSocket clients
    redisPubSub.setMessageHandler((redisChannel: string, payload: string) => {
      try {
        const parsed = JSON.parse(payload);

        // Handle broadcast messages
        if (redisChannel.startsWith('ws:broadcast:')) {
          const { channel, message } = parsed;
          this.broadcastLocal(channel, message);
        }
        // Handle user-specific messages
        else if (redisChannel.startsWith('ws:user:')) {
          const { userId, message } = parsed;
          this.sendToUserLocal(userId, message);
        }
      } catch (err) {
        console.error('[WebSocketManager] Failed to parse Redis message:', err);
      }
    });

    // Subscribe to Redis channels
    await redisPubSub.subscribe();
    console.log('[WebSocketManager] Redis pub/sub initialized');
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

  /**
   * Broadcast message to all subscribers of a channel.
   * If Redis pub/sub is enabled, publishes to Redis for multi-server support.
   * Otherwise, only broadcasts to local connections.
   */
  async broadcast(channel: string, message: Partial<WebSocketMessage>): Promise<void> {
    if (this.redisPubSub) {
      // Publish to Redis - will be received by all server instances (including this one)
      await this.redisPubSub.broadcastToChannel(channel, message);
    } else {
      // Fallback: Only broadcast to local connections (single-server mode)
      this.broadcastLocal(channel, message);
    }
  }

  /**
   * Send message to a specific user.
   * If Redis pub/sub is enabled, publishes to Redis for multi-server support.
   * Otherwise, only sends to local connections.
   */
  async sendToUser(userId: string, message: Partial<WebSocketMessage>): Promise<void> {
    if (this.redisPubSub) {
      // Publish to Redis - will be received by all server instances
      await this.redisPubSub.sendToUser(userId, message);
    } else {
      // Fallback: Only send to local connections (single-server mode)
      this.sendToUserLocal(userId, message);
    }
  }

  /**
   * Broadcast to local WebSocket clients only (not through Redis).
   * Called by Redis message handler to avoid infinite loops.
   * @private
   */
  private broadcastLocal(channel: string, message: Partial<WebSocketMessage>): void {
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

  /**
   * Send to local user connections only (not through Redis).
   * Called by Redis message handler to avoid infinite loops.
   * @private
   */
  private sendToUserLocal(userId: string, message: Partial<WebSocketMessage>): void {
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

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all WebSocket connections
    for (const userClients of this.clients.values()) {
      for (const client of userClients) {
        client.socket.close(1001, 'Server shutting down');
      }
    }
    this.clients.clear();

    // Shutdown Redis pub/sub
    if (this.redisPubSub) {
      await this.redisPubSub.shutdown();
    }
  }
}
