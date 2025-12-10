import { Redis } from 'ioredis';
import { requireEnv } from '../../shared/config/env';

/**
 * Shared Redis client instance for general application use (caching, rate limiting).
 * Kept as a singleton to avoid connection overhead.
 */
let redisClient: Redis | null = null;

/**
 * Returns the shared Redis client singleton.
 * Initializes it if it doesn't exist.
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisConnection();

    // Global error handler for the shared client
    redisClient.on('error', (err) => {
      console.error('[Redis] Shared client error:', err);
    });
  }
  return redisClient;
}

/**
 * Creates a NEW Redis connection.
 * Used by BullMQ which requires dedicated blocking connections.
 * 
 * @param options Optional overrides for Redis configuration
 */
export function createRedisConnection(options?: any): Redis {
  const connection = new Redis(requireEnv('REDIS_URL'), {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    ...options,
  });

  connection.on('ready', () => {
    // console.log('[Redis] Connection ready'); // Too noisy for every worker connection
  });

  return connection;
}

/**
 * Closes the shared Redis client.
 * Should be called on application shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Shared client closed');
  }
}
