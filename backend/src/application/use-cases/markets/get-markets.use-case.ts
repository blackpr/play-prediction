import { GetMarketsParams, MarketRepository, MarketWithDetails } from '../../ports/repositories/market.repository';

export class GetMarketsUseCase {
  private readonly marketRepository: MarketRepository;

  constructor({ marketRepository }: { marketRepository: MarketRepository }) {
    this.marketRepository = marketRepository;
  }

  async execute(params: GetMarketsParams): Promise<{ items: MarketWithDetails[]; total: number }> {
    return this.marketRepository.findAll(params);
  }
}
