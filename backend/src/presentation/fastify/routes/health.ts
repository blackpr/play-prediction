import { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { withRateLimit, RateLimitType } from '../plugins/rate-limit';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health',
    withRateLimit(RateLimitType.PUBLIC),
    async (request, reply) => {
      const db = request.diScope.resolve('db');

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'unknown', latency: 0 },
          auth: { status: 'unknown', latency: 0 }
        }
      };

      let isHealthy = true;

      // Check Database
      const dbStart = performance.now();
      try {
        await db.execute(sql`SELECT 1`);
        healthStatus.components.database.status = 'healthy';
      } catch (error) {
        request.log.error(error, 'Health check: Database failed');
        healthStatus.components.database.status = 'unhealthy';
        isHealthy = false;
      } finally {
        healthStatus.components.database.latency = Math.round(performance.now() - dbStart);
      }

      // Check Supabase Auth
      const authStart = performance.now();
      try {
        const authService = request.diScope.resolve('authService');
        const isAuthHealthy = await authService.checkHealth();

        if (isAuthHealthy) {
          healthStatus.components.auth.status = 'healthy';
        } else {
          healthStatus.components.auth.status = 'unhealthy';
          isHealthy = false;
        }
      } catch (error) {
        request.log.error(error, 'Health check: Auth check failed');
        healthStatus.components.auth.status = 'unhealthy';
        isHealthy = false;
      } finally {
        healthStatus.components.auth.latency = Math.round(performance.now() - authStart);
      }

      healthStatus.status = isHealthy ? 'healthy' : 'unhealthy';

      // If unhealthy, return 503? Or 200 with status unhealthy?
      // Usually monitoring tools check 200. "Acceptance Criteria: Return overall status"
      // Let's return 200 with result, or 503 if critical failures. 
      // User story doesn't specify status code, but "Return overall status".
      // Usually 200 is fine if the JSON says unhealthy, unless used by load balancer.
      // I'll stick to 200 but consistent with 'status' field.

      // If critical failure, maybe 503.
      if (!isHealthy) {
        reply.status(503);
      }

      return healthStatus;
    }
  );
};

export default healthRoutes;
