import { MarketRepository, MarketExtendedDetails } from '../../ports/repositories/market.repository';
import { NotFoundError } from '../../../domain/errors/domain-error';

export class GetMarketUseCase {
  private readonly marketRepository: MarketRepository;

  constructor({ marketRepository }: { marketRepository: MarketRepository }) {
    this.marketRepository = marketRepository;
  }

  async execute(id: string): Promise<MarketExtendedDetails> {
    const market = await this.marketRepository.findById(id);

    if (!market) {
      throw new NotFoundError('Market', id);
    }

    return market;
  }
}
