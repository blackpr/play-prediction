import { resolve } from 'node:path';
import { loadEnv } from '../shared/config/env';

// Load env vars from backend root BEFORE importing services
loadEnv(resolve(__dirname, '../../'));

import { Command } from 'commander';
import { JobsOptions } from 'bullmq';
import { QueueName } from '../infrastructure/jobs/types';

// Late bound imports to ensure env vars are loaded
let queueService: any;
let closeRedis: any;

const program = new Command();

program
  .name('jobs')
  .description('CLI for managing background jobs');

// Helper to load dependencies
const loadDeps = async () => {
  if (!queueService) {
    const qsModule = await import('../infrastructure/jobs/queue-service');
    queueService = qsModule.queueService;
  }
  if (!closeRedis) {
    const rcModule = await import('../infrastructure/redis/connection');
    closeRedis = rcModule.closeRedis;
  }
};

program
  .command('trigger')
  .description('Trigger a job')
  .argument('<queue>', 'Queue name (e.g. market-ops)')
  .argument('<type>', 'Job type (e.g. market:check-expired)')
  .argument('[data]', 'JSON data for the job', '{}')
  .option('-d, --delay <ms>', 'Delay in milliseconds')
  .action(async (queueName, type, dataStr, options) => {
    await loadDeps();
    try {
      const data = JSON.parse(dataStr);
      const jobOptions: JobsOptions = {};

      if (options.delay) {
        jobOptions.delay = parseInt(options.delay, 10);
      }

      console.log(`Adding job ${type} to queue ${queueName}...`);

      const job = await queueService.add(queueName as QueueName, { type: type as any, payload: data }, jobOptions);
      console.log(`✅ Job added successfully! ID: ${job.id}`);

    } catch (error) {
      console.error('❌ Error adding job:', error instanceof Error ? error.message : error);
    } finally {
      await cleanup();
    }
  });

program
  .command('stats')
  .description('Get queue statistics')
  .argument('[queue]', 'Queue name (optional, defaults to checking all known queues)')
  .action(async (queueName) => {
    await loadDeps();
    try {
      // Cast to QueueName or array of strings. 
      // Ideally we get valid queue names from the service or types.
      const queues = queueName
        ? [queueName as QueueName]
        : ['market-ops', 'notifications', 'maintenance'] as QueueName[];

      console.log('Fetching queue stats...');
      const stats = await Promise.all(queues.map(async (q) => {
        try {
          return await queueService.getStats(q);
        } catch (e) {
          return { name: q, error: 'Queue not found' };
        }
      }));
      console.table(stats);
    } catch (error) {
      console.error('❌ Error fetching stats:', error instanceof Error ? error.message : error);
    } finally {
      await cleanup();
    }
  });

program
  .command('clear')
  .description('Clear completed and failed jobs from a queue')
  .argument('<queue>', 'Queue name')
  .action(async (queueName) => {
    await loadDeps();
    try {
      console.log(`Clearing ${queueName}...`);
      // Since QueueService doesn't expose clean/obliterate directly yet:
      const queue = queueService.getQueue(queueName as QueueName);
      if (queue) {
        // Clean grace period 0 means remove immediately
        await queue.clean(0, 0, 'completed');
        await queue.clean(0, 0, 'failed');
        console.log(`✅ Queue ${queueName} cleared of completed and failed jobs.`);
      }
    } catch (error) {
      console.error('❌ Error clearing queue:', error instanceof Error ? error.message : error);
    } finally {
      await cleanup();
    }
  });

async function cleanup() {
  await queueService.closeAll();
  await closeRedis();
  process.exit(0);
}

program.parse();
