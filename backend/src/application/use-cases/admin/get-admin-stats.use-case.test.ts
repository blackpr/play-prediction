import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetAdminStatsUseCase } from './get-admin-stats.use-case';
import { UserRepository } from '../../ports/repositories/user.repository';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';

describe('GetAdminStatsUseCase', () => {
  let useCase: GetAdminStatsUseCase;
  let mockUserRepository: UserRepository;
  let mockMarketRepository: MarketRepository;
  let mockTradeLedgerRepository: TradeLedgerRepository;

  beforeEach(() => {
    mockUserRepository = {
      count: vi.fn(),
      countActive: vi.fn(),
      // Add other methods if needed to satisfy interface
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByRole: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      updateBalance: vi.fn(),
      getUserStats: vi.fn(),
    } as unknown as UserRepository;

    mockMarketRepository = {
      count: vi.fn(),
    } as unknown as MarketRepository;

    mockTradeLedgerRepository = {
      getTotalVolume: vi.fn(),
      getVolume24h: vi.fn(),
      findAll: vi.fn(),
      findByIdempotencyKey: vi.fn(),
      create: vi.fn(),
    } as unknown as TradeLedgerRepository;

    useCase = new GetAdminStatsUseCase({
      userRepository: mockUserRepository,
      marketRepository: mockMarketRepository,
      tradeLedgerRepository: mockTradeLedgerRepository,
    });
  });

  it('should return aggregated stats correctly', async () => {
    // Mock return values
    vi.mocked(mockUserRepository.count).mockResolvedValue(100);
    vi.mocked(mockUserRepository.countActive).mockResolvedValue(50);

    vi.mocked(mockMarketRepository.count).mockImplementation(async (status?: string) => {
      if (!status) return 20;
      if (status === 'ACTIVE') return 10;
      if (status === 'PAUSED') return 5;
      if (status === 'RESOLVED') return 3;
      if (status === 'CANCELLED') return 2;
      return 0;
    });

    vi.mocked(mockTradeLedgerRepository.getTotalVolume).mockResolvedValue('1000000');
    vi.mocked(mockTradeLedgerRepository.getVolume24h).mockResolvedValue('10000');

    const result = await useCase.execute();

    expect(result).toEqual({
      users: {
        total: 100,
        activeLastWeek: 50,
      },
      markets: {
        total: 20,
        active: 10,
        pendingResolution: 5,
        resolved: 3,
        cancelled: 2,
      },
      volume: {
        total: '1000000',
        last24h: '10000',
      },
    });

    // Verify countActive called with a date
    expect(mockUserRepository.countActive).toHaveBeenCalledWith(expect.any(Date));
  });

  it('should handle zero values', async () => {
    vi.mocked(mockUserRepository.count).mockResolvedValue(0);
    vi.mocked(mockUserRepository.countActive).mockResolvedValue(0);
    vi.mocked(mockMarketRepository.count).mockResolvedValue(0);
    vi.mocked(mockTradeLedgerRepository.getTotalVolume).mockResolvedValue('0');
    vi.mocked(mockTradeLedgerRepository.getVolume24h).mockResolvedValue('0');

    const result = await useCase.execute();

    expect(result.users.total).toBe(0);
    expect(result.markets.total).toBe(0);
    expect(result.volume.total).toBe('0');
  });
});
