import { UserRepository } from '../../ports/repositories/user.repository';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';

export interface AdminStatsResponse {
  users: {
    total: number;
    activeLastWeek: number;
  };
  markets: {
    total: number;
    active: number;
    pendingResolution: number;
    resolved: number;
    cancelled: number;
  };
  volume: {
    total: string;
    last24h: string;
  };
  recentTrades: {
    id: string;
    marketTitle: string;
    action: string;
    amountIn: string;
    createdAt: Date;
    user: string | null;
  }[];
}

export class GetAdminStatsUseCase {
  constructor(
    private readonly deps: {
      userRepository: UserRepository;
      marketRepository: MarketRepository;
      tradeLedgerRepository: TradeLedgerRepository;
    }
  ) { }

  async execute(): Promise<AdminStatsResponse> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      totalMarkets,
      activeMarkets,
      pausedMarkets,
      resolvedMarkets,
      cancelledMarkets,
      totalVolume,
      volume24h,
      recentTrades
    ] = await Promise.all([
      this.deps.userRepository.count(),
      this.deps.userRepository.countActive(oneWeekAgo),
      this.deps.marketRepository.count(),
      this.deps.marketRepository.count('ACTIVE'),
      this.deps.marketRepository.count('PAUSED'),
      this.deps.marketRepository.count('RESOLVED'),
      this.deps.marketRepository.count('CANCELLED'),
      this.deps.tradeLedgerRepository.getTotalVolume(),
      this.deps.tradeLedgerRepository.getVolume24h(),
      this.deps.tradeLedgerRepository.findAll({ page: 1, pageSize: 10 })
    ]);

    const recentTradesWithDetails = await Promise.all(recentTrades.items.map(async (trade) => {
      let marketTitle = 'Unknown Market';
      try {
        const market = await this.deps.marketRepository.findById(trade.marketId);
        if (market) {
          marketTitle = market.title;
        }
      } catch (error) {
        // Silently fail to fetch market title, keep default
      }

      return {
        id: trade.id,
        marketTitle,
        action: trade.action,
        amountIn: trade.amountIn.toString(),
        createdAt: trade.createdAt,
        user: trade.userId
      };
    }));

    return {
      users: {
        total: totalUsers,
        activeLastWeek: activeUsers
      },
      markets: {
        total: totalMarkets,
        active: activeMarkets,
        pendingResolution: pausedMarkets,
        resolved: resolvedMarkets,
        cancelled: cancelledMarkets
      },
      volume: {
        total: totalVolume,
        last24h: volume24h
      },
      recentTrades: recentTradesWithDetails
    };
  }
}
