import { Queue, JobsOptions, Job } from 'bullmq';
import { createQueue } from './queue-factory';
import { QueueName, JobData, JobType } from './types';
import { MetricsService } from '../observability/metrics.service';


/**
 * Service to manage background jobs.
 * Acts as a Facade over BullMQ queues.
 */
export class QueueService {
  private queues: Map<QueueName, Queue>;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.queues = new Map();
    this.initializeQueues();
  }


  /**
   * Initialize all known queues.
   */
  private initializeQueues() {
    const queueNames: QueueName[] = [
      'market-ops',
      'notifications',
      'maintenance',
      'analytics',
      'integrations'
    ];

    queueNames.forEach(name => {
      this.queues.set(name, createQueue(name));
    });
  }

  /**
   * Get a queue instance by name.
   */
  public getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    return queue;
  }

  /**
   * Add a job to a queue.
   */
  public async add<T extends Record<string, any>>(
    queueName: QueueName,
    data: JobData,
    options?: JobsOptions
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    return await queue.add(data.type, data, options);
  }

  /**
   * Add a repeatable job (Cron).
   */
  public async addRepeatable(
    queueName: QueueName,
    data: JobData,
    cronExpression: string,
    options?: JobsOptions
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    return await queue.add(data.type, data, {
      ...options,
      repeat: {
        pattern: cronExpression,
      },
    });
  }

  /**
   * Remove a repeatable job.
   */
  public async removeRepeatable(
    queueName: QueueName,
    jobId: string, // Usually 'repeat:...'
    repeatOpts: { pattern: string }
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.removeRepeatable(jobId, repeatOpts); // BullMQ API varies, check version if necessary
    // Actually BullMQ 5 'removeRepeatable' takes name and opts or key
    // Simplification for now:
    await queue.removeRepeatableByKey(jobId);
  }

  /**
   * Get queue statistics.
   */
  public async getStats(queueName: QueueName) {
    const queue = this.getQueue(queueName);
    const [counts, paused] = await Promise.all([
      queue.getJobCounts(),
      queue.isPaused(),
    ]);

    return {
      name: queueName,
      paused,
      counts,
    };
  }

  /**
   * Close all queues.
   */
  public async closeAll(): Promise<void> {
    this.stopMonitoring();
    const promises = Array.from(this.queues.values()).map(q => q.close());
    await Promise.all(promises);
  }


  /**
   * Get all initialized queues.
   * Useful for monitoring tools like BullBoard.
   */
  public getQueues(): Queue[] {
    return Array.from(this.queues.values());
  }

  /**
   * Monitor all queues for metrics and alerts.
   */
  public monitorQueues(metrics: MetricsService) {
    this.queues.forEach((queue, name) => {
      // Event listeners for global events (triggered by workers)
      // Note: In a distributed system, worker events might be better monitored on the worker side 
      // or via global events if the queue instance is global-aware.
      // Here we assume this service runs in a process that can see these events or we use the queue instance.

      // However, Standard Queue instance in BullMQ doesn't emit 'completed' unless we use QueueEvents.
      // But we can monitor the queue depth periodically.

      // For accurate completion/failure metrics, it is often better to hook into the Worker.
      // But if we want to monitor here, we can set up a periodic check.
    });

    // We will implement periodic monitoring here for queue depth
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      for (const [name, queue] of this.queues.entries()) {
        try {
          const waiting = await queue.getWaitingCount();
          metrics.setJobsWaiting(name, waiting);

          if (waiting > 1000) {
            console.error(JSON.stringify({
              level: 'ERROR',
              service: 'queue-service',
              message: `Queue ${name} depth exceeded threshold`,
              queue: name,
              depth: waiting,
              threshold: 1000
            }));
          }
        } catch (err) {
          console.error(`Failed to monitor queue ${name}:`, err);
        }
      }
    }, 15000); // Check every 15 seconds
  }

  /**
   * Stop monitoring.
   */
  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

}

// Export singleton
export const queueService = new QueueService();
