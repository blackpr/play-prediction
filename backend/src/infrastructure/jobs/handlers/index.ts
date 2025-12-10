import { Processor } from 'bullmq';
import { QueueName } from '../types';

/**
 * Registry of handlers for each queue.
 * Key is QueueName, value is the Processor function.
 */
export const handlers: Partial<Record<QueueName, Processor>> = {
  // 'market-ops': marketOpsHandler,
  // 'notifications': notificationHandler,
};

// Will be populated in JOBS-2
