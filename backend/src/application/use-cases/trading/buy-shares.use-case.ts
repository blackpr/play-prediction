import { BusinessLogicError, NotFoundError } from '../../../domain/errors/domain-error';
import { calculateBuyShares } from '../../../domain/services/cpmm-engine';
import { calculateNetAfterFee } from '../../../domain/services/fee-calculator';
import { MIN_TRADE_SIZE, type Side } from '../../../domain/services/constants';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';

export interface BuySharesRequest {
  userId: string;
  marketId: string;
  side: Side;
  amount: bigint;
  minSharesOut: bigint;
  idempotencyKey?: string;
}

export interface BuySharesResponse {
  transactionId: string;
  sharesOut: bigint;
  feePaid: bigint;
  feeVault: bigint;
  feeLp: bigint;
  newBalance: bigint;
  poolYesAfter: bigint;
  poolNoAfter: bigint;
  avgExecutionPrice: string;
}

export class BuySharesUseCase {
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

  async execute(request: BuySharesRequest): Promise<BuySharesResponse> {
    const { userId, marketId, side, amount, minSharesOut, idempotencyKey } = request;

    // Validate minimum trade size
    if (amount < MIN_TRADE_SIZE) {
      throw new BusinessLogicError(
        `Trade amount must be at least ${MIN_TRADE_SIZE} MicroPoints ($0.001)`,
        'MINIMUM_TRADE_SIZE',
        { required: MIN_TRADE_SIZE.toString(), provided: amount.toString() }
      );
    }

    return await this.transactionManager.run(async (tx) => {
      // 1. Check idempotency key
      if (idempotencyKey) {
        const existingTrade = await this.tradeLedgerRepository.findByIdempotencyKey(
          idempotencyKey,
          tx
        );
        if (existingTrade) {
          throw new BusinessLogicError(
            'Duplicate idempotency key',
            'IDEMPOTENCY_CONFLICT',
            { idempotencyKey }
          );
        }
      }

      // 2. Lock and validate user balance
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

      // 3. Lock market and pool with optimistic locking
      const market = await this.marketRepository.findByIdWithPool(marketId, tx);
      if (!market) {
        throw new NotFoundError('Market', marketId);
      }

      // 4. Validate market status
      if (market.status !== 'ACTIVE') {
        throw new BusinessLogicError(
          `Market is not active: ${market.status}`,
          'MARKET_NOT_ACTIVE',
          { status: market.status }
        );
      }

      // 5. Check market closesAt
      if (market.closesAt && market.closesAt < new Date()) {
        throw new BusinessLogicError(
          'Market has closed for trading',
          'MARKET_CLOSED',
          { closesAt: market.closesAt.toISOString() }
        );
      }

      const poolYesBefore = market.pool.yesQty;
      const poolNoBefore = market.pool.noQty;
      const versionBefore = market.pool.versionId;

      // 6. Calculate fees
      const { netAmount, fee, vaultFee, lpFee } = calculateNetAfterFee(amount);

      // 7. Calculate swap using CPMM engine
      const swapResult = calculateBuyShares(netAmount, {
        yesQty: market.pool.yesQty,
        noQty: market.pool.noQty,
      }, side);

      // 8. Verify slippage protection
      if (swapResult.sharesOut < minSharesOut) {
        throw new BusinessLogicError(
          `Slippage exceeded: expected minimum ${minSharesOut}, got ${swapResult.sharesOut}`,
          'SLIPPAGE_EXCEEDED',
          {
            expected: minSharesOut.toString(),
            actual: swapResult.sharesOut.toString(),
          }
        );
      }

      // 9. Inject LP fee into pool
      let finalYesQty = swapResult.newYesQty;
      let finalNoQty = swapResult.newNoQty;

      if (side === 'YES') {
        finalNoQty += lpFee; // LP fee goes to input pool (NO side for YES buy)
      } else {
        finalYesQty += lpFee; // LP fee goes to input pool (YES side for NO buy)
      }

      // 10. Update pool with optimistic lock
      const updateResult = await this.marketRepository.updatePoolWithLock(
        marketId,
        finalYesQty,
        finalNoQty,
        versionBefore,
        tx
      );

      if (!updateResult.success) {
        throw new BusinessLogicError(
          'Pool was modified by another transaction. Please retry.',
          'OPTIMISTIC_LOCK_FAIL',
          { marketId, expectedVersion: versionBefore }
        );
      }

      // 11. Deduct user balance
      const newBalance = user.balance - amount;
      await this.marketRepository.updateUserBalance(userId, newBalance, tx);

      // 12. Update or create portfolio
      const existingPortfolio = await this.portfolioRepository.findByUserAndMarket(
        userId,
        marketId,
        tx
      );

      const sharesBefore = side === 'YES'
        ? (existingPortfolio?.yesQty ?? 0n)
        : (existingPortfolio?.noQty ?? 0n);
      const sharesAfter = sharesBefore + swapResult.sharesOut;

      if (existingPortfolio) {
        // Update existing position
        if (side === 'YES') {
          await this.portfolioRepository.update(
            userId,
            marketId,
            {
              yesQty: existingPortfolio.yesQty + swapResult.sharesOut,
              yesCostBasis: existingPortfolio.yesCostBasis + netAmount,
            },
            tx
          );
        } else {
          await this.portfolioRepository.update(
            userId,
            marketId,
            {
              noQty: existingPortfolio.noQty + swapResult.sharesOut,
              noCostBasis: existingPortfolio.noCostBasis + netAmount,
            },
            tx
          );
        }
      } else {
        // Create new portfolio entry
        await this.portfolioRepository.create(
          {
            userId,
            marketId,
            yesQty: side === 'YES' ? swapResult.sharesOut : 0n,
            noQty: side === 'NO' ? swapResult.sharesOut : 0n,
            yesCostBasis: side === 'YES' ? netAmount : 0n,
            noCostBasis: side === 'NO' ? netAmount : 0n,
          },
          tx
        );
      }

      // 13. Log to trade ledger
      const priceAtExecution = (amount * 1_000_000n) / swapResult.sharesOut;

      const ledgerEntry = await this.tradeLedgerRepository.create(
        {
          userId,
          marketId,
          action: 'BUY',
          side,
          amountIn: amount,
          amountOut: swapResult.sharesOut,
          sharesBefore,
          sharesAfter,
          feePaid: fee,
          feeVault: vaultFee,
          feeLp: lpFee,
          poolYesBefore,
          poolNoBefore,
          poolYesAfter: finalYesQty,
          poolNoAfter: finalNoQty,
          priceAtExecution,
          idempotencyKey,
        },
        tx
      );

      // 14. Calculate average execution price
      const avgExecutionPrice = (Number(amount) / Number(swapResult.sharesOut) / 1_000_000).toFixed(6);

      return {
        transactionId: ledgerEntry.id,
        sharesOut: swapResult.sharesOut,
        feePaid: fee,
        feeVault: vaultFee,
        feeLp: lpFee,
        newBalance,
        poolYesAfter: finalYesQty,
        poolNoAfter: finalNoQty,
        avgExecutionPrice,
      };
    });
  }
}
