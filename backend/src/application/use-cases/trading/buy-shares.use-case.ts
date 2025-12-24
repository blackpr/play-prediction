import { BusinessLogicError, NotFoundError } from '../../../domain/errors/domain-error';
import { calculateBuyShares } from '../../../domain/services/cpmm-engine';
import { calculateNetAfterFee } from '../../../domain/services/fee-calculator';
import { MIN_TRADE_SIZE, type Side } from '../../../domain/services/constants';
import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { WebSocketManager } from '../../../infrastructure/websocket/websocket-manager';

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

      // 6. Deduct user balance (original amount, not aggregated)
      const newBalance = user.balance - amount;
      await this.marketRepository.updateUserBalance(userId, newBalance, tx);

      // 7. Update or create portfolio
      const existingPortfolio = await this.portfolioRepository.findByUserAndMarket(
        userId,
        marketId,
        tx
      );

      const sharesBefore = side === 'YES'
        ? (existingPortfolio?.yesQty ?? 0n)
        : (existingPortfolio?.noQty ?? 0n);

      // ============================================================================
      // NETTING PROTOCOL (MINT-4)
      // ============================================================================
      // If user holds opposite shares, execute fee-free netting sell first
      // This maintains Rule 2: No conflicting positions
      // See ENGINE_LOGIC.md Section 7 for details

      const oppositeSide: Side = side === 'YES' ? 'NO' : 'YES';
      const oppositeQty = oppositeSide === 'YES'
        ? (existingPortfolio?.yesQty ?? 0n)
        : (existingPortfolio?.noQty ?? 0n);

      let nettingProceeds = 0n;
      let poolStateAfterNetting = {
        yesQty: market.pool.yesQty,
        noQty: market.pool.noQty,
      };

      if (oppositeQty > 0n) {
        // Execute fee-free netting sell
        const { calculateSellPoints } = await import('../../../domain/services/cpmm-engine');

        const nettingSellResult = calculateSellPoints(
          oppositeQty,
          poolStateAfterNetting,
          oppositeSide
        );

        nettingProceeds = nettingSellResult.pointsOut;
        poolStateAfterNetting = {
          yesQty: nettingSellResult.newYesQty,
          noQty: nettingSellResult.newNoQty,
        };

        // Log NET_SELL to trade ledger (fee-free)
        await this.tradeLedgerRepository.create(
          {
            userId,
            marketId,
            action: 'NET_SELL',
            side: oppositeSide,
            amountIn: oppositeQty,
            amountOut: nettingProceeds,
            sharesBefore: oppositeQty,
            sharesAfter: 0n,
            feePaid: 0n, // Fee-free for netting!
            feeVault: 0n,
            feeLp: 0n,
            poolYesBefore,
            poolNoBefore,
            poolYesAfter: poolStateAfterNetting.yesQty,
            poolNoAfter: poolStateAfterNetting.noQty,
            priceAtExecution: oppositeQty > 0n
              ? (nettingProceeds * 1_000_000n) / oppositeQty
              : 0n,
          },
          tx
        );

        // Clear opposite position in portfolio
        if (existingPortfolio) {
          if (oppositeSide === 'YES') {
            await this.portfolioRepository.update(
              userId,
              marketId,
              {
                yesQty: 0n,
                yesCostBasis: 0n,
              },
              tx
            );
          } else {
            await this.portfolioRepository.update(
              userId,
              marketId,
              {
                noQty: 0n,
                noCostBasis: 0n,
              },
              tx
            );
          }
        }
      }

      // ============================================================================
      // END NETTING PROTOCOL
      // ============================================================================

      // Calculate fees on original amount (not aggregated amount)
      const { netAmount, fee, vaultFee, lpFee } = calculateNetAfterFee(amount);

      // Transfer vault fee to treasury
      const treasuryUser = await this.userRepository.findByRole('treasury');
      if (!treasuryUser) {
        throw new NotFoundError(
          'Treasury User',
          'No user with role "treasury" found. Treasury is required for fee collection.'
        );
      }
      await this.userRepository.updateBalance(
        treasuryUser.id,
        treasuryUser.balance + vaultFee,
        tx
      );

      // Calculate swap using CPMM engine with pool state after netting
      // Use aggregated capital: net amount + netting proceeds
      const totalBuyingPower = netAmount + nettingProceeds;

      const swapResult = calculateBuyShares(totalBuyingPower, poolStateAfterNetting, side);

      // Verify slippage protection
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

      // Inject LP fee into pool
      let finalYesQty = swapResult.newYesQty;
      let finalNoQty = swapResult.newNoQty;

      if (side === 'YES') {
        finalNoQty += lpFee; // LP fee goes to input pool (NO side for YES buy)
      } else {
        finalYesQty += lpFee; // LP fee goes to input pool (YES side for NO buy)
      }

      // Update pool with optimistic lock
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

      // Calculate sharesAfter for the desired side
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

    // Broadcast price update (outside transaction)
    const volume24h = await this.marketRepository.getVolume24h(marketId);

    await this.webSocketManager.broadcast(`market:${marketId}`, {
      type: 'price_update',
      channel: `market:${marketId}`,
      data: {
        marketId,
        yesPrice: (Number(request.amount) / Number(result.sharesOut)).toFixed(4), // Approximate price
        yesQty: result.poolYesAfter.toString(),
        noQty: result.poolNoAfter.toString(),
        lastTradePrice: result.avgExecutionPrice,
        lastTradeSide: side,
        lastTradeSize: result.sharesOut.toString(),
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
        shares: result.sharesOut.toString(),
        price: result.avgExecutionPrice,
        timestamp: new Date().toISOString(),
      },
    });

    return result;
  }
}
