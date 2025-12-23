import { queueService } from './queue-service';

/**
 * Register all repeatable jobs on worker startup.
 * Jobs are registered with specific cron patterns and will run automatically.
 * 
 * SCHEDULER-1: Market Lifecycle Jobs
 */
export async function registerRepeatableJobs() {
  try {
    // SCHEDULER-2: Check for expired markets every 1 minute
    await queueService.addRepeatable('market-ops', {
      type: 'market:check-expired',
      payload: {}
    }, '* * * * *'); // Every minute

    console.log('[Jobs] Registered market:check-expired (every 1 minute)');

    // SCHEDULER-2a: Remind about manual-close markets every 15 minutes
    await queueService.addRepeatable('market-ops', {
      type: 'market:remind-manual-close',
      payload: {}
    }, '*/15 * * * *'); // Every 15 minutes

    console.log('[Jobs] Registered market:remind-manual-close (every 15 minutes)');

    // SCHEDULER-5: Activate scheduled markets (placeholder for future)
    // Commented out until SCHEDULER-5 is implemented
    // await queueService.addRepeatable('market-ops', {
    //   type: 'market:activate-scheduled',
    //   payload: {}
    // }, {
    //   pattern: '* * * * *', // Every minute
    //   jobId: 'market:activate-scheduled'
    // });

    console.log('[Jobs] All repeatable jobs registered successfully');
  } catch (error) {
    console.error('[Jobs] Failed to register repeatable jobs:', error);
    throw error;
  }
}
