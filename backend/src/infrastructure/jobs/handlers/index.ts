export * from './market';
export * from './notifications';
export * from './maintenance';

import { Processor } from 'bullmq';
import { QueueName } from '../types';
import { marketHandlers } from './market';
import { notificationHandlers } from './notifications';
import { maintenanceHandlers } from './maintenance';

/**
 * Registry of handlers for each queue.
 * Key is QueueName, value is the Processor function.
 */
export const handlers: Partial<Record<QueueName, Processor>> = {
  'market-ops': marketHandlers,
  'notifications': notificationHandlers,
  'maintenance': maintenanceHandlers,
};

