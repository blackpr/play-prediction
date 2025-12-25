import { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { withRateLimit, RateLimitType } from '../plugins/rate-limit';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health',
    withRateLimit(RateLimitType.PUBLIC),
    async (request, reply) => {
      try {
        const db = request.diScope.resolve('db');
        const authService = request.diScope.resolve('authService');

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
          request.log.error({ err: error }, 'Health check: Database failed');
          healthStatus.components.database.status = 'unhealthy';
          isHealthy = false;
        } finally {
          healthStatus.components.database.latency = Math.round(performance.now() - dbStart);
        }

        // Check Supabase Auth
        const authStart = performance.now();
        try {
          const isAuthHealthy = await authService.checkHealth();

          if (isAuthHealthy) {
            healthStatus.components.auth.status = 'healthy';
          } else {
            healthStatus.components.auth.status = 'unhealthy';
            isHealthy = false;
          }
        } catch (error) {
          request.log.error({ err: error }, 'Health check: Auth check failed');
          healthStatus.components.auth.status = 'unhealthy';
          isHealthy = false;
        } finally {
          healthStatus.components.auth.latency = Math.round(performance.now() - authStart);
        }

        healthStatus.status = isHealthy ? 'healthy' : 'unhealthy';

        if (!isHealthy) {
          reply.status(503);
        }

        return healthStatus;
      } catch (err) {
        request.log.error({ err }, 'Critical error in health check handler');
        reply.status(503);
        return { status: 'critical_failure', error: String(err) };
      }
    }
  );
};

export default healthRoutes;
