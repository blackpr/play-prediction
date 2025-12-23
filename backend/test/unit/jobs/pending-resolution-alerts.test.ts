import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationHandlers } from '../../../src/infrastructure/jobs/handlers/notifications';
import { Job } from 'bullmq';
import { JobData } from '../../../src/infrastructure/jobs/types';

// Mock the database
vi.mock('../../../src/infrastructure/database', () => ({
  createDatabase: vi.fn(() => mockDb),
}));

let mockDb: any;

describe('Pending Resolution Alerts Job', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock database
    mockDb = {
      query: {
        markets: {
          findMany: vi.fn(),
        },
      },
    };
  });

  describe('admin:alert-pending-resolution', () => {
    it('should return checked: 0 when no pending markets exist', async () => {
      mockDb.query.markets.findMany.mockResolvedValue([]);

      const job = {
        id: 'job-1',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.checked).toBe(0);
      expect(result.info).toBe(0);
      expect(result.warning).toBe(0);
      expect(result.critical).toBe(0);
    });

    it('should log info for markets < 24h past close', async () => {
      const recentMarket = {
        id: 'market-1',
        title: 'Recent Market',
        status: 'PAUSED',
        closesAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      };

      mockDb.query.markets.findMany.mockResolvedValue([recentMarket]);

      const consoleSpy = vi.spyOn(console, 'info');

      const job = {
        id: 'job-2',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.checked).toBe(1);
      expect(result.info).toBe(1);
      expect(result.warning).toBe(0);
      expect(result.critical).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log warning for markets 24-48h past close', async () => {
      const warningMarket = {
        id: 'market-2',
        title: 'Warning Market',
        status: 'PAUSED',
        closesAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago
      };

      mockDb.query.markets.findMany.mockResolvedValue([warningMarket]);

      const consoleSpy = vi.spyOn(console, 'warn');

      const job = {
        id: 'job-3',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.checked).toBe(1);
      expect(result.info).toBe(0);
      expect(result.warning).toBe(1);
      expect(result.critical).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log error for markets 48+ hours past close', async () => {
      const criticalMarket = {
        id: 'market-3',
        title: 'Critical Market',
        status: 'PAUSED',
        closesAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 72 hours ago
      };

      mockDb.query.markets.findMany.mockResolvedValue([criticalMarket]);

      const consoleSpy = vi.spyOn(console, 'error');

      const job = {
        id: 'job-4',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.checked).toBe(1);
      expect(result.info).toBe(0);
      expect(result.warning).toBe(0);
      expect(result.critical).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle multiple markets with different urgency levels', async () => {
      const markets = [
        {
          id: 'market-info',
          title: 'Info Market',
          status: 'PAUSED',
          closesAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        },
        {
          id: 'market-warning',
          title: 'Warning Market',
          status: 'PAUSED',
          closesAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago
        },
        {
          id: 'market-critical',
          title: 'Critical Market',
          status: 'PAUSED',
          closesAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours ago
        },
      ];

      mockDb.query.markets.findMany.mockResolvedValue(markets);

      const job = {
        id: 'job-5',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.checked).toBe(3);
      expect(result.info).toBe(1);
      expect(result.warning).toBe(1);
      expect(result.critical).toBe(1);
    });

    it('should skip markets with null closesAt', async () => {
      const markets = [
        {
          id: 'market-1',
          title: 'Market with null closesAt',
          status: 'PAUSED',
          closesAt: null,
        },
        {
          id: 'market-2',
          title: 'Valid Market',
          status: 'PAUSED',
          closesAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        },
      ];

      mockDb.query.markets.findMany.mockResolvedValue(markets);

      const job = {
        id: 'job-6',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      // Should only count the valid market
      expect(result.checked).toBe(2); // Both markets in array
      expect(result.info).toBe(1); // But only one processed
    });

    it('should handle database errors gracefully', async () => {
      mockDb.query.markets.findMany.mockRejectedValue(new Error('Database error'));

      const job = {
        id: 'job-7',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      await expect(notificationHandlers(job)).rejects.toThrow('Database error');
    });

    it('should log at exactly 24 hours as warning level', async () => {
      const market = {
        id: 'market-24h',
        title: '24 Hour Market',
        status: 'PAUSED',
        closesAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Exactly 24 hours ago
      };

      mockDb.query.markets.findMany.mockResolvedValue([market]);

      const consoleSpy = vi.spyOn(console, 'warn');

      const job = {
        id: 'job-8',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.warning).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log at exactly 48 hours as critical level', async () => {
      const market = {
        id: 'market-48h',
        title: '48 Hour Market',
        status: 'PAUSED',
        closesAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // Exactly 48 hours ago
      };

      mockDb.query.markets.findMany.mockResolvedValue([market]);

      const consoleSpy = vi.spyOn(console, 'error');

      const job = {
        id: 'job-9',
        data: {
          type: 'admin:alert-pending-resolution',
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.critical).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('unknown job type', () => {
    it('should return error for unknown job type', async () => {
      const job = {
        id: 'job-10',
        data: {
          type: 'unknown:notification' as any,
          payload: {},
        },
      } as Job<JobData>;

      const result = await notificationHandlers(job);

      expect(result.processed).toBe(false);
      expect(result.error).toBe('Unknown job type');
    });
  });
});
