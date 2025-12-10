import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCircuitBreakerService } from '../../src/infrastructure/circuit-breakers/circuit-breaker.service';
import { InvariantViolationError, CircuitBreakerOpenError } from '../../src/domain/errors/domain-error';

// Mock DB
const mockExecute = vi.fn();
const mockDb = { execute: mockExecute } as any;

// Mock Redis
const mockRedis = {
  zadd: vi.fn(),
  zremrangebyscore: vi.fn(),
  zrange: vi.fn(),
  pipeline: vi.fn(),
  multi: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => mockRedis)
  }
});

describe('Circuit Breaker Service', () => {
  let service: RedisCircuitBreakerService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Redis mocks
    mockRedis.zrange.mockResolvedValue([]);
    mockRedis.pipeline.mockReturnValue({
      get: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    } as any);
    mockRedis.multi.mockReturnValue({
      incr: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(),
    } as any);
    mockExecute.mockResolvedValue([]);

    service = new RedisCircuitBreakerService({ db: mockDb });
  });

  describe('k-invariant', () => {
    it('should throw InvariantViolationError if k decreases', () => {
      expect(() => service.checkKInvariant(100n, 99n, 'm1', 'buy'))
        .toThrow(InvariantViolationError);
    });

    it('should not throw if k increases', () => {
      expect(() => service.checkKInvariant(100n, 101n, 'm1', 'buy'))
        .not.toThrow();
    });
  });

  describe('System Health', () => {
    it('should throw if DB fails', async () => {
      mockExecute.mockRejectedValue(new Error('Connection Failed'));
      await expect(service.checkSystemHealth())
        .rejects.toThrow(CircuitBreakerOpenError);
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should pass if DB ok and stats ok', async () => {
      mockExecute.mockResolvedValue([]);
      await expect(service.checkSystemHealth()).resolves.not.toThrow();
    });
  });
});
