
/**
 * Known queue names in the system.
 * Aligned with SYSTEM_DESIGN.md Section 5.6
 */
export type QueueName =
  | 'market-ops'
  | 'notifications'
  | 'maintenance'
  | 'analytics'
  | 'integrations';

/**
 * Union of all possible job types.
 * Serves as a discriminator for job data.
 */
export type JobType =
  // market-ops
  | 'market:check-expired'
  | 'market:activate-scheduled'
  | 'market:resolve-oracle'
  | 'market:archive'

  // notifications
  | 'notification:user'
  | 'notification:admin'
  | 'notification:trade-voided'

  // maintenance
  | 'maintenance:cleanup-tokens'
  | 'maintenance:snapshot'

  // analytics
  | 'analytics:daily-stats'
  | 'analytics:leaderboard';

/**
 * Base interface for all job data.
 */
export interface JobData {
  type: JobType;
  payload: Record<string, any>;
  metadata?: {
    requestId?: string;
    userId?: string;
    triggeredBy?: string;
    timestamp?: number;
  };
}
