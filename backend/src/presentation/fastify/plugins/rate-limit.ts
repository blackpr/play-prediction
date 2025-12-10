import { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { getEnv } from '../../../shared/config/env';

/**
 * Rate Limiting Configuration with Redis Backend
 * 
 * Uses Redis as backing store for distributed rate limiting.
 * Falls back to in-memory if Redis is not available (dev only).
 */

export enum RateLimitType {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  TRADING = 'trading',
  ADMIN = 'admin',
}

interface RateLimitPreset {
  max: number;
  timeWindow: string;
}

const RATE_LIMIT_PRESETS: Record<RateLimitType, RateLimitPreset> = {
  [RateLimitType.PUBLIC]: { max: 100, timeWindow: '1 minute' },
  [RateLimitType.AUTHENTICATED]: { max: 60, timeWindow: '1 minute' },
  [RateLimitType.TRADING]: { max: 30, timeWindow: '1 minute' },
  [RateLimitType.ADMIN]: { max: 120, timeWindow: '1 minute' },
};

/**
 * Create Redis client for rate limiting
 */
function createRedisClient(): Redis | undefined {
  const redisUrl = getEnv('REDIS_URL', '');

  if (!redisUrl) {
    console.warn('⚠️  REDIS_URL not configured. Rate limiting will use in-memory storage.');
    return undefined;
  }

  try {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis rate-limit error:', err.message);
    });

    redis.on('connect', () => {
      console.log('✓ Redis connected for rate limiting');
    });

    return redis;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    return undefined;
  }
}

/**
 * Rate limit plugin for Fastify
 * 
 * Usage:
 * - Routes without config.rateLimit will NOT be rate limited (global: false)
 * - Apply rate limits using withRateLimit() helper
 */
export const registerRateLimit = fp(async function (fastify: FastifyInstance) {
  const redis = createRedisClient();

  await fastify.register(rateLimit, {
    global: false, // Only rate limit routes with explicit config
    max: 100,
    timeWindow: '1 minute',
    redis: redis,
    nameSpace: 'rl:',
    skipOnError: true,
    keyGenerator: (request: FastifyRequest) => {
      // Use user ID if authenticated, otherwise IP
      const user = (request as any).user;
      return user?.id ? `user:${user.id}` : request.ip;
    },
    // Let the global error handler format the 429 response
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    if (redis) {
      await redis.quit();
      console.log('✓ Redis rate-limit connection closed');
    }
  });

  console.log(`✓ Rate limit plugin registered (${redis ? 'Redis' : 'in-memory'})`);
});

/**
 * Helper to apply rate limiting to route options
 * 
 * Usage:
 * ```typescript
 * fastify.get('/api/markets', withRateLimit(RateLimitType.PUBLIC), handler);
 * ```
 */
export function withRateLimit(type: RateLimitType, options: Record<string, any> = {}) {
  const preset = RATE_LIMIT_PRESETS[type];
  return {
    ...options,
    config: {
      ...options.config,
      rateLimit: {
        max: preset.max,
        timeWindow: preset.timeWindow,
      },
    },
  };
}

/**
 * Create custom rate limit config for special cases
 */
export function customRateLimit(max: number, timeWindow: string, options: Record<string, any> = {}) {
  return {
    ...options,
    config: {
      ...options.config,
      rateLimit: { max, timeWindow },
    },
  };
}
