import { MarketRepository } from '../../ports/repositories/market.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';
import { CategoryRepository } from '../../ports/repositories/category.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../../domain/errors/domain-error';
import { MarketStatus, NewLiquidityPool, CloseBehavior, TradeAction } from '../../../infrastructure/database/drizzle/schema';

const MIN_TITLE_LENGTH = 10;
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_CATEGORY_LENGTH = 100;
const MAX_IMAGE_URL_LENGTH = 2048;
const MIN_SEED_LIQUIDITY = 1_000_000n; // 1 Point

// Removed hardcoded CATEGORY_DEFAULTS

export interface UpdateMarketParams {
  marketId: string;
  adminId: string;
  title?: string;
  description?: string;
  categoryId?: string;
  imageUrl?: string;
  closesAt?: Date;
  activatesAt?: Date | null;
  seedLiquidity?: bigint;
  initialYesPrice?: number;
  closeBehavior?: string;
  bufferMinutes?: number | null;
}

export interface UpdateMarketResult {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  status: string;
  closesAt: Date | null;
  closeBehavior: string;
  bufferMinutes: number | null;
  pool: {
    yesQty: string;
    noQty: string;
    k: string;
  };
  updatedAt: Date;
}

export class UpdateMarketUseCase {
  constructor(
    private readonly deps: {
      userRepository: UserRepository;
      marketRepository: MarketRepository;
      portfolioRepository: PortfolioRepository;
      tradeLedgerRepository: TradeLedgerRepository;
      categoryRepository: CategoryRepository;
      auditLogRepository: AuditLogRepository;
      transactionManager: TransactionManager;
    }
  ) { }

