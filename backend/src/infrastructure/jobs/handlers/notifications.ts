import { Job } from 'bullmq';
import { JobData } from '../types';
import { createDatabase } from '../../database';
import { markets } from '../../database/drizzle/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';

/**
 * Job handler registry for notifications queue.
 * Routes jobs to specific handlers based on job name.
 */
export async function notificationHandlers(job: Job<JobData>) {
  const { type } = job.data;

  switch (type) {
    case 'admin:alert-pending-resolution':
      return await alertPendingResolution(job);
    default:
      console.warn(`[notifications] Unknown job type: ${type}`);
      return { processed: false, error: 'Unknown job type' };
  }
}

/**
 * SCHEDULER-3: Alert admins about markets pending resolution.
 * Runs every 1 hour.
 */
async function alertPendingResolution(job: Job<JobData>): Promise<any> {
  const db = createDatabase();
  const now = new Date();

  try {
    // Find all PAUSED markets that are past their close time
    const pendingMarkets = await db.query.markets.findMany({
      where: and(
        eq(markets.status, 'PAUSED'),
        isNotNull(markets.closesAt),
        sql`${markets.closesAt} < ${now.toISOString()}`
      ),
    });

    let info = 0;
    let warning = 0;
    let critical = 0;

    for (const market of pendingMarkets) {
      if (!market.closesAt) continue;

      const hoursSinceClosed = (now.getTime() - market.closesAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceClosed >= 48) {
        // 48+ hours: Critical
        critical++;
        console.error(JSON.stringify({
          level: 'ERROR',
          service: 'scheduler',
          message: 'Market pending resolution - CRITICAL',
          marketId: market.id,
          title: market.title,
          hoursSinceClosed: Math.floor(hoursSinceClosed),
          closesAt: market.closesAt,
        }));
        // TODO: Queue email/Slack notification when notification system exists
      } else if (hoursSinceClosed >= 24) {
        // 24-48 hours: Warning
        warning++;
        console.warn(JSON.stringify({
          level: 'WARN',
          service: 'scheduler',
          message: 'Market pending resolution - WARNING',
          marketId: market.id,
          title: market.title,
          hoursSinceClosed: Math.floor(hoursSinceClosed),
          closesAt: market.closesAt,
        }));
      } else {
        // 0-24 hours: Info
        info++;
        console.info(JSON.stringify({
          level: 'INFO',
          service: 'scheduler',
          message: 'Market pending resolution',
          marketId: market.id,
          title: market.title,
          hoursSinceClosed: Math.floor(hoursSinceClosed),
        }));
      }
    }

    return {
      checked: pendingMarkets.length,
      info,
      warning,
      critical,
    };
  } catch (error) {
    console.error('[admin:alert-pending-resolution] Error:', error);
    throw error;
  }
}
