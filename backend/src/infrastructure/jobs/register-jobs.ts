import { queueService } from './queue-service';

/**
 * Registers all repeatable jobs (crons) for the application.
 * This should be called on worker startup.
 */
export async function registerRepeatableJobs() {
  console.log('[Scheduler] Registering repeatable jobs...');

  const repeatableJobs = [
    // Market Lifecycle Jobs
    {
      queue: 'market-ops',
      name: 'market:check-expired',
      data: { type: 'market:check-expired' as const, payload: {} },
      opts: { repeat: { pattern: '* * * * *' } }, // Every 1 minute
    },
    {
      queue: 'market-ops',
      name: 'market:activate-scheduled',
      data: { type: 'market:activate-scheduled' as const, payload: {} },
      opts: { repeat: { pattern: '* * * * *' } }, // Every 1 minute
    },
    {
      queue: 'market-ops',
      name: 'market:remind-manual-close',
      data: { type: 'market:remind-manual-close' as const, payload: {} },
      opts: { repeat: { pattern: '*/15 * * * *' } }, // Every 15 minutes
    },
    // Admin Notifications
    {
      queue: 'notifications',
      name: 'admin:alert-pending-resolution',
      data: { type: 'admin:alert-pending-resolution' as const, payload: {} },
      opts: { repeat: { pattern: '0 * * * *' } }, // Every 1 hour
    },
  ];

  for (const job of repeatableJobs) {
    try {
      await queueService.add(job.queue as any, job.data, {
        jobId: `repeat:${job.name}`, // constant ID ensures we don't duplicate
        ...job.opts,
      });
      console.log(`[Scheduler] Registered job: ${job.name} (${job.opts.repeat.pattern})`);
    } catch (error) {
      console.error(`[Scheduler] Failed to register job ${job.name}:`, error);
    }
  }

  console.log(`[Scheduler] Registered ${repeatableJobs.length} repeatable jobs.`);
}
