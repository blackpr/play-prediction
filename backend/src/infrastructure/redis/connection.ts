import Redis from 'ioredis';
import { getEnv } from '../../shared/config/env';

let redisInstance: Redis | undefined;

export function createRedisClient(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  const redisUrl = getEnv('REDIS_URL', 'redis://localhost:6379');

  redisInstance = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 50, 2000);
    },
  });

  redisInstance.on('error', (err) => {
    console.error('Redis error:', err);
  });

  redisInstance.on('connect', () => {
    console.log('✓ Redis connected');
  });

  return redisInstance;
}

export function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    return redisInstance.quit().then(() => {
      redisInstance = undefined;
    });
  }
  return Promise.resolve();
}
