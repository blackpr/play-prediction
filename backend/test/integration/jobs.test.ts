import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { queueService } from '../../src/infrastructure/jobs/queue-service';
import { createWorker } from '../../src/infrastructure/jobs/worker-factory';
import { Job } from 'bullmq';
import { getRedisClient, closeRedis } from '../../src/infrastructure/redis/connection';

describe('Job Queue Infrastructure', () => {
  const TEST_QUEUE = 'notifications'; // Use a valid queue name

  beforeAll(async () => {
    // Ensure Redis is connected
    await getRedisClient().ping();
  });

  afterAll(async () => {
    await queueService.closeAll();
    await closeRedis();
  });

  it('should be able to add a job to the queue', async () => {
    const job = await queueService.add(TEST_QUEUE, {
      type: 'notification:user',
      payload: { userId: 'check-1', message: 'test' }
    });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();

    // Verify in Redis
    const stats = await queueService.getStats(TEST_QUEUE);
    expect(stats.counts.waiting + stats.counts.active + stats.counts.completed + stats.counts.delayed).toBeGreaterThan(0);
  });

  it('should process jobs with a worker', async () => new Promise<void>((resolve, reject) => {
    // Create a worker specifically for this test
    const worker = createWorker(TEST_QUEUE, async (job: Job) => {
      if (job.data.payload.message === 'process-me') {
        return 'processed';
      }
    });

    // Add job
    queueService.add(TEST_QUEUE, {
      type: 'notification:user',
      payload: { userId: 'check-2', message: 'process-me' }
    }).then(async (job) => {
      // Wait for completion?
      // Since worker is separate, we can listen to events
      worker.on('completed', async (completedJob, result) => {
        if (completedJob.id === job.id) {
          try {
            expect(result).toBe('processed');
            await worker.close();
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      });

      worker.on('failed', async (failedJob, err) => {
        if (failedJob?.id === job.id) {
          await worker.close();
          reject(err);
        }
      });
    });
  }));
});
