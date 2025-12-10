import Fastify from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from './presentation/fastify/middleware/error-handler';

const server = Fastify({
  logger: true
});

// Register plugins
server.register(cors, {
  origin: true, // Allow all for dev
  credentials: true,
});

// Register global error handler
server.setErrorHandler(errorHandler);

server.get('/', async () => {
  return { hello: 'world' };
});

server.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4000', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();