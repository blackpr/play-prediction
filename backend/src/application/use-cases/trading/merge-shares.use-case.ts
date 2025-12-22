import { BusinessLogicError, NotFoundError } from '../../../domain/errors/domain-error';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';

export interface MergeSharesRequest {
  userId: string;
  marketId: string;
  amount: bigint;
}

export interface MergeSharesResponse {
  transactionId: string;
  amountOut: bigint;
  newBalance: bigint;
}

export class MergeSharesUseCase {
  private readonly marketRepository: MarketRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly tradeLedgerRepository: TradeLedgerRepository;
  private readonly userRepository: UserRepository;
  private readonly transactionManager: TransactionManager;

  constructor({
    marketRepository,
    portfolioRepository,
    tradeLedgerRepository,
    userRepository,
    transactionManager,
  }: {
    marketRepository: MarketRepository;
    portfolioRepository: PortfolioRepository;
    tradeLedgerRepository: TradeLedgerRepository;
    userRepository: UserRepository;
    transactionManager: TransactionManager;
  }) {
    this.marketRepository = marketRepository;
    this.portfolioRepository = portfolioRepository;
    this.tradeLedgerRepository = tradeLedgerRepository;
    this.userRepository = userRepository;
    this.transactionManager = transactionManager;
  }

  async execute(request: MergeSharesRequest): Promise<MergeSharesResponse> {
    const { userId, marketId, amount } = request;

    if (amount <= 0n) {
      throw new BusinessLogicError(
        'Amount must be positive',
        'INVALID_AMOUNT',
        { amount: amount.toString() }
      );
    }

    return await this.transactionManager.run(async (tx) => {
      // 1. Check user has enough of BOTH share types
      const portfolio = await this.portfolioRepository.findByUserAndMarket(
        userId,
        marketId,
        tx
      );

      if (!portfolio || portfolio.yesQty < amount || portfolio.noQty < amount) {
        throw new BusinessLogicError(
          `Insufficient shares: Need ${amount} of each, have YES:${portfolio?.yesQty ?? 0}, NO:${portfolio?.noQty ?? 0}`,
          'INSUFFICIENT_SHARES',
          {
            required: amount.toString(),
            yesAvailable: (portfolio?.yesQty ?? 0n).toString(),
            noAvailable: (portfolio?.noQty ?? 0n).toString(),
          }
        );
      }

      // 2. Remove shares and update cost basis
      const newYesQty = portfolio.yesQty - amount;
      const newNoQty = portfolio.noQty - amount;

      // Proportionally reduce cost basis
      // Avoid division by zero if qty is somehow 0 (should be covered by check above)
      // but strictly speaking safe math:
      const yesBasisReduction = (portfolio.yesCostBasis * amount) / portfolio.yesQty;
      const noBasisReduction = (portfolio.noCostBasis * amount) / portfolio.noQty;

      await this.portfolioRepository.update(
        userId,
        marketId,
        {
          yesQty: newYesQty,
          noQty: newNoQty,
          yesCostBasis: portfolio.yesCostBasis - yesBasisReduction,
          noCostBasis: portfolio.noCostBasis - noBasisReduction,
        },
        tx
      );

      // 3. Credit user balance
      const user = await this.userRepository.findById(userId);
      // We don't strictly need to reload user if we assume existence from portfolio check (portfolio needs user), 
      // but technically we might want to check user existence or get current balance for update.
      // However, MintUseCase loads user first. Here we can do same or just update direct if repo supports it.
      // But typically we read user to get current balance.

      // Let's reload user to be safe and get current balance.
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const newBalance = user.balance + amount;
      await this.marketRepository.updateUserBalance(userId, newBalance, tx);

      // 4. Log to ledger
      const market = await this.marketRepository.findByIdWithPool(marketId, tx);
      // Market existence implicitly checked by portfolio existence? Not necessarily (foreign key protected usually but app logic safest).
      // We need market for pooling stats in ledger.
      if (!market) {
        throw new NotFoundError('Market', marketId);
      }

      const ledgerEntry = await this.tradeLedgerRepository.create(
        {
          userId,
          marketId,
          action: 'MERGE',
          side: null, // MERGE doesn't have a side usually, or maybe both? tradeLedger schema likely nullable.
          // In MintUseCase: side: null.
          amountIn: amount,
          amountOut: amount,
          sharesBefore: portfolio.yesQty, // Using YES qty as proxy like logic typically implies or just logging?
          // Mint logs sharesBefore as existingPortfolio.yesQty. 
          // Let's stick to that convention.
          sharesAfter: newYesQty,
          feePaid: 0n,
          feeVault: 0n,
          feeLp: 0n,
          poolYesBefore: market.pool.yesQty,
          poolNoBefore: market.pool.noQty,
          poolYesAfter: market.pool.yesQty,
          poolNoAfter: market.pool.noQty,
          priceAtExecution: 0n,
        },
        tx
      );

      return {
        transactionId: ledgerEntry.id,
        amountOut: amount,
        newBalance,
      };
    });
  }
}
