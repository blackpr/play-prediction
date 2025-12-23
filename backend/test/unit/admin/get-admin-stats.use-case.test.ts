import { describe, it, expect, vi } from 'vitest';
import { GetAdminStatsUseCase } from '@/application/use-cases/admin/get-admin-stats.use-case';
import { UserRepository } from '@/application/ports/repositories/user.repository';
import { MarketRepository } from '@/application/ports/repositories/market.repository';
import { TradeLedgerRepository } from '@/application/ports/repositories/trade-ledger.repository';

describe('GetAdminStatsUseCase', () => {
  const mockUserRepository = {
    count: vi.fn(),
    countActive: vi.fn(),
  } as unknown as UserRepository;

  const mockMarketRepository = {
    count: vi.fn(),
    findById: vi.fn(),
  } as unknown as MarketRepository;

  const mockTradeLedgerRepository = {
    getVolume24h: vi.fn(),
    getTotalVolume: vi.fn(),
    findAll: vi.fn(),
  } as unknown as TradeLedgerRepository;

  const useCase = new GetAdminStatsUseCase({
    userRepository: mockUserRepository,
    marketRepository: mockMarketRepository,
    tradeLedgerRepository: mockTradeLedgerRepository
  });

  it('should return aggregated stats', async () => {
    vi.mocked(mockUserRepository.count).mockResolvedValue(150);
    vi.mocked(mockUserRepository.countActive).mockResolvedValue(50);
    vi.mocked(mockMarketRepository.count).mockImplementation(async (status) => {
      if (status === 'ACTIVE') return 10;
      if (status === 'PAUSED') return 2;
      if (status === 'RESOLVED') return 5;
      if (status === 'CANCELLED') return 1;
      return 0;
    });
    vi.mocked(mockTradeLedgerRepository.getTotalVolume).mockResolvedValue('100000');
    vi.mocked(mockTradeLedgerRepository.getVolume24h).mockResolvedValue('50000');
    vi.mocked(mockTradeLedgerRepository.findAll).mockResolvedValue({
      items: [
        {
          id: 'trade-1',
          userId: 'user-1',
          marketId: 'market-1',
          action: 'BUY',
          amountIn: 100n,
          createdAt: new Date(),
        } as any
      ],
      total: 1
    });
    vi.mocked(mockMarketRepository.findById).mockResolvedValue({
      id: 'market-1',
      title: 'Election 2024',
    } as any);

    const result = await useCase.execute();

    expect(result.users.total).toBe(150);
    expect(result.users.activeLastWeek).toBe(50);
    expect(result.markets.active).toBe(10);
    expect(result.markets.pendingResolution).toBe(2);
    expect(result.volume.last24h).toBe('50000');
    expect(result.volume.total).toBe('100000');
    expect(result.recentTrades).toHaveLength(1);
    expect(result.recentTrades[0].marketTitle).toBe('Election 2024');

    expect(mockUserRepository.count).toHaveBeenCalled();
    expect(mockMarketRepository.count).toHaveBeenCalledWith('ACTIVE');
    expect(mockMarketRepository.count).toHaveBeenCalledWith('PAUSED');
  });

  it('should handle missing market titles gracefully', async () => {
    vi.mocked(mockUserRepository.count).mockResolvedValue(100);
    vi.mocked(mockUserRepository.countActive).mockResolvedValue(20);
    vi.mocked(mockMarketRepository.count).mockResolvedValue(5);
    vi.mocked(mockTradeLedgerRepository.getTotalVolume).mockResolvedValue('5000');
    vi.mocked(mockTradeLedgerRepository.getVolume24h).mockResolvedValue('1000');
    vi.mocked(mockTradeLedgerRepository.findAll).mockResolvedValue({
      items: [
        {
          id: 'trade-2',
          marketId: 'deleted-market',
          action: 'SELL',
          amountIn: 50n,
          createdAt: new Date(),
        } as any
      ],
      total: 1
    });
    vi.mocked(mockMarketRepository.findById).mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result.recentTrades).toHaveLength(1);
    expect(result.recentTrades[0].marketTitle).toBe('Unknown Market');
  });
});
