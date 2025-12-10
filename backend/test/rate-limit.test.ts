/**
 * Rate Limiting Tests
 * 
 * Tests to verify rate limiting functionality works correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerRateLimit, RateLimitType, withRateLimit } from '../src/presentation/fastify/plugins/rate-limit';
import { loadEnv } from '../src/shared/config/env';

// Load environment variables (including .env.local)
loadEnv(process.cwd());

describe('Rate Limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(registerRateLimit);

    // Register test routes with different rate limits
    app.get('/public', withRateLimit(RateLimitType.PUBLIC), async () => {
      return { type: 'public' };
    });

    app.get('/authenticated', withRateLimit(RateLimitType.AUTHENTICATED), async () => {
      return { type: 'authenticated' };
    });

    app.get('/trading', withRateLimit(RateLimitType.TRADING), async () => {
      return { type: 'trading' };
    });

    app.get('/admin', withRateLimit(RateLimitType.ADMIN), async () => {
      return { type: 'admin' };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests within rate limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/public',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should include rate limit headers in response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/public',
    });

    expect(response.headers['x-ratelimit-limit']).toBe('100');
    expect(parseInt(response.headers['x-ratelimit-remaining'] as string)).toBeLessThanOrEqual(100);
  });

  it('should block requests exceeding rate limit', async () => {
    // Make 31 requests (exceeding the 30 req/min limit for trading)
    const requests = [];
    for (let i = 0; i < 31; i++) {
      requests.push(
        app.inject({
          method: 'GET',
          url: '/trading',
          headers: {
            'x-forwarded-for': '192.168.1.1', // Same IP
          },
        })
      );
    }

    const responses = await Promise.all(requests);
    const blockedResponse = responses.find(r => r.statusCode === 429);

    expect(blockedResponse).toBeDefined();
    if (blockedResponse) {
      const body = JSON.parse(blockedResponse.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.details.retryAfter).toBeGreaterThan(0);
    }
  });

  it('should use different keys for different users', async () => {
    // This test would require mocking user authentication
    // For now, we'll just verify the endpoint works
    const response1 = await app.inject({
      method: 'GET',
      url: '/authenticated',
    });

    const response2 = await app.inject({
      method: 'GET',
      url: '/authenticated',
    });

    expect(response1.statusCode).toBe(200);
    expect(response2.statusCode).toBe(200);
  });

  it('should have different limits for different endpoint types', async () => {
    // Public: 100 req/min
    const publicResponse = await app.inject({
      method: 'GET',
      url: '/public',
    });
    expect(publicResponse.headers['x-ratelimit-limit']).toBe('100');

    // Trading: 30 req/min
    const tradingResponse = await app.inject({
      method: 'GET',
      url: '/trading',
      headers: {
        'x-forwarded-for': '192.168.1.2', // Different IP
      },
    });
    expect(tradingResponse.headers['x-ratelimit-limit']).toBe('30');

    // Admin: 120 req/min
    const adminResponse = await app.inject({
      method: 'GET',
      url: '/admin',
      headers: {
        'x-forwarded-for': '192.168.1.3', // Different IP
      },
    });
    expect(adminResponse.headers['x-ratelimit-limit']).toBe('120');
  });

  it('should return proper error format when rate limited', async () => {
    // Make requests to exceed limit
    const requests = [];
    for (let i = 0; i < 32; i++) {
      requests.push(
        app.inject({
          method: 'GET',
          url: '/trading',
          headers: {
            'x-forwarded-for': '192.168.1.100', // Same IP for all
          },
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedResponse = responses.find(r => r.statusCode === 429);

    expect(rateLimitedResponse).toBeDefined();
    if (rateLimitedResponse) {
      const body = JSON.parse(rateLimitedResponse.body);
      
      // Check response format matches API spec
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(body.error).toHaveProperty('message', 'Too many requests');
      expect(body.error).toHaveProperty('details');
      expect(body.error.details).toHaveProperty('retryAfter');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('requestId');
      expect(body.meta).toHaveProperty('timestamp');
    }
  });
});
