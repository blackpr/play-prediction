import './shared/config/bootstrap';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { errorHandler } from './presentation/fastify/middleware/error-handler';
import { authMiddleware } from './presentation/fastify/middleware/auth';
import healthRoutes from './presentation/fastify/routes/health';
import { authRoutes } from './presentation/fastify/routes/auth';
import { usersRoutes } from './presentation/fastify/routes/users';
import { marketsRoutes } from './presentation/fastify/routes/markets';
import { portfolioRoutes } from './presentation/fastify/routes/portfolio';
import adminRoutes from './presentation/fastify/routes/admin';
import { publicCategoryRoutes } from './presentation/fastify/routes/categories';
import { websocketHandler } from './presentation/websocket/websocket.route';
import { registerRateLimit, withRateLimit, RateLimitType } from './presentation/fastify/plugins/rate-limit';
import multipart from '@fastify/multipart';
import { loggerConfig } from './shared/logger/index';
import { registerContainer } from './shared/container/index';
import { circuitBreakerPlugin } from './presentation/fastify/plugins/circuit-breaker';

const server = Fastify({
  logger: loggerConfig
});

async function buildServer() {
  // Register plugins first
  await server.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    }
  });

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'https://prediction-frontend.egoeimai.bitar.gr',
    'https://prediction-frontend-staging.egoeimai.bitar.gr'
  ];

  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return cb(null, true);

      // Allow if in allow-list OR if not in production (fallback for dev)
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return cb(null, true);
      }

      // Block otherwise
      // console.warn(`Blocked CORS for origin: ${origin}`);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await server.register(cookie);

  // Register WebSocket support
  await server.register(websocket);

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

  // Register global auth middleware (initializes request.supabase)
  server.addHook('preHandler', authMiddleware);

  // Add request/response logging
  const { requestLogger } = await import('./presentation/fastify/middleware/request-logger');
  server.addHook('onRequest', requestLogger);

  // Add hook to include userId in logs if authenticated
  server.addHook('preHandler', async (request) => {
    // Assuming auth middleware populates request.user
    const user = (request as any).user;
    if (user?.id) {
      request.log = request.log.child({ userId: user.id });
    }
  });

  // WebSocket route (before REST routes to avoid conflicts)
  server.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, websocketHandler);
  });

  // Routes
  server.register(healthRoutes, { prefix: '/api' });
  server.register(authRoutes, { prefix: '/api/v1/auth' });
  server.register(usersRoutes, { prefix: '/api/v1/users' });
  server.register(marketsRoutes, { prefix: '/api/v1/markets' });
  server.register(portfolioRoutes, { prefix: '/api/v1/portfolio' });
  server.register(adminRoutes, { prefix: '/api/v1/admin' });
  server.register(publicCategoryRoutes, { prefix: '/api/v1/categories' });

  // Test route for rate limiting (can be removed in production)
  server.get('/test-rate-limit', withRateLimit(RateLimitType.PUBLIC), async () => {
    return { message: 'Rate limit test', timestamp: new Date().toISOString() };
  });

  return server;
}

const start = async () => {
  try {
    await buildServer();

    // Initialize Redis pub/sub for WebSocket broadcasting
    const { diContainer } = await import('./shared/container/index');
    const webSocketManager = diContainer.resolve('webSocketManager');
    const redisPubSubService = diContainer.resolve('redisPubSubService');
    await webSocketManager.initializeRedisPubSub(redisPubSubService);
    server.log.info('WebSocket Redis pub/sub initialized');

    const port = parseInt(process.env.PORT || '4000', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  server.log.info('SIGTERM received, shutting down gracefully...');
  const { diContainer } = await import('./shared/container/index');
  const webSocketManager = diContainer.resolve('webSocketManager');
  await webSocketManager.shutdown();
  await server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  server.log.info('SIGINT received, shutting down gracefully...');
  const { diContainer } = await import('./shared/container/index');
  const webSocketManager = diContainer.resolve('webSocketManager');
  await webSocketManager.shutdown();
  await server.close();
  process.exit(0);
});

start();