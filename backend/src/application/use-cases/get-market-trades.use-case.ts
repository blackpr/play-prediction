import { MarketRepository } from '../ports/repositories/market.repository';

export class GetMarketTradesUseCase {
  private readonly marketRepository: MarketRepository;

  constructor({ marketRepository }: { marketRepository: MarketRepository }) {
    this.marketRepository = marketRepository;
  }

  async execute(marketId: string, limit: number = 20) {
    // Validate limit
    const validLimit = Math.min(Math.max(1, limit), 50);

    const trades = await this.marketRepository.getRecentTrades(marketId, validLimit);

    return trades;
  }
}
