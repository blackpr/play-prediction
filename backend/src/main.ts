import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './shared/config/env';

// Determine backend root directory (src/.. -> backend/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

// Load environment variables from backend root
loadEnv(backendRoot);

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from './presentation/fastify/middleware/error-handler';
import { registerRateLimit, withRateLimit, RateLimitType } from './presentation/fastify/plugins/rate-limit';

const server = Fastify({
  logger: true
});

async function buildServer() {
  // Register plugins first
  await server.register(cors, {
    origin: true, // Allow all for dev
    credentials: true,
  });

  // Register Rate Limit Plugin
  await server.register(registerRateLimit);

  // Register global error handler
  server.setErrorHandler(errorHandler);

  // Routes
  server.get('/', async () => {
    return { hello: 'world' };
  });

  server.get('/health', withRateLimit(RateLimitType.PUBLIC), async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

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