  async execute(params: UpdateMarketParams): Promise<UpdateMarketResult> {
    // Validate admin exists
    const admin = await this.deps.userRepository.findById(params.adminId);
    if (!admin) {
      throw new NotFoundError('User', params.adminId);
    }

    return this.deps.transactionManager.run(async (tx) => {
      // Get market with pool details
      const market = await this.deps.marketRepository.findById(params.marketId);
      if (!market) {
        throw new NotFoundError('Market', params.marketId);
      }

      if (market.status !== MarketStatus.DRAFT) {
        throw new BusinessLogicError(
          'Only markets in DRAFT status can be updated.',
          'INVALID_MARKET_STATUS',
          { status: market.status }
        );
      }

      // 0. Resolve Category & Defaults
      let category = null;
      if (params.categoryId) {
        category = await this.deps.categoryRepository.findById(params.categoryId);
        if (!category) throw new NotFoundError('Category', params.categoryId);
      } else if (market.categoryId) {
        category = await this.deps.categoryRepository.findById(market.categoryId);
      }

      const effectiveBehavior = params.closeBehavior || (params.categoryId ? category?.defaultCloseBehavior : market.closeBehavior);
      const effectiveBuffer = params.bufferMinutes !== undefined
        ? params.bufferMinutes
        : (params.categoryId && effectiveBehavior === category?.defaultCloseBehavior ? category?.defaultBufferMinutes : market.bufferMinutes) as number | null;

      // Validate inputs with context
      this.validateInputs(params, effectiveBehavior as string, effectiveBuffer);

      // 1. Handle Pool Reset (if seedLiquidity or initialYesPrice provided)
      let needsPoolReset = false;
      let newYesQty: bigint | null = null;
      let newNoQty: bigint | null = null;
      let newSeedLiquidity: bigint = params.seedLiquidity ?? 0n;

      if (params.seedLiquidity !== undefined || params.initialYesPrice !== undefined) {
        needsPoolReset = true;

        // Safety Check: Verify only GENESIS_MINT exists
        const tradeCount = await this.deps.tradeLedgerRepository.countByMarket(params.marketId, tx);
        // We expect at most 1 trade (GENESIS_MINT). If > 1, real trading happened.
        // Even if only 1 exists, we should verify it is GENESIS_MINT to be safe? 
        // Logic: DRAFT markets *should* only have GENESIS_MINT. If someone manually inserted trades, count > 1.
        // If count is 0 (maybe possible in very old drafts?), also fine to reset.
        if (tradeCount > 1) {
          throw new BusinessLogicError(
            'Cannot update pool parameters. Market has existing trades beyond Genesis.',
            'MARKET_HAS_TRADES',
            { tradeCount }
          );
        }

        // Calculate new pool quantities
        // If seedLiquidity not provided, derive from existing pool or throw
        if (params.seedLiquidity === undefined) {
          // Try to infer current seed liquidity from market pool
          if (!market.pool) throw new Error('Existing pool data missing');
          const currentYes = BigInt(market.pool.yesQty);
          const currentNo = BigInt(market.pool.noQty);
          newSeedLiquidity = (currentYes + currentNo) / 2n;
        } else {
          newSeedLiquidity = params.seedLiquidity;
        }

        // If initialYesPrice not provided, infer from current or default to 0.5
        let price = params.initialYesPrice;
        if (price === undefined) {
          if (market.pool) {
            const currentYes = BigInt(market.pool.yesQty);
            const currentNo = BigInt(market.pool.noQty);
            const total = currentYes + currentNo;
            if (total > 0n) {
              // Price = NoQty / Total
              price = Number(currentNo) / Number(total);
            } else {
              price = 0.5;
            }
          } else {
            price = 0.5;
          }
        }

        // Calculate Qty
        const totalTokens = newSeedLiquidity * 2n;
        const priceBp = BigInt(Math.floor(price * 10000));
        newNoQty = (totalTokens * priceBp) / 10000n;
        newYesQty = totalTokens - newNoQty;
      }

      // 2. Perform Pool Reset if needed
      if (needsPoolReset && newYesQty && newNoQty) {
        // Delete existing pool
        await this.deps.marketRepository.deletePool(params.marketId, tx);

        // Delete treasury portfolio
        const treasuryUser = await this.deps.userRepository.findByRole('treasury');
        if (!treasuryUser) throw new Error('Treasury user not found');
        await this.deps.portfolioRepository.deleteByUserAndMarket(treasuryUser.id, params.marketId, tx);

        // Delete old GENESIS_MINT ledger entry
        await this.deps.tradeLedgerRepository.deleteByMarketAndAction(params.marketId, TradeAction.GENESIS_MINT, tx);

        // Create new Liquidity Pool
        const poolData: NewLiquidityPool = {
          id: params.marketId,
          yesQty: newYesQty,
          noQty: newNoQty,
          versionId: 1,
        };
        await this.deps.marketRepository.createPool(poolData, tx);

        // Grant seed shares to treasury
        const totalQty = newYesQty + newNoQty;
        const yesCostBasis = (newSeedLiquidity * newYesQty) / totalQty;
        const noCostBasis = newSeedLiquidity - yesCostBasis;

        const portfolioData = {
          userId: treasuryUser.id,
          marketId: params.marketId,
          yesQty: newYesQty,
          noQty: newNoQty,
          yesCostBasis,
          noCostBasis,
        };
        await this.deps.portfolioRepository.create(portfolioData, tx);

        // Log new GENESIS_MINT
        const ledgerData = {
          userId: treasuryUser.id,
          marketId: params.marketId,
          action: TradeAction.GENESIS_MINT,
          side: null,
          amountIn: newSeedLiquidity,
          amountOut: newSeedLiquidity,
          feePaid: 0n,
          feeVault: 0n,
          feeLp: 0n,
        };
        await this.deps.tradeLedgerRepository.create(ledgerData, tx);
      }

      // 3. Update Market Attributes
      const updates: {
        title?: string;
        description?: string;
        category?: string;
        categoryId?: string;
        imageUrl?: string;
        closesAt?: Date;
        closeBehavior?: string;
        bufferMinutes?: number | null;
      } = {};

      if (params.title !== undefined) updates.title = params.title;
      if (params.description !== undefined) updates.description = params.description;
      if (params.categoryId !== undefined) {
        updates.categoryId = params.categoryId;
        if (category) updates.category = category.name;
      }
      if (params.imageUrl !== undefined) updates.imageUrl = params.imageUrl;
      if (params.closesAt !== undefined) updates.closesAt = params.closesAt;

      updates.closeBehavior = effectiveBehavior as string;
      updates.bufferMinutes = effectiveBuffer;

      // Update market
      const updatedMarket = await this.deps.marketRepository.update(
        params.marketId,
        updates,
        tx
      );

      // Create Audit Log
      await this.deps.auditLogRepository.create({
        adminId: params.adminId,
        action: 'MARKET_UPDATED',
        entityType: 'MARKET',
        entityId: params.marketId,
        details: JSON.stringify({ updates, poolReset: needsPoolReset }),
      }, tx);

      // Re-fetch pool to ensure we return latest state (or Construct it from memory if we just reset it)
      // Since we just did createPool, finding details again is safest to get versionId etc.
      const freshMarket = await this.deps.marketRepository.findById(params.marketId);

      if (!freshMarket || !freshMarket.pool) {
        throw new Error('Failed to retrieve updated market pool data');
      }

      return {
        id: updatedMarket.id,
        title: updatedMarket.title,
        description: updatedMarket.description,
        category: updatedMarket.category,
        imageUrl: updatedMarket.imageUrl,
        status: updatedMarket.status,
        closesAt: updatedMarket.closesAt,
        activatesAt: updatedMarket.activatesAt,
        closeBehavior: updatedMarket.closeBehavior,
        bufferMinutes: updatedMarket.bufferMinutes,
        pool: {
          yesQty: freshMarket.pool.yesQty.toString(),
          noQty: freshMarket.pool.noQty.toString(),
          k: freshMarket.pool.k.toString(),
        },
        updatedAt: updatedMarket.updatedAt,
      };
    });
  }

