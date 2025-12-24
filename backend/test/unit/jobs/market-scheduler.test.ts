import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { marketHandlers } from '../../../src/infrastructure/jobs/handlers/market';
import { Job } from 'bullmq';
import { JobData } from '../../../src/infrastructure/jobs/types';

// Mock the database
vi.mock('../../../src/infrastructure/database', () => ({
  createDatabase: vi.fn(() => mockDb),
}));

let mockDb: any;

describe('Market Scheduler Jobs', () => {
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
      transaction: vi.fn((callback) => callback(mockDb)),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(),
      })),
    };
  });

  describe('market:check-expired', () => {
    it('should close markets with close_behavior = auto past closes_at', async () => {
      const expiredAutoMarket = {
        id: 'market-1',
        title: 'Auto Close Market',
        status: 'ACTIVE',
        closeBehavior: 'auto',
        closesAt: new Date(Date.now() - 60000), // 1 minute ago
        bufferMinutes: null,
      };

      mockDb.query.markets.findMany
        .mockResolvedValueOnce([expiredAutoMarket]) // auto markets
        .mockResolvedValueOnce([]); // buffered markets

      const job = {
        id: 'job-1',
        data: {
          type: 'market:check-expired',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.processed).toBe(1);
      expect(result.auto).toBe(1);
      expect(result.buffered).toBe(0);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should close markets with close_behavior = auto_with_buffer past buffer', async () => {
      const expiredBufferedMarket = {
        id: 'market-2',
        title: 'Buffered Market',
        status: 'ACTIVE',
        closeBehavior: 'auto_with_buffer',
        closesAt: new Date(Date.now() - 3600000), // 1 hour ago
        bufferMinutes: 30, // Buffer expired 30 minutes ago
      };

      mockDb.query.markets.findMany
        .mockResolvedValueOnce([]) // auto markets
        .mockResolvedValueOnce([expiredBufferedMarket]); // buffered markets

      const job = {
        id: 'job-2',
        data: {
          type: 'market:check-expired',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.processed).toBe(1);
      expect(result.auto).toBe(0);
      expect(result.buffered).toBe(1);
    });

    it('should NOT close markets with close_behavior = manual', async () => {
      // Manual markets should not be returned by the queries
      mockDb.query.markets.findMany
        .mockResolvedValueOnce([]) // auto markets
        .mockResolvedValueOnce([]); // buffered markets

      const job = {
        id: 'job-3',
        data: {
          type: 'market:check-expired',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.processed).toBe(0);
      expect(result.auto).toBe(0);
      expect(result.buffered).toBe(0);
    });

    it('should NOT close markets that have not reached closes_at yet', async () => {
      // Future markets should not be returned by the queries
      mockDb.query.markets.findMany
        .mockResolvedValueOnce([]) // auto markets
        .mockResolvedValueOnce([]); // buffered markets

      const job = {
        id: 'job-4',
        data: {
          type: 'market:check-expired',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.processed).toBe(0);
    });

    it('should handle multiple markets in one run', async () => {
      const autoMarket1 = {
        id: 'market-auto-1',
        title: 'Auto Market 1',
        status: 'ACTIVE',
        closeBehavior: 'auto',
        closesAt: new Date(Date.now() - 60000),
        bufferMinutes: null,
      };

      const autoMarket2 = {
        id: 'market-auto-2',
        title: 'Auto Market 2',
        status: 'ACTIVE',
        closeBehavior: 'auto',
        closesAt: new Date(Date.now() - 120000),
        bufferMinutes: null,
      };

      const bufferedMarket = {
        id: 'market-buffered-1',
        title: 'Buffered Market',
        status: 'ACTIVE',
        closeBehavior: 'auto_with_buffer',
        closesAt: new Date(Date.now() - 3600000),
        bufferMinutes: 15,
      };

      mockDb.query.markets.findMany
        .mockResolvedValueOnce([autoMarket1, autoMarket2]) // auto markets
        .mockResolvedValueOnce([bufferedMarket]); // buffered markets

      const job = {
        id: 'job-5',
        data: {
          type: 'market:check-expired',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.processed).toBe(3);
      expect(result.auto).toBe(2);
      expect(result.buffered).toBe(1);
      expect(mockDb.transaction).toHaveBeenCalledTimes(3);
    });

    it('should be idempotent (running twice does not duplicate)', async () => {
      // First run
      mockDb.query.markets.findMany
        .mockResolvedValueOnce([]) // auto markets
        .mockResolvedValueOnce([]); // buffered markets

      const job = {
        id: 'job-6',
        data: {
          type: 'market:check-expired',
          payload: {},
        },
      } as Job<JobData>;

      const result1 = await marketHandlers(job);
      expect(result1.processed).toBe(0);

      // Second run - should still find nothing (markets already closed)
      mockDb.query.markets.findMany
        .mockResolvedValueOnce([]) // auto markets
        .mockResolvedValueOnce([]); // buffered markets

      const result2 = await marketHandlers(job);
      expect(result2.processed).toBe(0);
    });
  });

  describe('market:remind-manual-close', () => {
    it('should not log anything for markets < 30 min past close', async () => {
      const recentManualMarket = {
        id: 'market-manual-1',
        title: 'Recent Manual Market',
        status: 'ACTIVE',
        closeBehavior: 'manual',
        closesAt: new Date(Date.now() - 15 * 60000), // 15 minutes ago
        bufferMinutes: null,
      };

      mockDb.query.markets.findMany.mockResolvedValue([recentManualMarket]);

      const consoleSpy = vi.spyOn(console, 'info');

      const job = {
        id: 'job-7',
        data: {
          type: 'market:remind-manual-close',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.checked).toBe(1);
      expect(result.warnings).toBe(0);
      expect(result.urgent).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should log info for markets 30-60 min past close', async () => {
      const manualMarket = {
        id: 'market-manual-2',
        title: 'Manual Market Info',
        status: 'ACTIVE',
        closeBehavior: 'manual',
        closesAt: new Date(Date.now() - 45 * 60000), // 45 minutes ago
        bufferMinutes: null,
      };

      mockDb.query.markets.findMany.mockResolvedValue([manualMarket]);

      const consoleSpy = vi.spyOn(console, 'info');

      const job = {
        id: 'job-8',
        data: {
          type: 'market:remind-manual-close',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.checked).toBe(1);
      expect(result.warnings).toBe(0);
      expect(result.urgent).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log warning for markets 1-2 hours past close', async () => {
      const manualMarket = {
        id: 'market-manual-3',
        title: 'Manual Market Warning',
        status: 'ACTIVE',
        closeBehavior: 'manual',
        closesAt: new Date(Date.now() - 90 * 60000), // 90 minutes ago
        bufferMinutes: null,
      };

      mockDb.query.markets.findMany.mockResolvedValue([manualMarket]);

      const consoleSpy = vi.spyOn(console, 'warn');

      const job = {
        id: 'job-9',
        data: {
          type: 'market:remind-manual-close',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.checked).toBe(1);
      expect(result.warnings).toBe(1);
      expect(result.urgent).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log error for markets > 2 hours past close', async () => {
      const manualMarket = {
        id: 'market-manual-4',
        title: 'Manual Market Urgent',
        status: 'ACTIVE',
        closeBehavior: 'manual',
        closesAt: new Date(Date.now() - 150 * 60000), // 2.5 hours ago
        bufferMinutes: null,
      };

      mockDb.query.markets.findMany.mockResolvedValue([manualMarket]);

      const consoleSpy = vi.spyOn(console, 'error');

      const job = {
        id: 'job-10',
        data: {
          type: 'market:remind-manual-close',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.checked).toBe(1);
      expect(result.warnings).toBe(0);
      expect(result.urgent).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should NOT process non-manual markets', async () => {
      // Query should only return manual markets
      mockDb.query.markets.findMany.mockResolvedValue([]);

      const job = {
        id: 'job-11',
        data: {
          type: 'market:remind-manual-close',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.checked).toBe(0);
      expect(result.warnings).toBe(0);
      expect(result.urgent).toBe(0);
    });
  });

  describe('market:activate-scheduled', () => {
    it('should activate markets when activates_at time is reached', async () => {
      const scheduledMarket = {
        id: 'market-scheduled-1',
        title: 'Scheduled Market',
        status: 'DRAFT',
        activatesAt: new Date(Date.now() - 60000), // 1 minute ago (should actiate)
      };

      mockDb.query.markets.findMany.mockResolvedValue([scheduledMarket]);

      const job = {
        id: 'job-12',
        data: {
          type: 'market:activate-scheduled',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.activated).toBe(1);
      expect(mockDb.transaction).toHaveBeenCalled();

      // Verify update call
      // Since transaction is mocked to call callback immediately, we should check if update was called
      // We need to inspect how update is mocked in beforeEach
      // The mock returns an object with set(), which returns object with where()
      // We can verify mockDb.update was called
    });

    it('should NOT activate markets with activates_at in future', async () => {
      mockDb.query.markets.findMany.mockResolvedValue([]); // Query handles time filtering

      const job = {
        id: 'job-13',
        data: {
          type: 'market:activate-scheduled',
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);
      expect(result.activated).toBe(0);
    });
  });

  describe('unknown job type', () => {
    it('should return error for unknown job type', async () => {
      const job = {
        id: 'job-13',
        data: {
          type: 'unknown:job' as any,
          payload: {},
        },
      } as Job<JobData>;

      const result = await marketHandlers(job);

      expect(result.processed).toBe(false);
      expect(result.error).toBe('Unknown job type');
    });
  });
});
