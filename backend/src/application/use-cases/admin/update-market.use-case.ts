import { MarketRepository } from '../../ports/repositories/market.repository';
import { UserRepository } from '../../ports/repositories/user.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../../domain/errors/domain-error';
import { MarketStatus } from '../../../infrastructure/database/drizzle/schema';

const MIN_TITLE_LENGTH = 10;
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_CATEGORY_LENGTH = 100;
const MAX_IMAGE_URL_LENGTH = 2048;

export interface UpdateMarketParams {
  marketId: string;
  adminId: string;
  title?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  closesAt?: Date;
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
      transactionManager: TransactionManager;
    }
  ) { }

  async execute(params: UpdateMarketParams): Promise<UpdateMarketResult> {
    // Validate inputs first (fail fast)
    this.validateInputs(params);

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

      // Only DRAFT markets can be edited
      if (market.status !== MarketStatus.DRAFT) {
        throw new BusinessLogicError(
          'Cannot edit market. Only DRAFT markets can be edited.',
          'MARKET_NOT_EDITABLE',
          { currentStatus: market.status }
        );
      }

      // Build updates object with only provided fields
      const updates: {
        title?: string;
        description?: string;
        category?: string;
        imageUrl?: string;
        closesAt?: Date;
      } = {};

      if (params.title !== undefined) updates.title = params.title;
      if (params.description !== undefined) updates.description = params.description;
      if (params.category !== undefined) updates.category = params.category;
      if (params.imageUrl !== undefined) updates.imageUrl = params.imageUrl;
      if (params.closesAt !== undefined) updates.closesAt = params.closesAt;

      // Update market
      const updatedMarket = await this.deps.marketRepository.update(
        params.marketId,
        updates,
        tx
      );

      // Verify pool exists on original market object
      if (!market.pool) {
        throw new Error('Market pool data missing');
      }

      return {
        id: updatedMarket.id,
        title: updatedMarket.title,
        description: updatedMarket.description,
        category: updatedMarket.category,
        imageUrl: updatedMarket.imageUrl,
        status: updatedMarket.status,
        closesAt: updatedMarket.closesAt,
        closeBehavior: updatedMarket.closeBehavior,
        bufferMinutes: updatedMarket.bufferMinutes,
        pool: {
          yesQty: market.pool.yesQty,
          noQty: market.pool.noQty,
          k: market.pool.k,
        },
        updatedAt: updatedMarket.updatedAt,
      };
    });
  }

  private validateInputs(params: UpdateMarketParams): void {
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

    // Validate category if provided
    if (params.category !== undefined && params.category.length > MAX_CATEGORY_LENGTH) {
      errors.push(`Category must not exceed ${MAX_CATEGORY_LENGTH} characters`);
    }

    // Validate imageUrl if provided
    if (params.imageUrl !== undefined) {
      if (params.imageUrl.length > MAX_IMAGE_URL_LENGTH) {
        errors.push(`Image URL must not exceed ${MAX_IMAGE_URL_LENGTH} characters`);
      }
      // Basic URL validation
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

    if (errors.length > 0) {
      throw new ValidationError(
        'Invalid market update parameters',
        { errors }
      );
    }
  }
}
