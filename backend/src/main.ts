import './shared/config/bootstrap';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from './presentation/fastify/middleware/error-handler';
import healthRoutes from './presentation/fastify/routes/health';
import { registerRateLimit, withRateLimit, RateLimitType } from './presentation/fastify/plugins/rate-limit';
import { loggerConfig } from './shared/logger/index';
import { registerContainer } from './shared/container/index';
import { circuitBreakerPlugin } from './presentation/fastify/plugins/circuit-breaker';

const server = Fastify({
  logger: loggerConfig
});

async function buildServer() {
  // Register plugins first
  await server.register(cors, {
    origin: true, // Allow all for dev
    credentials: true,
  });

  // Register DI Container
  await registerContainer(server);

  // Register Circuit Breaker Plugin (Must be after DI)
  await server.register(circuitBreakerPlugin);

  // Register Rate Limit Plugin
  await server.register(registerRateLimit);

  // Register BullMQ Board (Admin only)
  const { bullBoardPlugin } = await import('./presentation/fastify/plugins/bull-board');
  await server.register(bullBoardPlugin);

  // Register global error handler
  server.setErrorHandler(errorHandler);


  // Add hook to include userId in logs if authenticated
  server.addHook('preHandler', async (request) => {
    // Assuming auth middleware populates request.user
    const user = (request as any).user;
    if (user?.id) {
      request.log = request.log.child({ userId: user.id });
    }
  });

  // Routes
  server.register(healthRoutes);

  // Test route for rate limiting (can be removed in production)
  server.get('/test-rate-limit', withRateLimit(RateLimitType.PUBLIC), async () => {
    return { message: 'Rate limit test', timestamp: new Date().toISOString() };
  });

  return server;
}

const start = async () => {
  try {
    await buildServer();
    const port = parseInt(process.env.PORT || '4000', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();