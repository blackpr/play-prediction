import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetPortfolioUseCase } from '../../../../src/application/use-cases/portfolio/get-portfolio.use-case';
import { PortfolioRepository } from '../../../../src/application/ports/repositories/portfolio.repository';
import { MarketRepository } from '../../../../src/application/ports/repositories/market.repository';

describe('GetPortfolioUseCase', () => {
  let useCase: GetPortfolioUseCase;
  let mockPortfolioRepo: PortfolioRepository;
  let mockMarketRepo: MarketRepository;

  beforeEach(() => {
    mockPortfolioRepo = {
      findByUser: vi.fn(),
      findByUserAndMarket: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findByMarket: vi.fn(),
      deleteByUserAndMarket: vi.fn(),
    };

    mockMarketRepo = {
      findById: vi.fn(),
      findByIdWithPool: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
      updatePoolQuantities: vi.fn(),
      updateUserBalance: vi.fn(),
      getMarketPriceHistory: vi.fn(),
      getRecentTrades: vi.fn(),
    } as unknown as MarketRepository;

    useCase = new GetPortfolioUseCase({
      portfolioRepository: mockPortfolioRepo,
      marketRepository: mockMarketRepo,
    });
  });

  it('should return empty portfolio when user has no positions', async () => {
    vi.mocked(mockPortfolioRepo.findByUser).mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.totalValue).toBe('0');
    expect(result.totalCostBasis).toBe('0');
    expect(result.unrealizedPnL).toBe('0');
    expect(result.positions).toHaveLength(0);
  });

  it('should calculate portfolio correctly with single position', async () => {
    const portfolio = {
      userId: 'user-1',
      marketId: 'market-1',
      yesQty: 100000n,
      noQty: 0n,
      yesCostBasis: 50000n,
      noCostBasis: 0n,
      updatedAt: new Date(),
    };

    const market = {
      id: 'market-1',
      title: 'Test Market',
      description: 'Test',
      creatorId: 'creator-1',
      status: 'ACTIVE',
      category: 'CRYPTO',
      closesAt: new Date(),
      yesPrice: '0.60',
      noPrice: '0.40',
      volume24h: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockPortfolioRepo.findByUser).mockResolvedValue([portfolio]);
    vi.mocked(mockMarketRepo.findById).mockResolvedValue(market as any);

    const result = await useCase.execute({ userId: 'user-1' });

    // Current value = 100000 * 0.60 = 60000
    // Cost basis = 50000
    // PnL = 10000
    expect(result.totalValue).toBe('60000');
    expect(result.totalCostBasis).toBe('50000');
    expect(result.unrealizedPnL).toBe('10000');
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].market.title).toBe('Test Market');
  });

  it('should filter out positions with zero quantity when hasPosition is true', async () => {
    const portfolios = [
      {
        userId: 'user-1',
        marketId: 'market-1',
        yesQty: 100000n,
        noQty: 0n,
        yesCostBasis: 50000n,
        noCostBasis: 0n,
        updatedAt: new Date(),
      },
      {
        userId: 'user-1',
        marketId: 'market-2',
        yesQty: 0n,
        noQty: 0n,
        yesCostBasis: 0n,
        noCostBasis: 0n,
        updatedAt: new Date(),
      },
    ];

    const market = {
      id: 'market-1',
      title: 'Test Market',
      description: 'Test',
      creatorId: 'creator-1',
      status: 'ACTIVE',
      category: 'CRYPTO',
      closesAt: new Date(),
      yesPrice: '0.60',
      noPrice: '0.40',
      volume24h: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockPortfolioRepo.findByUser).mockResolvedValue(portfolios);
    vi.mocked(mockMarketRepo.findById).mockResolvedValue(market as any);

    const result = await useCase.execute({ userId: 'user-1', hasPosition: true });

    expect(result.positions).toHaveLength(1);
  });

  it('should filter by market status', async () => {
    const portfolio = {
      userId: 'user-1',
      marketId: 'market-1',
      yesQty: 100000n,
      noQty: 0n,
      yesCostBasis: 50000n,
      noCostBasis: 0n,
      updatedAt: new Date(),
    };

    const market = {
      id: 'market-1',
      title: 'Test Market',
      description: 'Test',
      creatorId: 'creator-1',
      status: 'RESOLVED',
      category: 'CRYPTO',
      closesAt: new Date(),
      yesPrice: '0.60',
      noPrice: '0.40',
      volume24h: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockPortfolioRepo.findByUser).mockResolvedValue([portfolio]);
    vi.mocked(mockMarketRepo.findById).mockResolvedValue(market as any);

    const result = await useCase.execute({ userId: 'user-1', status: 'ACTIVE' });

    expect(result.positions).toHaveLength(0);
  });
});
