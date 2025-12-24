import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { MarketRepository } from '../../ports/repositories/market.repository';

export class GetPortfolioUseCase {
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

  async execute(params: { userId: string; status?: string; hasPosition?: boolean }) {
    const portfolios = await this.portfolioRepository.findByUser(params.userId);

    // Default hasPosition to true as per Epic 08
    const hasPos = params.hasPosition ?? true;

    // Filter by position if requested
    const filteredPortfolios = hasPos
      ? portfolios.filter(p => p.yesQty > 0n || p.noQty > 0n)
      : portfolios;

    // Get all unique market IDs
    const marketIds = [...new Set(filteredPortfolios.map(p => p.marketId))];

    // Fetch market details for each
    // For simplicity, we'll fetch them one by one or in a loop, 
    // but ideally we'd have a findByIds method in repository.
    const positions = await Promise.all(
      filteredPortfolios.map(async (portfolio) => {
        const market = await this.marketRepository.findById(portfolio.marketId);
        if (!market) return null;

        if (params.status && market.status !== params.status) return null;

        const yesQtyBig = portfolio.yesQty;
        const noQtyBig = portfolio.noQty;

        const currentValue = (Number(yesQtyBig) * parseFloat(market.yesPrice)) +
          (Number(noQtyBig) * parseFloat(market.noPrice));

        const costBasis = Number(portfolio.yesCostBasis) + Number(portfolio.noCostBasis);
        const unrealizedPnL = currentValue - costBasis;

        return {
          market: {
            id: market.id,
            title: market.title,
            status: market.status,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
          },
          yesQty: portfolio.yesQty.toString(),
          noQty: portfolio.noQty.toString(),
          yesCostBasis: portfolio.yesCostBasis.toString(),
          noCostBasis: portfolio.noCostBasis.toString(),
          currentValue: Math.round(currentValue).toString(),
          unrealizedPnL: Math.round(unrealizedPnL).toString(),
        };
      })
    );

    const validPositions = positions.filter((p): p is NonNullable<typeof p> => p !== null);

    const totalValue = validPositions.reduce((acc, p) => acc + BigInt(p.currentValue), 0n);
    const totalCostBasis = validPositions.reduce((acc, p) => acc + BigInt(p.yesCostBasis) + BigInt(p.noCostBasis), 0n);
    const unrealizedPnL = totalValue - totalCostBasis;

    return {
      totalValue: totalValue.toString(),
      totalCostBasis: totalCostBasis.toString(),
      unrealizedPnL: unrealizedPnL.toString(),
      positions: validPositions,
    };
  }
}
