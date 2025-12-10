import { Worker, WorkerOptions, Processor } from 'bullmq';
import { createRedisConnection } from '../redis/connection';
import { QueueName } from './types';
import { requireEnv } from '../../shared/config/env';

/**
 * Creates a configured BullMQ Worker instance.
 */
export function createWorker(
  name: QueueName,
  processor: Processor,
  options: Partial<WorkerOptions> = {}
): Worker {
  const workerConfig: WorkerOptions = {
    ...options,
    connection: options.connection || createRedisConnection(), // Workers MUST have their own blocking connection
  };

  const worker = new Worker(name, processor, workerConfig);

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${name}] Job ${job?.id} failed:`, err);
  });

  worker.on('error', (err) => {
    console.error(`[Worker:${name}] Worker error:`, err);
  });

  return worker;
}
