import { MarketRepository } from '../../ports/repositories/market.repository';
import { PortfolioRepository } from '../../ports/repositories/portfolio.repository';
import { TradeLedgerRepository } from '../../ports/repositories/trade-ledger.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { BusinessLogicError, ValidationError, NotFoundError } from '../../../domain/errors/domain-error';
import { NewMarket, NewLiquidityPool, MarketStatus, CloseBehavior } from '../../../infrastructure/database/drizzle/schema';

const MIN_SEED_LIQUIDITY = 1_000_000n; // 1 Point

interface CategoryDefaults {
  closeBehavior: string;
  bufferMinutes: number | null;
}

const CATEGORY_DEFAULTS: Record<string, CategoryDefaults> = {
  'Sports - Soccer': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
  'Sports - Basketball': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 30 },
  'Sports - Football': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 45 },
  'Sports - Other': { closeBehavior: CloseBehavior.AUTO_WITH_BUFFER, bufferMinutes: 15 },
  'Crypto': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
  'Weather': { closeBehavior: CloseBehavior.AUTO, bufferMinutes: null },
  'Politics': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
  'Entertainment': { closeBehavior: CloseBehavior.MANUAL, bufferMinutes: null },
};

export interface CreateMarketParams {
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  closesAt: Date;
  seedLiquidity: bigint;
  closeBehavior?: string;
  bufferMinutes?: number;
  createdBy: string; // Admin user ID
}

export interface CreateMarketResult {
  marketId: string;
  title: string;
  status: string;
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

    // 2. Validate Inputs
    this.validateInputs(params);

    // 3. Apply Category Defaults
    const { closeBehavior, bufferMinutes } = this.applyDefaults(params);

    // 4. Execute Transaction
    return await this.deps.transactionManager.run(async (tx) => {
      // Create market record
      const marketData: NewMarket = {
        title: params.title,
        description: params.description,
        category: params.category,
        imageUrl: params.imageUrl,
        closesAt: params.closesAt,
        status: MarketStatus.DRAFT,
        closeBehavior,
        bufferMinutes,
        createdBy: params.createdBy,
      };

      const market = await this.deps.marketRepository.create(marketData, tx);

      // Create liquidity pool (50/50 split)
      const poolData: NewLiquidityPool = {
        id: market.id,
        yesQty: params.seedLiquidity,
        noQty: params.seedLiquidity,
        versionId: 1,
      };

      await this.deps.marketRepository.createPool(poolData, tx);

      // Grant seed shares to treasury account
      const portfolioData = {
        userId: treasuryUser.id,
        marketId: market.id,
        yesQty: params.seedLiquidity,
        noQty: params.seedLiquidity,
        yesCostBasis: params.seedLiquidity / 2n,
        noCostBasis: params.seedLiquidity / 2n,
      };

      await this.deps.portfolioRepository.create(portfolioData, tx);

      // Log GENESIS_MINT to trade ledger
      const ledgerData = {
        userId: treasuryUser.id,
        marketId: market.id,
        action: 'GENESIS_MINT',
        side: null,
        amountIn: params.seedLiquidity,
        amountOut: params.seedLiquidity,
        feePaid: 0n,
        feeVault: 0n,
        feeLp: 0n,
      };

      await this.deps.tradeLedgerRepository.create(ledgerData, tx);

      // Calculate k-invariant
      const k = params.seedLiquidity * params.seedLiquidity;

      return {
        marketId: market.id,
        title: market.title,
        status: market.status,
        closeBehavior: market.closeBehavior,
        bufferMinutes: market.bufferMinutes,
        pool: {
          yesQty: params.seedLiquidity.toString(),
          noQty: params.seedLiquidity.toString(),
          k: k.toString(),
        },
      };
    });
  }

  private validateInputs(params: CreateMarketParams): void {
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
    const effectiveBehavior = params.closeBehavior || CATEGORY_DEFAULTS[params.category]?.closeBehavior || CloseBehavior.AUTO;

    if (effectiveBehavior === CloseBehavior.AUTO_WITH_BUFFER) {
      const effectiveBuffer = params.bufferMinutes ?? CATEGORY_DEFAULTS[params.category]?.bufferMinutes;
      if (!effectiveBuffer || effectiveBuffer <= 0) {
        throw new ValidationError(
          'bufferMinutes must be greater than 0 when closeBehavior is "auto_with_buffer"',
          { closeBehavior: effectiveBehavior }
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
  }

  private applyDefaults(params: CreateMarketParams): { closeBehavior: string; bufferMinutes: number | null } {
    const categoryDefault = CATEGORY_DEFAULTS[params.category];

    const closeBehavior = params.closeBehavior || categoryDefault?.closeBehavior || CloseBehavior.AUTO;
    const bufferMinutes = params.bufferMinutes ?? (closeBehavior === CloseBehavior.AUTO_WITH_BUFFER ? categoryDefault?.bufferMinutes ?? null : null);

    return { closeBehavior, bufferMinutes };
  }
}
