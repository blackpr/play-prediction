import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { NotFoundError } from '../../../domain/errors/domain-error';

export class GetPositionUseCase {
  private readonly portfolioRepository: PortfolioRepository;
  private readonly marketRepository: MarketRepository;

  constructor({
    portfolioRepository,
    marketRepository,
  }: {
    portfolioRepository: PortfolioRepository;
    marketRepository: MarketRepository;
  }) {
    this.portfolioRepository = portfolioRepository;
    this.marketRepository = marketRepository;
  }

  async execute(params: { userId: string; marketId: string }) {
    const portfolio = await this.portfolioRepository.findByUserAndMarket(params.userId, params.marketId);

    const market = await this.marketRepository.findById(params.marketId);
    if (!market) {
      throw new NotFoundError('Market', params.marketId);
    }

    if (!portfolio) {
      return {
        marketId: params.marketId,
        yesQty: '0',
        noQty: '0',
        yesCostBasis: '0',
        noCostBasis: '0',
        avgYesBuyPrice: '0',
        avgNoBuyPrice: '0',
        currentYesPrice: market.yesPrice,
        currentNoPrice: market.noPrice,
        unrealizedPnL: '0',
      };
    }

    // Calculate avg buy prices
    // Avg = CostBasis / Qty
    // Cost basis is in MicroPoints, Qty is in MicroShares (1:1 usually)
    const yesQtyBig = portfolio.yesQty;
    const noQtyBig = portfolio.noQty;

    const avgYesBuyPrice = yesQtyBig > 0n
      ? (Number(portfolio.yesCostBasis) / Number(yesQtyBig)).toFixed(6)
      : '0';

    const avgNoBuyPrice = noQtyBig > 0n
      ? (Number(portfolio.noCostBasis) / Number(noQtyBig)).toFixed(6)
      : '0';

    // Current Values
    // Value = Qty * currentPrice
    const currentYesValue = Number(yesQtyBig) * parseFloat(market.yesPrice);
    const currentNoValue = Number(noQtyBig) * parseFloat(market.noPrice);
    const totalCurrentValue = currentYesValue + currentNoValue;

    // Total Cost Basis
    const totalCostBasis = Number(portfolio.yesCostBasis) + Number(portfolio.noCostBasis);

    // Unrealized PnL
    const unrealizedPnL = totalCurrentValue - totalCostBasis;

    return {
      marketId: portfolio.marketId,
      yesQty: portfolio.yesQty.toString(),
      noQty: portfolio.noQty.toString(),
      yesCostBasis: portfolio.yesCostBasis.toString(),
      noCostBasis: portfolio.noCostBasis.toString(),
      avgYesBuyPrice,
      avgNoBuyPrice,
      currentYesPrice: market.yesPrice,
      currentNoPrice: market.noPrice,
      unrealizedPnL: Math.round(unrealizedPnL).toString(),
    };
  }
}
