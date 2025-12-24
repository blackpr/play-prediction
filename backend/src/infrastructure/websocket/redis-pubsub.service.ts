import { Redis } from 'ioredis';
import { createRedisConnection } from '../redis/connection';
import { WebSocketMessage } from './websocket-manager';

/**
 * Redis Pub/Sub Service for WebSocket Broadcasting
 * 
 * Enables horizontal scaling by broadcasting WebSocket messages across multiple server instances.
 * Each server instance subscribes to Redis channels and forwards messages to local WebSocket clients.
 * 
 * Architecture:
 * - Publisher: Publishes messages to Redis channels
 * - Subscriber: Subscribes to Redis channels and forwards to WebSocketManager
 * - Each server instance has its own subscriber connection
 * 
 * Channel Patterns:
 * - ws:broadcast:{channel} - Broadcast to all subscribers of a channel (e.g., market:xyz)
 * - ws:user:{userId} - Send to specific user (all their connections across all servers)
 */
export class RedisPubSubService {
  private publisher: Redis;
  private subscriber: Redis;
  private messageHandler: ((channel: string, message: string) => void) | null = null;
  private isSubscribed = false;

  constructor() {
    // Create dedicated connections for pub/sub
    // BullMQ pattern: separate connections for publishing and subscribing
    this.publisher = createRedisConnection();
    this.subscriber = createRedisConnection();

    this.publisher.on('error', (err) => {
      console.error('[RedisPubSub] Publisher error:', err);
    });

    this.subscriber.on('error', (err) => {
      console.error('[RedisPubSub] Subscriber error:', err);
    });

    // Handle Redis messages
    this.subscriber.on('message', (channel: string, message: string) => {
      if (this.messageHandler) {
        this.messageHandler(channel, message);
      }
    });

    // Handle pattern-based subscriptions
    this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      if (this.messageHandler) {
        this.messageHandler(channel, message);
      }
    });
  }

  /**
   * Set the message handler that will be called when messages are received
   */
  setMessageHandler(handler: (channel: string, message: string) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Subscribe to Redis channels for WebSocket messages.
   * This should be called once during app initialization.
   */
  async subscribe(): Promise<void> {
    if (this.isSubscribed) {
      return;
    }

    // Subscribe to pattern-based channels
    // ws:broadcast:* - for channel broadcasts (market:xyz, global, etc.)
    // ws:user:* - for user-specific messages
    await this.subscriber.psubscribe('ws:broadcast:*', 'ws:user:*');
    
    this.isSubscribed = true;
    console.log('[RedisPubSub] Subscribed to WebSocket channels');
  }

  /**
   * Broadcast a message to all subscribers of a WebSocket channel across all server instances.
   * 
   * @param channel - WebSocket channel name (e.g., "market:mkt_123", "global")
   * @param message - WebSocket message to broadcast
   */
  async broadcastToChannel(channel: string, message: Partial<WebSocketMessage>): Promise<void> {
    const redisChannel = `ws:broadcast:${channel}`;
    const payload = JSON.stringify({
      channel,
      message: {
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      },
    });

    await this.publisher.publish(redisChannel, payload);
  }

  /**
   * Send a message to a specific user across all server instances.
   * All connections belonging to this user (on any server) will receive the message.
   * 
   * @param userId - User ID
   * @param message - WebSocket message to send
   */
  async sendToUser(userId: string, message: Partial<WebSocketMessage>): Promise<void> {
    const redisChannel = `ws:user:${userId}`;
    const payload = JSON.stringify({
      userId,
      message: {
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      },
    });

    await this.publisher.publish(redisChannel, payload);
  }

  /**
   * Shutdown pub/sub connections gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isSubscribed) {
      await this.subscriber.punsubscribe();
      this.isSubscribed = false;
    }

    await Promise.all([
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);

    console.log('[RedisPubSub] Connections closed');
  }
}

