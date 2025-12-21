import { MarketRepository, PriceCandle } from '../../ports/repositories/market.repository';

interface GetMarketPriceHistoryDTO {
  marketId: string;
  interval: string;
  from: Date;
  to: Date;
}

export class GetMarketPriceHistoryUseCase {
  private readonly marketRepository: MarketRepository;

  constructor({ marketRepository }: { marketRepository: MarketRepository }) {
    this.marketRepository = marketRepository;
  }

  async execute({ marketId, interval, from, to }: GetMarketPriceHistoryDTO): Promise<PriceCandle[]> {
    return this.marketRepository.getPriceHistory(marketId, interval, from, to);
  }
}
