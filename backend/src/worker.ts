import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './shared/config/env';

// Determine backend root directory (src/.. -> backend/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

// Load environment variables from backend root
loadEnv(backendRoot);

import fastify from 'fastify';
import { createWorkers } from './infrastructure/jobs/worker-factory';
import { handlers } from './infrastructure/jobs/handlers';
import { Processor } from 'bullmq';

// Create workers
const workers = createWorkers(handlers as Record<string, Processor>);

console.log(`[Worker] Started ${workers.length} workers: ${workers.map(w => w.name).join(', ')}`);

// Create lightweight health check server
const app = fastify({
  logger: true,
});

app.get('/health', async () => {
  return {
    status: 'ok',
    workers: workers.map(w => ({
      name: w.name,
      isRunning: w.isRunning()
    }))
  };
});

// Start health check server
const start = async () => {
  try {
    // specific port for worker health check to avoid conflict with API
    await app.listen({ port: 4001, host: '0.0.0.0' });
    console.log('[Worker] Health check server running on port 4001');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[Worker] Received ${signal}, shutting down...`);

  // Close health check server
  await app.close();

  // Close all workers
  await Promise.all(workers.map(w => w.close()));

  console.log('[Worker] Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
