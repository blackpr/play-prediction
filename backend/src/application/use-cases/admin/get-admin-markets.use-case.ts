import { GetMarketsParams, MarketRepository, AdminMarketListItem } from '../../ports/repositories/market.repository';

export class GetAdminMarketsUseCase {
  private readonly marketRepository: MarketRepository;

  constructor({ marketRepository }: { marketRepository: MarketRepository }) {
    this.marketRepository = marketRepository;
  }

  async execute(params: GetMarketsParams): Promise<{ items: AdminMarketListItem[]; total: number }> {
    return this.marketRepository.listAdminMarkets(params);
  }
}
