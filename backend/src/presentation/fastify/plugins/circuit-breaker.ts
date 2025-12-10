import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { CircuitBreakerOpenError } from '../../../domain/errors/domain-error';

/**
 * Circuit Breaker Plugin
 * 
 * Monitors system health and enforces circuit breakers.
 * - Tracks error rates
 * - Checks system status (Redis, DB conn monitor)
 * - Hooks into request lifecycle
 */
export const circuitBreakerPlugin = fp(async (fastify: FastifyInstance) => {

  // Hook to check system status before handling request
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Resolve circuit breaker service
    // Note: Depends on fastify-awilix being registered first
    const cb = request.diScope.resolve('circuitBreakerService');

    try {
      await cb.checkSystemHealth();
      await cb.recordRequest();
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        throw err; // Pass to error handler
      }
      // Log other errors but don't block request unless critical
      request.log.error(err, 'Circuit Breaker check failed');
    }
  });

  // Hook to count errors
  fastify.addHook('onError', async (request, reply, error) => {
    // 5xx errors indicate system failure
    const statusCode = (error as any).statusCode || reply.statusCode || 500;

    if (statusCode >= 500) {
      try {
        const cb = request.diScope.resolve('circuitBreakerService');
        await cb.recordError();
      } catch (e) {
        // Fail silently, just log
        request.log.error(e, 'Failed to record error in Circuit Breaker');
      }
    }
  });

  console.log('✓ Circuit Breaker plugin registered');
});
