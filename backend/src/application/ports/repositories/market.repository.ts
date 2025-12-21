import { Market } from '../../../infrastructure/database/drizzle/schema';

// Define a pool shape with strings for BigInts
export interface LiquidityPoolDetails {
  id: string;
  yesQty: string;
  noQty: string;
  versionId: number;
  updatedAt: Date;
}

export interface MarketWithDetails extends Market {
  pool: LiquidityPoolDetails | null;
  volume24h: string;
  yesPrice: string;
  noPrice: string;
}

export interface GetMarketsParams {
  status?: string;
  category?: string;
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface MarketRepository {
  findAll(params: GetMarketsParams): Promise<{ items: MarketWithDetails[]; total: number }>;
  findById(id: string): Promise<MarketWithDetails | null>;
}
