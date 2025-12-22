import { Transaction } from '../transaction-manager.port';

export interface Portfolio {
  userId: string;
  marketId: string;
  yesQty: bigint;
  noQty: bigint;
  yesCostBasis: bigint;
  noCostBasis: bigint;
  updatedAt: Date;
}

export interface CreatePortfolioDTO {
  userId: string;
  marketId: string;
  yesQty: bigint;
  noQty: bigint;
  yesCostBasis: bigint;
  noCostBasis: bigint;
}

export interface UpdatePortfolioDTO {
  yesQty?: bigint;
  noQty?: bigint;
  yesCostBasis?: bigint;
  noCostBasis?: bigint;
}

export interface PortfolioRepository {
  findByUserAndMarket(userId: string, marketId: string, tx?: Transaction): Promise<Portfolio | null>;
  create(portfolio: CreatePortfolioDTO, tx?: Transaction): Promise<Portfolio>;
  update(userId: string, marketId: string, updates: UpdatePortfolioDTO, tx?: Transaction): Promise<Portfolio>;
}
