import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { MarketRepository } from '../../ports/repositories/market.repository';

export interface GetPortfolioHistoryRequest {
  userId: string;
  marketId?: string;
  action?: string;
  page: number;
  pageSize: number;
}

export class GetPortfolioHistoryUseCase {
  private readonly tradeLedgerRepository: TradeLedgerRepository;
  private readonly marketRepository: MarketRepository;

  constructor({
    tradeLedgerRepository,
    marketRepository,
  }: {
    tradeLedgerRepository: TradeLedgerRepository;
    marketRepository: MarketRepository;
  }) {
    this.tradeLedgerRepository = tradeLedgerRepository;
    this.marketRepository = marketRepository;
  }

  async execute(request: GetPortfolioHistoryRequest) {
    const { userId, marketId, action, page, pageSize } = request;

    const { items, total } = await this.tradeLedgerRepository.findAll({
      userId,
      marketId,
      action,
      page,
      pageSize,
    });

    // Enhance with market titles
    // We can fetch all unique market IDs and query them
    const marketIds = [...new Set(items.map(i => i.marketId))];
    const markets = new Map<string, string>(); // id -> title

    // For simplicity, we can just assume we have market data available locally or cached,
    // but here we must query. To optimize, we could add findByIds to market repo.
    // For now, let's just loop (N+1 problem, but N is small (pageSize)) or use Promise.all

    // Better: Promise.all for unique IDs
    await Promise.all(
      marketIds.map(async (id) => {
        const market = await this.marketRepository.findById(id);
        if (market) {
          markets.set(id, market.title);
        } else {
          markets.set(id, 'Unknown Market');
        }
      })
    );

    const enhancedItems = items.map(item => ({
      id: item.id,
      marketId: item.marketId,
      marketTitle: markets.get(item.marketId) || 'Unknown Market',
      action: item.action,
      side: item.side,
      amountIn: item.amountIn.toString(),
      amountOut: item.amountOut.toString(),
      priceAtExecution: item.priceAtExecution?.toString() || '0',
      feePaid: item.feePaid.toString(),
      createdAt: item.createdAt.toISOString(),
    }));

    return {
      items: enhancedItems,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
