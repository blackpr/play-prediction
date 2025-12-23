import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus, Resolution, TradeAction } from '../../../infrastructure/database/drizzle/schema';

export interface CancelMarketParams {
  marketId: string;
  reason: string;
}

export interface CancelMarketResult {
  id: string;
  status: string;
  resolution: string;
  totalHolders: number;
  totalRefunded: string;
  surplus: string;
}

export class CancelMarketUseCase {
  constructor(
    private readonly deps: {
      marketRepository: MarketRepository;
      portfolioRepository: PortfolioRepository;
      userRepository: UserRepository;
      tradeLedgerRepository: TradeLedgerRepository;
      transactionManager: TransactionManager;
    }
  ) { }

  async execute(params: CancelMarketParams): Promise<CancelMarketResult> {
    const { marketId, reason } = params;

    return await this.deps.transactionManager.run(async (tx) => {
      // 1. Find and validate market
      const market = await this.deps.marketRepository.findById(marketId);
      if (!market) {
        throw new NotFoundError('Market', `Market with ID ${marketId} not found`);
      }

      // 2. Validate market status - cannot cancel RESOLVED markets
      if (market.status === MarketStatus.RESOLVED) {
        throw new ValidationError(
          `Cannot cancel market. Market is already resolved.`,
          { currentStatus: market.status }
        );
      }

      // 3. Update market status to CANCELLED
      await this.deps.marketRepository.updateStatus(marketId, MarketStatus.CANCELLED, tx);

      // 4. Get all portfolios for this market
      const portfolios = await this.deps.portfolioRepository.findByMarket(marketId, tx);

      let totalHolders = 0;
      let totalRefunded = 0n;

      // 5. Refund each holder their cost basis
      for (const portfolio of portfolios) {
        const refundAmount = portfolio.yesCostBasis + portfolio.noCostBasis;

        if (refundAmount > 0n) {
          totalHolders++;
          totalRefunded += refundAmount;

          // Get current user balance
          const user = await this.deps.userRepository.findById(portfolio.userId);
          if (!user) {
            throw new NotFoundError('User', `User with ID ${portfolio.userId} not found`);
          }

          // Credit user balance with refund
          const newBalance = user.balance + refundAmount;
          await this.deps.userRepository.updateBalance(portfolio.userId, newBalance, tx);

          // Log refund to trade ledger
          await this.deps.tradeLedgerRepository.create(
            {
              userId: portfolio.userId,
              marketId,
              action: TradeAction.REFUND,
              side: null,
              amountIn: portfolio.yesQty + portfolio.noQty, // Total shares
              amountOut: refundAmount, // Cost basis refund
              feePaid: 0n,
              feeVault: 0n,
              feeLp: 0n,
            },
            tx
          );
        }

        // 6. Clear portfolio
        await this.deps.portfolioRepository.update(
          portfolio.userId,
          marketId,
          {
            yesQty: 0n,
            noQty: 0n,
            yesCostBasis: 0n,
            noCostBasis: 0n,
          },
          tx
        );
      }

      // 7. Get pool value before clearing to calculate surplus
      const marketWithPool = await this.deps.marketRepository.findByIdWithPool(marketId, tx);
      const poolValue = marketWithPool?.pool
        ? marketWithPool.pool.yesQty + marketWithPool.pool.noQty
        : 0n;

      // 8. Calculate surplus (fees collected during trading)
      // Surplus = pool value - total refunds (what users get back)
      // This represents the fees that were collected and remain in the pool
      const surplus = poolValue > totalRefunded ? poolValue - totalRefunded : 0n;

      // Note: Pool clearing is handled by database constraints on market status change
      // When a market is set to CANCELLED, the pool is automatically cleared

      return {
        id: marketId,
        status: MarketStatus.CANCELLED,
        resolution: Resolution.CANCELLED,
        totalHolders,
        totalRefunded: totalRefunded.toString(),
        surplus: surplus.toString(),
      };
    });
  }
}
