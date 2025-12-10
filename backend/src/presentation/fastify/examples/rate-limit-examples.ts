/**
 * Rate Limiting Usage Examples
 * 
 * This file demonstrates how to apply rate limiting to routes in the application.
 */

import { FastifyInstance } from 'fastify';
import { RateLimitType, withRateLimit } from '../plugins/rate-limit';

/**
 * Example: Public endpoint with 100 req/min per IP
 */
export function registerPublicRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/markets',
    withRateLimit(RateLimitType.PUBLIC),
    async (request, reply) => {
      return { markets: [] };
    }
  );
}

/**
 * Example: Authenticated endpoint with 60 req/min per user
 */
export function registerAuthenticatedRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/user/profile',
    withRateLimit(RateLimitType.AUTHENTICATED),
    async (request, reply) => {
      return { profile: {} };
    }
  );
}

/**
 * Example: Trading endpoint with 30 req/min per user
 */
export function registerTradingRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/trades/buy',
    withRateLimit(RateLimitType.TRADING),
    async (request, reply) => {
      return { tradeId: '123' };
    }
  );
}

/**
 * Example: Admin endpoint with 120 req/min per user
 */
export function registerAdminRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/admin/markets',
    withRateLimit(RateLimitType.ADMIN),
    async (request, reply) => {
      return { marketId: '123' };
    }
  );
}

/**
 * Example: Custom rate limit configuration
 */
export function registerCustomRateLimitRoute(fastify: FastifyInstance) {
  fastify.get(
    '/api/special',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      return { data: 'custom rate limit' };
    }
  );
}
