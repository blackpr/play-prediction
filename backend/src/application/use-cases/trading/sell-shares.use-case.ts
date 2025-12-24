import { BusinessLogicError, NotFoundError } from '../../../domain/errors/domain-error';
import { calculateSellPoints } from '../../../domain/services/cpmm-engine';
import { calculateNetPayout } from '../../../domain/services/fee-calculator';
import { type Side } from '../../../domain/services/constants';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { WebSocketManager } from '../../../infrastructure/websocket/websocket-manager';

export interface SellSharesRequest {
  userId: string;
  marketId: string;
  side: Side;
  shares: bigint;
  minAmountOut: bigint;
  idempotencyKey?: string;
}

export interface SellSharesResponse {
  transactionId: string;
  amountOut: bigint;
  feePaid: bigint;
  feeVault: bigint;
  feeLp: bigint;
  newBalance: bigint;
  poolYesAfter: bigint;
  poolNoAfter: bigint;
  avgExecutionPrice: string;
}

export class SellSharesUseCase {
  private readonly marketRepository: MarketRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly tradeLedgerRepository: TradeLedgerRepository;
  private readonly userRepository: UserRepository;
  private readonly transactionManager: TransactionManager;
  private readonly webSocketManager: WebSocketManager;

  constructor({
    marketRepository,
    portfolioRepository,
    tradeLedgerRepository,
    userRepository,
    transactionManager,
    webSocketManager,
  }: {
    marketRepository: MarketRepository;
    portfolioRepository: PortfolioRepository;
    tradeLedgerRepository: TradeLedgerRepository;
    userRepository: UserRepository;
    transactionManager: TransactionManager;
    webSocketManager: WebSocketManager;
  }) {
    this.marketRepository = marketRepository;
    this.portfolioRepository = portfolioRepository;
    this.tradeLedgerRepository = tradeLedgerRepository;
    this.userRepository = userRepository;
    this.transactionManager = transactionManager;
    this.webSocketManager = webSocketManager;
  }

  async execute(request: SellSharesRequest): Promise<SellSharesResponse> {
    const { userId, marketId, side, shares, minAmountOut, idempotencyKey } = request;

    // Validate shares is positive
    if (shares <= 0n) {
      throw new BusinessLogicError(
        'Shares must be positive',
        'INVALID_SHARES',
        { provided: shares.toString() }
      );
    }

    const result = await this.transactionManager.run(async (tx) => {
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

      // 2. Check user has sufficient shares
      const portfolio = await this.portfolioRepository.findByUserAndMarket(
        userId,
        marketId,
        tx
      );

      const currentShares = side === 'YES'
        ? (portfolio?.yesQty ?? 0n)
        : (portfolio?.noQty ?? 0n);

      if (currentShares < shares) {
        throw new BusinessLogicError(
          `Insufficient shares: have ${currentShares}, need ${shares}`,
          'INSUFFICIENT_SHARES',
          { required: shares.toString(), available: currentShares.toString() }
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

      const poolYesBefore = market.pool.yesQty;
      const poolNoBefore = market.pool.noQty;
      const versionBefore = market.pool.versionId;

      // 5. Calculate swap using CPMM engine (gross payout)
      const sellResult = calculateSellPoints(shares, {
        yesQty: market.pool.yesQty,
        noQty: market.pool.noQty,
      }, side);

      // 6. Apply fees to output
      const { netPayout, fee, vaultFee, lpFee } = calculateNetPayout(sellResult.pointsOut);

      // 7. Verify slippage protection
      if (netPayout < minAmountOut) {
        throw new BusinessLogicError(
          `Slippage exceeded: expected minimum ${minAmountOut}, got ${netPayout}`,
          'SLIPPAGE_EXCEEDED',
          {
            expected: minAmountOut.toString(),
            actual: netPayout.toString(),
          }
        );
      }

      // 8. Inject LP fee back into pool
      let finalYesQty = sellResult.newYesQty;
      let finalNoQty = sellResult.newNoQty;

      if (side === 'YES') {
        finalNoQty += lpFee; // LP fee stays in output pool (NO side for YES sell)
      } else {
        finalYesQty += lpFee; // LP fee stays in output pool (YES side for NO sell)
      }

      // 9. Update pool with optimistic lock
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

      // 10. Credit user balance
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const newBalance = user.balance + netPayout;
      await this.marketRepository.updateUserBalance(userId, newBalance, tx);

      // 11. Update portfolio with proportional cost basis reduction
      const sharesBefore = currentShares;
      const sharesAfter = currentShares - shares;

      const currentBasis = side === 'YES'
        ? (portfolio?.yesCostBasis ?? 0n)
        : (portfolio?.noCostBasis ?? 0n);

      // Reduce basis proportionally: newBasis = oldBasis × (1 - sharesSold/totalShares)
      // basisReduction = (currentBasis × shares) / sharesBefore
      const basisReduction = sharesBefore > 0n
        ? (currentBasis * shares) / sharesBefore
        : 0n;
      const newBasis = currentBasis - basisReduction;

      if (portfolio) {
        if (side === 'YES') {
          await this.portfolioRepository.update(
            userId,
            marketId,
            {
              yesQty: sharesAfter,
              yesCostBasis: newBasis,
            },
            tx
          );
        } else {
          await this.portfolioRepository.update(
            userId,
            marketId,
            {
              noQty: sharesAfter,
              noCostBasis: newBasis,
            },
            tx
          );
        }
      }

      // 12. Log to trade ledger
      const priceAtExecution = shares > 0n
        ? (netPayout * 1_000_000n) / shares
        : 0n;

      const ledgerEntry = await this.tradeLedgerRepository.create(
        {
          userId,
          marketId,
          action: 'SELL',
          side,
          amountIn: shares,
          amountOut: netPayout,
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

      // 13. Calculate average execution price
      const avgExecutionPrice = shares > 0n
        ? (Number(netPayout) / Number(shares) / 1_000_000).toFixed(6)
        : '0.000000';

      return {
        transactionId: ledgerEntry.id,
        amountOut: netPayout,
        feePaid: fee,
        feeVault: vaultFee,
        feeLp: lpFee,
        newBalance,
        poolYesAfter: finalYesQty,
        poolNoAfter: finalNoQty,
        avgExecutionPrice,
      };
    });

    // Broadcast price update (outside transaction)
    const volume24h = await this.marketRepository.getVolume24h(marketId);

    await this.webSocketManager.broadcast(`market:${marketId}`, {
      type: 'price_update',
      channel: `market:${marketId}`,
      data: {
        marketId,
        yesQty: result.poolYesAfter.toString(),
        noQty: result.poolNoAfter.toString(),
        lastTradePrice: result.avgExecutionPrice,
        lastTradeSide: side,
        lastTradeSize: shares.toString(),
        volume24h,
      },
      timestamp: new Date().toISOString(),
    });

    // Broadcast anonymized trade event for live feed
    await this.webSocketManager.broadcast(`market:${marketId}`, {
      type: 'trade',
      channel: `market:${marketId}`,
      data: {
        marketId,
        side,
        shares: shares.toString(),
        price: result.avgExecutionPrice,
        timestamp: new Date().toISOString(),
      },
    });

    return result;
  }
}
