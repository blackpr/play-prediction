import { Job } from 'bullmq';
import { JobData } from '../types';
import { createDatabase } from '../../database';
import { markets, auditLogs } from '../../database/drizzle/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Job handler registry for market-ops queue.
 * Routes jobs to specific handlers based on job name.
 */
export async function marketHandlers(job: Job<JobData>) {
  const { type } = job.data;

  switch (type) {
    case 'market:check-expired':
      return await checkExpiredMarkets(job);
    case 'market:activate-scheduled':
      return await activateScheduledMarkets(job);
    case 'market:remind-manual-close':
      return await remindManualClose(job);
    default:
      console.warn(`[market-ops] Unknown job type: ${type}`);
      return { processed: false, error: 'Unknown job type' };
  }
}

/**
 * SCHEDULER-2: Auto-close markets based on close behavior.
 * Runs every 1 minute.
 */
async function checkExpiredMarkets(job: Job<JobData>): Promise<any> {
  const db = createDatabase();
  const now = new Date();

  try {
    // 1. Find markets with close_behavior = 'auto' that are past closes_at
    const autoMarkets = await db.query.markets.findMany({
      where: and(
        eq(markets.status, 'ACTIVE'),
        eq(markets.closeBehavior, 'auto'),
        isNotNull(markets.closesAt),
        sql`${markets.closesAt} < ${now.toISOString()}`
      ),
    });

    // 2. Find markets with close_behavior = 'auto_with_buffer' that are past buffer
    const bufferedMarkets = await db.query.markets.findMany({
      where: and(
        eq(markets.status, 'ACTIVE'),
        eq(markets.closeBehavior, 'auto_with_buffer'),
        isNotNull(markets.closesAt),
        isNotNull(markets.bufferMinutes),
        // closes_at + buffer_minutes < now
        sql`${markets.closesAt} + (${markets.bufferMinutes} * INTERVAL '1 minute') < ${now.toISOString()}`
      ),
    });

    const marketsToClose = [...autoMarkets, ...bufferedMarkets];

    // 3. Close each market in a transaction
    for (const market of marketsToClose) {
      await db.transaction(async (tx) => {
        // Update market status to PAUSED
        await tx.update(markets)
          .set({ status: 'PAUSED', updatedAt: new Date() })
          .where(eq(markets.id, market.id));

        // Create audit log entry
        await tx.insert(auditLogs).values({
          adminId: SYSTEM_USER_ID,
          action: 'MARKET_AUTO_CLOSED',
          entityType: 'market',
          entityId: market.id,
          details: JSON.stringify({
            marketId: market.id,
            title: market.title,
            closeBehavior: market.closeBehavior,
            closesAt: market.closesAt,
            bufferMinutes: market.bufferMinutes,
          }),
        });

        console.log(`[market:check-expired] Closed market ${market.id} (${market.closeBehavior})`);

        // TODO: Emit WebSocket event: market:closed
        // This will be implemented when WebSocket infrastructure is available (EPIC_11)
      });
    }

    return {
      processed: marketsToClose.length,
      auto: autoMarkets.length,
      buffered: bufferedMarkets.length,
    };
  } catch (error) {
    console.error('[market:check-expired] Error:', error);
    throw error;
  }
}

/**
 * SCHEDULER-5: Activate scheduled markets (placeholder for future implementation).
 * Runs every 1 minute.
 */
async function activateScheduledMarkets(job: Job<JobData>): Promise<any> {
  // TODO: Implement in SCHEDULER-5
  // Will query markets with status = 'DRAFT' and activates_at < NOW()
  return { activated: 0 };
}

/**
 * SCHEDULER-2a: Remind admins about manual-close markets.
 * Runs every 15 minutes.
 */
async function remindManualClose(job: Job<JobData>): Promise<any> {
  const db = createDatabase();
  const now = new Date();

  try {
    // Find manual-close markets that are past closes_at
    const manualMarkets = await db.query.markets.findMany({
      where: and(
        eq(markets.status, 'ACTIVE'),
        eq(markets.closeBehavior, 'manual'),
        isNotNull(markets.closesAt),
        sql`${markets.closesAt} < ${now.toISOString()}`
      ),
    });

    let warnings = 0;
    let urgent = 0;

    for (const market of manualMarkets) {
      if (!market.closesAt) continue;

      const minutesPast = (now.getTime() - market.closesAt.getTime()) / 60000;

      if (minutesPast > 120) {
        // 2+ hours: Urgent
        urgent++;
        console.error(JSON.stringify({
          level: 'ERROR',
          service: 'scheduler',
          message: 'Manual-close market needs urgent attention',
          marketId: market.id,
          title: market.title,
          minutesPast: Math.floor(minutesPast),
          closesAt: market.closesAt,
        }));
        // TODO: Queue email/Slack notification when notification system exists
      } else if (minutesPast > 60) {
        // 1-2 hours: Warning
        warnings++;
        console.warn(JSON.stringify({
          level: 'WARN',
          service: 'scheduler',
          message: 'Manual-close market needs attention',
          marketId: market.id,
          title: market.title,
          minutesPast: Math.floor(minutesPast),
          closesAt: market.closesAt,
        }));
      } else if (minutesPast > 30) {
        // 30-60 min: Info
        console.info(JSON.stringify({
          level: 'INFO',
          service: 'scheduler',
          message: 'Manual-close market approaching attention threshold',
          marketId: market.id,
          title: market.title,
          minutesPast: Math.floor(minutesPast),
        }));
      }
      // 0-30 min: No action (event likely still ongoing)
    }

    return {
      checked: manualMarkets.length,
      warnings,
      urgent,
    };
  } catch (error) {
    console.error('[market:remind-manual-close] Error:', error);
    throw error;
  }
}
