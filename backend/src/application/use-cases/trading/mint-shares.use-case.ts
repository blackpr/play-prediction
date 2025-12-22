import { BusinessLogicError, NotFoundError } from '../../../domain/errors/domain-error';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';

export interface MintSharesRequest {
  userId: string;
  marketId: string;
  amount: bigint;
}

export interface MintSharesResponse {
  transactionId: string;
  yesOut: bigint;
  noOut: bigint;
  newBalance: bigint;
}

export class MintSharesUseCase {
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

  async execute(request: MintSharesRequest): Promise<MintSharesResponse> {
    const { userId, marketId, amount } = request;

    if (amount <= 0n) {
      throw new BusinessLogicError(
        'Amount must be positive',
        'INVALID_AMOUNT',
        { amount: amount.toString() }
      );
    }

    return await this.transactionManager.run(async (tx) => {
      // 1. Lock and validate user balance
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      if (user.balance < amount) {
        throw new BusinessLogicError(
          `Insufficient balance: required ${amount}, available ${user.balance}`,
          'INSUFFICIENT_BALANCE',
          { required: amount.toString(), available: user.balance.toString() }
        );
      }

      // 2. Lock market and validate state
      const market = await this.marketRepository.findByIdWithPool(marketId, tx);
      if (!market) {
        throw new NotFoundError('Market', marketId);
      }

      // 3. Deduct points from user
      const newBalance = user.balance - amount;
      await this.marketRepository.updateUserBalance(userId, newBalance, tx);

      // 4. Update or create portfolio (Add equal YES and NO shares)
      const existingPortfolio = await this.portfolioRepository.findByUserAndMarket(
        userId,
        marketId,
        tx
      );

      // MINTING: 1 Point -> 1 YES + 1 NO.
      // Split cost basis equally between YES and NO shares
      const yesCost = amount / 2n;
      const noCost = amount - yesCost; // Ensures sum is amount

      if (existingPortfolio) {
        await this.portfolioRepository.update(
          userId,
          marketId,
          {
            yesQty: existingPortfolio.yesQty + amount,
            noQty: existingPortfolio.noQty + amount,
            yesCostBasis: existingPortfolio.yesCostBasis + yesCost,
            noCostBasis: existingPortfolio.noCostBasis + noCost,
          },
          tx
        );
      } else {
        await this.portfolioRepository.create(
          {
            userId,
            marketId,
            yesQty: amount,
            noQty: amount,
            yesCostBasis: yesCost,
            noCostBasis: noCost,
          },
          tx
        );
      }

      // 5. Log to trade ledger
      const ledgerEntry = await this.tradeLedgerRepository.create(
        {
          userId,
          marketId,
          action: 'MINT',
          side: null,
          amountIn: amount,
          amountOut: amount,
          sharesBefore: existingPortfolio ? existingPortfolio.yesQty : 0n,
          sharesAfter: (existingPortfolio ? existingPortfolio.yesQty : 0n) + amount,
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
        yesOut: amount,
        noOut: amount,
        newBalance,
      };
    });
  }
}
