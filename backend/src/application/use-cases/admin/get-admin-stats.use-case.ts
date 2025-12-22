import { UserRepository } from '../../ports/repositories/user.repository';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';

export interface AdminStats {
  totalUsers: number;
  activeMarkets: number;
  volume24h: string;
  recentTrades: {
    id: string;
    marketTitle: string;
    action: string;
    amountIn: string;
    createdAt: Date;
    user: string | null;
  }[];
  pendingResolutionMarkets: number;
}

export class GetAdminStatsUseCase {
  private readonly userRepository: UserRepository;
  private readonly marketRepository: MarketRepository;
  private readonly tradeLedgerRepository: TradeLedgerRepository;

  constructor({
    userRepository,
    marketRepository,
    tradeLedgerRepository
  }: {
    userRepository: UserRepository;
    marketRepository: MarketRepository;
    tradeLedgerRepository: TradeLedgerRepository;
  }) {
    this.userRepository = userRepository;
    this.marketRepository = marketRepository;
    this.tradeLedgerRepository = tradeLedgerRepository;
  }

  async execute(): Promise<AdminStats> {
    const [
      totalUsers,
      activeMarkets,
      pendingResolutionMarkets,
      volume24h,
      recentTrades
    ] = await Promise.all([
      this.userRepository.count(),
      this.marketRepository.count('ACTIVE'),
      this.marketRepository.count('PAUSED'),
      this.tradeLedgerRepository.getVolume24h(),
      this.tradeLedgerRepository.findAll({ page: 1, pageSize: 10 })
    ]);

    const recentTradesWithDetails = await Promise.all(recentTrades.items.map(async (trade) => {
      let marketTitle = 'Unknown Market';
      try {
        const market = await this.marketRepository.findById(trade.marketId);
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
      totalUsers,
      activeMarkets,
      pendingResolutionMarkets,
      volume24h,
      recentTrades: recentTradesWithDetails
    };
  }
}
