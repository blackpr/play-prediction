import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { MarketStatus, Resolution, TradeAction } from '../../../infrastructure/database/drizzle/schema';
import { WebSocketManager } from '../../../infrastructure/websocket/websocket-manager';

export interface ResolveMarketParams {
  marketId: string;
  resolution: 'YES' | 'NO';
  evidence?: string;
  eventEndedAt?: Date;
  adminId: string;
}

export interface VoidedTradesInfo {
  count: number;
  totalRefunded: string;
  affectedUsers: number;
}

export interface ResolveMarketResult {
  id: string;
  resolution: string;
  totalWinners: number;
  totalPayout: string;
  voidedTrades: VoidedTradesInfo;
}

export class ResolveMarketUseCase {
  constructor(
    private readonly deps: {
      marketRepository: MarketRepository;
      portfolioRepository: PortfolioRepository;
      userRepository: UserRepository;
      tradeLedgerRepository: TradeLedgerRepository;
      auditLogRepository: AuditLogRepository;
      transactionManager: TransactionManager;
      webSocketManager: WebSocketManager;
    }
  ) { }

  async execute(params: ResolveMarketParams): Promise<ResolveMarketResult> {
    const { marketId, resolution, evidence, eventEndedAt, adminId } = params;

    // Store market title for WebSocket broadcasts
    const market = await this.deps.marketRepository.findById(marketId);
    if (!market) {
      throw new NotFoundError('Market', `Market with ID ${marketId} not found`);
    }
    const marketTitle = market.title;

    const result = await this.deps.transactionManager.run(async (tx) => {
      // 1. Validate market status - can only resolve ACTIVE or PAUSED markets
      if (market.status !== MarketStatus.ACTIVE && market.status !== MarketStatus.PAUSED) {
        throw new ValidationError(
          `Cannot resolve market. Market must be in ACTIVE or PAUSED status. Current status: ${market.status}`,
          { currentStatus: market.status, allowedStatuses: [MarketStatus.ACTIVE, MarketStatus.PAUSED] }
        );
      }

      // 2. Validate resolution value
      if (resolution !== Resolution.YES && resolution !== Resolution.NO) {
        throw new ValidationError(
          `Invalid resolution value. Must be YES or NO. Received: ${resolution}`,
          { resolution }
        );
      }

      // 3. Void post-event trades if eventEndedAt is provided
      let voidedTradesCount = 0;
      let totalRefunded = 0n;
      const affectedUserIds = new Set<string>();

      if (eventEndedAt) {
        // Find all BUY and SELL trades placed after the event ended
        const allTrades = await this.deps.tradeLedgerRepository.findAll({
          marketId,
          page: 1,
          pageSize: 10000, // Get all trades for this market
        });

        const postEventTrades = allTrades.items.filter(
          (trade) =>
            (trade.action === TradeAction.BUY || trade.action === TradeAction.SELL) &&
            trade.createdAt > eventEndedAt
        );

        // Void each post-event trade
        for (const trade of postEventTrades) {
          await this.voidTrade(trade, 'VOIDED_POST_EVENT', tx);
          voidedTradesCount++;
          totalRefunded += trade.amountIn;
          affectedUserIds.add(trade.userId);
        }
      }

      // 4. Update market status to RESOLVED
      await this.deps.marketRepository.updateStatus(marketId, MarketStatus.RESOLVED, tx);

      // 5. Get all portfolios for this market
      const portfolios = await this.deps.portfolioRepository.findByMarket(marketId, tx);

      let totalWinners = 0;
      let totalPayout = 0n;

      // 6. Process each portfolio holder
      for (const portfolio of portfolios) {
        const winningShares = resolution === Resolution.YES ? portfolio.yesQty : portfolio.noQty;

        if (winningShares > 0n) {
          totalWinners++;

          // Payout = 1 Point per winning share (1:1 ratio)
          const payout = winningShares;
          totalPayout += payout;

          // Get current user balance
          const user = await this.deps.userRepository.findById(portfolio.userId);
          if (!user) {
            throw new NotFoundError('User', `User with ID ${portfolio.userId} not found`);
          }

          // Credit user balance
          const newBalance = user.balance + payout;
          await this.deps.userRepository.updateBalance(portfolio.userId, newBalance, tx);

          // Log payout to trade ledger
          await this.deps.tradeLedgerRepository.create(
            {
              userId: portfolio.userId,
              marketId,
              action: TradeAction.RESOLUTION_PAYOUT,
              side: resolution,
              amountIn: winningShares,
              amountOut: payout,
              feePaid: 0n,
              feeVault: 0n,
              feeLp: 0n,
            },
            tx
          );
        }

        // 7. Clear portfolio (set all shares and cost basis to 0)
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

      // 8. Pool clearing handled by database constraints on market resolution

      // 9. Create Audit Log
      await this.deps.auditLogRepository.create({
        adminId,
        action: 'MARKET_RESOLVED',
        entityType: 'MARKET',
        entityId: marketId,
        details: JSON.stringify({ resolution, evidence, eventEndedAt, voidedTrades: voidedTradesCount }),
      }, tx);

      return {
        id: marketId,
        resolution,
        totalWinners,
        totalPayout: totalPayout.toString(),
        voidedTrades: {
          count: voidedTradesCount,
          totalRefunded: totalRefunded.toString(),
          affectedUsers: affectedUserIds.size,
        },
        portfolios, // Return portfolios for WebSocket broadcasts
      };
    });

    // Broadcast WebSocket messages (outside transaction)
    // 1. Broadcast market_resolved to all market subscribers
    this.deps.webSocketManager.broadcast(`market:${marketId}`, {
      type: 'market_resolved',
      channel: `market:${marketId}`,
      data: {
        marketId,
        resolution,
        resolvedAt: new Date().toISOString(),
      },
    });

    // 2. Send resolution_payout to each user who received a payout
    for (const portfolio of result.portfolios) {
      const winningShares = resolution === Resolution.YES ? portfolio.yesQty : portfolio.noQty;

      if (winningShares > 0n) {
        const payout = winningShares;

        // Get updated user balance
        const user = await this.deps.userRepository.findById(portfolio.userId);

        this.deps.webSocketManager.sendToUser(portfolio.userId, {
          type: 'resolution_payout',
          channel: `user:${portfolio.userId}`,
          data: {
            marketId,
            marketTitle: market.title,
            resolution,
            winningShares: winningShares.toString(),
            payout: payout.toString(),
            newBalance: user?.balance.toString() || '0',
          },
        });
      }
    }

    // Return result without portfolios (clean up internal data)

    // WebSocket broadcasts (outside transaction)
    // 1. Broadcast market_resolved to all market subscribers
    this.deps.webSocketManager.broadcast(`market:${marketId}`, {
      type: 'market_resolved',
      channel: `market:${marketId}`,
      data: {
        marketId,
        resolution,
        resolvedAt: new Date().toISOString(),
      },
    });

    // 2. Send resolution_payout to each user who received a payout
    for (const portfolio of result.portfolios) {
      const winningShares = resolution === Resolution.YES ? portfolio.yesQty : portfolio.noQty;
      
      if (winningShares > 0n) {
        const payout = winningShares;
        
        // Get updated user balance
        const user = await this.deps.userRepository.findById(portfolio.userId);
        
        this.deps.webSocketManager.sendToUser(portfolio.userId, {
          type: 'resolution_payout',
          channel: `user:${portfolio.userId}`,
          data: {
            marketId,
            marketTitle,
            resolution,
            winningShares: winningShares.toString(),
            payout: payout.toString(),
            newBalance: user?.balance.toString() || '0',
          },
        });
      }
    }

    const { portfolios: _, ...cleanResult } = result;
    return cleanResult;
}

  /**
   * Void a trade and refund the user
   */
  private async voidTrade(
  trade: {
  id: string;
  userId: string;
  marketId: string;
  action: string;
  side: string | null;
  amountIn: bigint;
  amountOut: bigint;
  sharesBefore: bigint | null;
  sharesAfter: bigint | null;
},
  reason: string,
  tx: import('../../ports/transaction-manager.port').Transaction
): Promise < void> {
  // 1. Reverse portfolio changes
  if(trade.action === TradeAction.BUY) {
  // For BUY: user paid amountIn, received amountOut shares
  // Reverse: remove shares, refund amountIn
  const portfolio = await this.deps.portfolioRepository.findByUserAndMarket(
    trade.userId,
    trade.marketId,
    tx
  );

  if (portfolio) {
    const sharesToRemove = trade.amountOut;
    const costBasisToRemove = trade.amountIn;

    if (trade.side === 'YES') {
      await this.deps.portfolioRepository.update(
        trade.userId,
        trade.marketId,
        {
          yesQty: portfolio.yesQty - sharesToRemove,
          yesCostBasis: portfolio.yesCostBasis - costBasisToRemove,
        },
        tx
      );
    } else {
      await this.deps.portfolioRepository.update(
        trade.userId,
        trade.marketId,
        {
          noQty: portfolio.noQty - sharesToRemove,
          noCostBasis: portfolio.noCostBasis - costBasisToRemove,
        },
        tx
      );
    }
  }

  // Refund points to user
  const user = await this.deps.userRepository.findById(trade.userId);
  if (user) {
    await this.deps.userRepository.updateBalance(trade.userId, user.balance + trade.amountIn, tx);
  }
} else if (trade.action === TradeAction.SELL) {
  // For SELL: user sold amountIn shares, received amountOut points
  // Reverse: add shares back, deduct amountOut points
  const portfolio = await this.deps.portfolioRepository.findByUserAndMarket(
    trade.userId,
    trade.marketId,
    tx
  );

  if (portfolio) {
    const sharesToAdd = trade.amountIn;

    if (trade.side === 'YES') {
      await this.deps.portfolioRepository.update(
        trade.userId,
        trade.marketId,
        {
          yesQty: portfolio.yesQty + sharesToAdd,
        },
        tx
      );
    } else {
      await this.deps.portfolioRepository.update(
        trade.userId,
        trade.marketId,
        {
          noQty: portfolio.noQty + sharesToAdd,
        },
        tx
      );
    }
  }

  // Deduct points from user
  const user = await this.deps.userRepository.findById(trade.userId);
  if (user) {
    await this.deps.userRepository.updateBalance(trade.userId, user.balance - trade.amountOut, tx);
  }
}

// 2. Log the VOID action to trade ledger
await this.deps.tradeLedgerRepository.create(
  {
    userId: trade.userId,
    marketId: trade.marketId,
    action: TradeAction.VOID,
    side: trade.side,
    amountIn: trade.amountOut, // Reverse: what they got
    amountOut: trade.amountIn, // Reverse: what they paid (refund)
    sharesBefore: trade.sharesAfter,
    sharesAfter: trade.sharesBefore,
    feePaid: 0n,
    feeVault: 0n,
    feeLp: 0n,
    originalTradeId: trade.id,
    voidReason: reason,
  },
  tx
);
  }
}
