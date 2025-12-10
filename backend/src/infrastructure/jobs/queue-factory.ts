import { Queue, QueueOptions } from 'bullmq';
import { createRedisConnection } from '../redis/connection';
import { QueueName } from './types';

/**
 * Creates a configured BullMQ Queue instance.
 * Uses a dedicated Redis connection for the queue.
 */
export function createQueue(name: QueueName, options: Partial<QueueOptions> = {}): Queue {
  const queueConfig: QueueOptions = {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep for 24h
        count: 1000,    // Max 1000 jobs
      },
      removeOnFail: {
        age: 24 * 3600, // Keep failed jobs for 24h
        count: 1000,
      },
    },
    ...options,
    connection: options.connection || createRedisConnection(),
  };

  return new Queue(name, queueConfig);
}
