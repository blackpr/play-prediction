import './shared/config/bootstrap';
import fastify from 'fastify';
import { Processor } from 'bullmq';
import { createWorkers } from './infrastructure/jobs/worker-factory';
import { handlers } from './infrastructure/jobs/handlers';
import { metricsService } from './infrastructure/observability/metrics.service';
import { queueService } from './infrastructure/jobs/queue-service';

// Create lightweight health check server
const app = fastify({
  logger: true,
});

// Alias for general health
app.get('/health', async () => {
  return { status: 'ok' };
});

// Start workers and health check
const start = async () => {
  try {
    // Create workers
    const workerInstances = createWorkers(handlers as Record<string, Processor>);

    console.log(`[Worker] Started ${workerInstances.length} workers: ${workerInstances.map(w => w.name).join(', ')}`);

    // IMPORTANT: Hook into worker events for metrics
    workerInstances.forEach((worker: any) => {
      worker.on('completed', (job: any) => {
        metricsService.incrementJobsProcessed(worker.name, 'completed');
        if (job.finishedOn && job.processedOn) {
          const duration = (job.finishedOn - job.processedOn) / 1000;
          metricsService.observeJobDuration(worker.name, duration);

          if (duration > 300) { // > 5 minutes
            console.error(JSON.stringify({
              level: 'ERROR',
              service: 'worker',
              message: `Job processing time exceeded threshold`,
              queue: worker.name,
              jobId: job.id,
              duration: duration,
              threshold: 300
            }));
          }
        }
      });

      worker.on('failed', (job: any, err: any) => {
        metricsService.incrementJobsFailed(worker.name);
        metricsService.incrementJobsProcessed(worker.name, 'failed');
        console.error(JSON.stringify({
          level: 'ERROR',
          service: 'worker',
          message: `Job failed`,
          queue: worker.name,
          jobId: job?.id,
          error: err.message,
          stack: err.stack
        }));
      });
    });

    // Start monitoring queues
    queueService.monitorQueues(metricsService);

    // Health check endpoint needs access to queueService
    app.get('/health/worker', async () => {
      const queueStats = await Promise.all(
        queueService.getQueues().map(async (q) => {
          const counts = await q.getJobCounts('waiting', 'active', 'failed');
          return {
            name: q.name,
            waiting: counts.waiting,
            active: counts.active,
            failed: counts.failed
          };
        })
      );

      // Convert array to object
      const queuesMap = queueStats.reduce((acc, curr) => {
        acc[curr.name] = { waiting: curr.waiting, active: curr.active, failed: curr.failed };
        return acc;
      }, {} as Record<string, any>);

      let redisStatus = { status: 'unknown', latency: -1 };
      if (queueService.getQueues().length > 0) {
        try {
          const client = await queueService.getQueues()[0].client;
          const start = Date.now();
          await client.ping();
          redisStatus = { status: 'connected', latency: Date.now() - start };
        } catch (e) {
          redisStatus = { status: 'disconnected', latency: -1 };
        }
      }

      return {
        status: 'healthy',
        queues: queuesMap,
        redis: redisStatus
      };
    });

    app.get('/metrics', async (req, reply) => {
      reply.header('Content-Type', metricsService.getContentType());
      return await metricsService.getMetrics();
    });

    // specific port for worker health check
    await app.listen({ port: 4001, host: '0.0.0.0' });
    console.log('[Worker] Health check server running on port 4001');

    // Store instances for shutdown
    (global as any).workerInstances = workerInstances;
    (global as any).queueService = queueService;

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
  if ((global as any).workerInstances) {
    await Promise.all((global as any).workerInstances.map((w: any) => w.close()));
  }

  // Close queue service (monitoring)
  if ((global as any).queueService) {
    await (global as any).queueService.closeAll();
  }



  console.log('[Worker] Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

