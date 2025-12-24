import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';
import { CategoryRepository } from '../../ports/repositories/category.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { BusinessLogicError, ValidationError, NotFoundError } from '../../../domain/errors/domain-error';
import { NewMarket, NewLiquidityPool, MarketStatus, CloseBehavior } from '../../../infrastructure/database/drizzle/schema';

const MIN_SEED_LIQUIDITY = 1_000_000n; // 1 Point

// Removed hardcoded CATEGORY_DEFAULTS

export interface CreateMarketParams {
  title: string;
  description: string;
  categoryId: string;
  imageUrl?: string;
  closesAt: Date;
  activatesAt?: Date;
  seedLiquidity: bigint;
  closeBehavior?: string;
  bufferMinutes?: number;
  initialYesPrice?: number;
  createdBy: string; // Admin user ID
}

export interface CreateMarketResult {
  marketId: string;
  title: string;
  status: string;
  activatesAt: Date | null;
  closeBehavior: string;
  bufferMinutes: number | null;
  pool: {
    yesQty: string;
    noQty: string;
    k: string;
  };
}

export class CreateMarketUseCase {
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

  async execute(params: CreateMarketParams): Promise<CreateMarketResult> {
    // 1. Lookup Treasury User
    const treasuryUser = await this.deps.userRepository.findByRole('treasury');
    if (!treasuryUser) {
      throw new NotFoundError(
        'Treasury User',
        'No user with role "treasury" found. Genesis operations require a treasury account.'
      );
    }

    // 2. Fetch Category
    const category = await this.deps.categoryRepository.findById(params.categoryId);
    if (!category) {
      throw new NotFoundError('Category', params.categoryId);
    }

    // 3. Resolve Effective Settings (Provided or Defaults)
    const closeBehavior = params.closeBehavior || category.defaultCloseBehavior;
    const bufferMinutes = params.bufferMinutes ?? (closeBehavior === category.defaultCloseBehavior ? category.defaultBufferMinutes : null);

    // 4. Validate Inputs
    this.validateInputs(params, closeBehavior, bufferMinutes);

    // 4. Execute Transaction
    return await this.deps.transactionManager.run(async (tx) => {
      // Create market record
      const marketData: NewMarket = {
        title: params.title,
        description: params.description,
        category: category.name, // Keep for legacy/index compatibility if needed
        categoryId: category.id,
        imageUrl: params.imageUrl,
        closesAt: params.closesAt,
        activatesAt: params.activatesAt,
        status: MarketStatus.DRAFT,
        closeBehavior: closeBehavior as any,
        bufferMinutes: bufferMinutes,
        createdBy: params.createdBy,
      };

      const market = await this.deps.marketRepository.create(marketData, tx);

      // Calculate initial pool quantities
      let yesQty = params.seedLiquidity;
      let noQty = params.seedLiquidity;

      if (params.initialYesPrice) {
        // Calculate skewed quantities based on initial price
        // Formula: noQty = P_yes * Total_Shares
        // Where Total_Shares = 2 * seedLiquidity (to match standard 50/50 injection value)
        const totalTokens = params.seedLiquidity * 2n;

        // Use integer math: noQty = (Total * (price * 100)) / 100
        const priceBp = BigInt(Math.floor(params.initialYesPrice * 10000));
        noQty = (totalTokens * priceBp) / 10000n;
        yesQty = totalTokens - noQty;
      }

      // Create liquidity pool
      const poolData: NewLiquidityPool = {
        id: market.id,
        yesQty,
        noQty,
        versionId: 1,
      };

      await this.deps.marketRepository.createPool(poolData, tx);

      // Grant seed shares to treasury account
      const totalQty = yesQty + noQty;
      const yesCostBasis = (params.seedLiquidity * yesQty) / totalQty;
      const noCostBasis = params.seedLiquidity - yesCostBasis;

      const portfolioData = {
        userId: treasuryUser.id,
        marketId: market.id,
        yesQty,
        noQty,
        yesCostBasis,
        noCostBasis,
      };

      await this.deps.portfolioRepository.create(portfolioData, tx);

      // Log GENESIS_MINT to trade ledger
      const ledgerData = {
        userId: treasuryUser.id,
        marketId: market.id,
        action: 'GENESIS_MINT',
        side: null,
        amountIn: params.seedLiquidity,
        amountOut: params.seedLiquidity, // Being used as "value out" roughly
        feePaid: 0n,
        feeVault: 0n,
        feeLp: 0n,
      };

      await this.deps.tradeLedgerRepository.create(ledgerData, tx);

      // Create Audit Log Entry
      await this.deps.auditLogRepository.create({
        adminId: params.createdBy,
        action: 'MARKET_CREATED',
        entityType: 'MARKET',
        entityId: market.id,
        details: JSON.stringify({
          title: market.title,
          category: market.category,
          seedLiquidity: params.seedLiquidity.toString(),
          initialYesPrice: params.initialYesPrice,
          closeBehavior: market.closeBehavior,
          closesAt: market.closesAt,
          activatesAt: market.activatesAt,
        }),
      }, tx);

      // Calculate k-invariant
      const k = yesQty * noQty;

      return {
        marketId: market.id,
        title: market.title,
        status: market.status,
        activatesAt: market.activatesAt || null,
        closeBehavior: market.closeBehavior,
        bufferMinutes: market.bufferMinutes,
        pool: {
          yesQty: yesQty.toString(),
          noQty: noQty.toString(),
          k: k.toString(),
        },
      };
    });
  }

