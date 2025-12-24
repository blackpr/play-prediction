import { GetAdminMarketsUseCase } from '@/application/use-cases/admin/get-admin-markets.use-case';
import { AdminMarketListItem, MarketRepository } from '@/application/ports/repositories/market.repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GetAdminMarketsUseCase', () => {
  let useCase: GetAdminMarketsUseCase;
  let marketRepository: MarketRepository;

  beforeEach(() => {
    marketRepository = {
      listAdminMarkets: vi.fn(),
    } as unknown as MarketRepository;
    useCase = new GetAdminMarketsUseCase({ marketRepository });
  });

  it('should call marketRepository.listAdminMarkets with correct params', async () => {
    const params = { page: 1, pageSize: 20, status: 'all' };
    const mockMarkets: AdminMarketListItem[] = [
      {
        id: '1',
        title: 'Market 1',
        status: 'DRAFT',
        holdersCount: 5,
        volume24h: '0',
        creator: { email: 'admin@test.com', displayName: 'Admin', role: 'admin' },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-id',
        pool: null,
        yesPrice: '0.5',
        noPrice: '0.5',
        stats: { totalVolume: '0', volume24h: '0', tradeCount: 0, uniqueTraders: 0 },
        // ... other required properties mock
      } as any,
    ];

    vi.mocked(marketRepository.listAdminMarkets).mockResolvedValue({
      items: mockMarkets,
      total: 10,
    });

    const result = await useCase.execute(params);

    expect(marketRepository.listAdminMarkets).toHaveBeenCalledWith(params);
    expect(result.items).toEqual(mockMarkets);
    expect(result.total).toEqual(10);
  });
});
