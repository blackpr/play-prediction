import { Market, NewMarket, NewLiquidityPool } from '../../../infrastructure/database/drizzle/schema';

// Define a pool shape with strings for BigInts
export interface LiquidityPoolDetails {
  id: string;
  yesQty: string;
  noQty: string;
  k: string; // k-invariant
  versionId: number;
  updatedAt: Date;
}

export interface MarketWithDetails extends Market {
  pool: LiquidityPoolDetails | null;
  volume24h: string;
  yesPrice: string;
  noPrice: string;
}

export interface MarketStats {
  totalVolume: string;
  volume24h: string;
  tradeCount: number;
  uniqueTraders: number;
}

export interface MarketExtendedDetails extends MarketWithDetails {
  stats: MarketStats;
  creator: {
    email: string;
    displayName: string | null;
    role: string;
  };
}

export interface GetMarketsParams {
  status?: string;
  category?: string;
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface RecentTrade {
  id: string;
  userId: string;
  action: string;
  side: string;
  amountIn: string;
  amountOut: string;
  priceAtExecution: string;
  createdAt: Date;
}

export interface MarketWithPool {
  id: string;
  title: string;
  status: string;
  closesAt: Date | null;
  pool: {
    yesQty: bigint;
    noQty: bigint;
    versionId: number;
  };
}

export interface UpdatePoolResult {
  success: boolean;
  newYesQty: bigint;
  newNoQty: bigint;
  newVersionId: number;
}

export interface MarketRepository {
  findAll(params: GetMarketsParams): Promise<{ items: MarketWithDetails[]; total: number }>;
  findById(id: string): Promise<MarketExtendedDetails | null>;
  getPriceHistory(marketId: string, interval: string, from: Date, to: Date): Promise<PriceCandle[]>;
  getRecentTrades(marketId: string, limit: number): Promise<RecentTrade[]>;

  // Trading operations
  findByIdWithPool(id: string, tx?: unknown): Promise<MarketWithPool | null>;
  updatePoolWithLock(
    marketId: string,
    newYesQty: bigint,
    newNoQty: bigint,
    expectedVersion: number,
    tx?: unknown
  ): Promise<UpdatePoolResult>;
  updateUserBalance(userId: string, newBalance: bigint, tx?: unknown): Promise<void>;

  // Admin operations
  create(market: NewMarket, tx?: unknown): Promise<Market>;
  createPool(pool: NewLiquidityPool, tx?: unknown): Promise<void>;
  updateStatus(marketId: string, newStatus: string, tx?: unknown): Promise<Market>;
}

export interface PriceCandle {
  timestamp: string;
  yesOpen: string;
  yesHigh: string;
  yesLow: string;
  yesClose: string;
  volume: string;
}