  private validateInputs(params: CreateMarketParams, effectiveBehavior: string, effectiveBuffer: number | null): void {
    // Validate minimum seed liquidity
    if (params.seedLiquidity < MIN_SEED_LIQUIDITY) {
      throw new ValidationError(
        `Seed liquidity must be at least ${MIN_SEED_LIQUIDITY} MicroPoints (1 Point)`,
        { minimum: MIN_SEED_LIQUIDITY.toString(), provided: params.seedLiquidity.toString() }
      );
    }

    // Validate closeBehavior if provided
    if (params.closeBehavior) {
      const validBehaviors = [CloseBehavior.AUTO, CloseBehavior.MANUAL, CloseBehavior.AUTO_WITH_BUFFER];
      if (!validBehaviors.includes(params.closeBehavior as any)) {
        throw new ValidationError(
          `Invalid closeBehavior. Must be one of: ${validBehaviors.join(', ')}`,
          { provided: params.closeBehavior, valid: validBehaviors }
        );
      }
    }

    // Validate bufferMinutes based on closeBehavior
    if (effectiveBehavior === CloseBehavior.AUTO_WITH_BUFFER) {
      if (!effectiveBuffer || effectiveBuffer <= 0) {
        throw new ValidationError(
          'bufferMinutes must be greater than 0 when closeBehavior is "auto_with_buffer"',
          { closeBehavior: effectiveBehavior, bufferMinutes: effectiveBuffer }
        );
      }
    } else if (params.bufferMinutes !== undefined && params.bufferMinutes !== null) {
      throw new ValidationError(
        'bufferMinutes should only be provided when closeBehavior is "auto_with_buffer"',
        { closeBehavior: effectiveBehavior }
      );
    }

    // Validate future close date
    if (params.closesAt <= new Date()) {
      throw new ValidationError(
        'closesAt must be in the future',
        { provided: params.closesAt.toISOString() }
      );
    }

    // Validate activatesAt logic
    if (params.activatesAt) {
      const now = new Date();
      if (params.activatesAt <= now) {
        throw new ValidationError('activatesAt must be in the future', { provided: params.activatesAt.toISOString() });
      }
      if (params.activatesAt >= params.closesAt) {
        throw new ValidationError('activatesAt must be before closesAt', { activatesAt: params.activatesAt, closesAt: params.closesAt });
      }
    }

    // Validate initialYesPrice
    if (params.initialYesPrice !== undefined) {
      if (params.initialYesPrice < 0.01 || params.initialYesPrice > 0.99) {
        throw new ValidationError(
          'initialYesPrice must be between 0.01 and 0.99',
          { provided: params.initialYesPrice }
        );
      }
    }
  }
}