  private validateInputs(params: UpdateMarketParams, effectiveBehavior: string, effectiveBuffer: number | null): void {
    const errors: string[] = [];

    // Validate title if provided
    if (params.title !== undefined) {
      if (params.title.length < MIN_TITLE_LENGTH) {
        errors.push(`Title must be at least ${MIN_TITLE_LENGTH} characters`);
      }
      if (params.title.length > MAX_TITLE_LENGTH) {
        errors.push(`Title must not exceed ${MAX_TITLE_LENGTH} characters`);
      }
    }

    // Validate description if provided
    if (params.description !== undefined && params.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`);
    }

    // Validate imageUrl if provided
    if (params.imageUrl !== undefined) {
      if (params.imageUrl.length > MAX_IMAGE_URL_LENGTH) {
        errors.push(`Image URL must not exceed ${MAX_IMAGE_URL_LENGTH} characters`);
      }
      try {
        new URL(params.imageUrl);
      } catch {
        errors.push('Image URL must be a valid URL');
      }
    }

    // Validate closesAt if provided
    if (params.closesAt !== undefined) {
      const now = new Date();
      if (params.closesAt <= now) {
        errors.push('Market close time must be in the future');
      }
    }

    // Validate activatesAt
    if (params.activatesAt) {
      const now = new Date();
      if (params.activatesAt <= now) {
        errors.push('Market activation time must be in the future');
      }

      // We need effectiveClosesAt to strict validation, but it might not be available here if not fetching again
      // Simplified check: if both provided
      if (params.closesAt && params.activatesAt >= params.closesAt) {
        errors.push('Market activation time must be before close time');
      }
    }

    // Validate seedLiquidity
    if (params.seedLiquidity !== undefined) {
      if (params.seedLiquidity < MIN_SEED_LIQUIDITY) {
        errors.push(`Seed liquidity must be at least ${MIN_SEED_LIQUIDITY} MicroPoints`);
      }
    }

    // Validate initialYesPrice
    if (params.initialYesPrice !== undefined) {
      if (params.initialYesPrice < 0.01 || params.initialYesPrice > 0.99) {
        errors.push('initialYesPrice must be between 0.01 and 0.99');
      }
    }

    // Validate closeBehavior
    if (params.closeBehavior) {
      const validBehaviors = [CloseBehavior.AUTO, CloseBehavior.MANUAL, CloseBehavior.AUTO_WITH_BUFFER];
      if (!validBehaviors.includes(params.closeBehavior as any)) {
        errors.push(`Invalid closeBehavior. Must be one of: ${validBehaviors.join(', ')}`);
      }
    }

    // Validate bufferMinutes based on closeBehavior
    if (effectiveBehavior === CloseBehavior.AUTO_WITH_BUFFER) {
      if (!effectiveBuffer || effectiveBuffer <= 0) {
        errors.push('bufferMinutes must be greater than 0 when closeBehavior is "auto_with_buffer"');
      }
    } else if (params.bufferMinutes !== undefined && params.bufferMinutes !== null) {
      errors.push('bufferMinutes should only be provided when closeBehavior is "auto_with_buffer"');
    }

    if (errors.length > 0) {
      throw new ValidationError(
        'Invalid market update parameters',
        { errors }
      );
    }
  }
}
