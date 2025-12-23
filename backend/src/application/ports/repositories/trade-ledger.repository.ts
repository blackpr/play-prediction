import { Transaction } from '../transaction-manager.port';

export interface TradeLedgerEntry {
  id: string;
  userId: string;
  marketId: string;
  action: string;
  side: string | null;
  amountIn: bigint;
  amountOut: bigint;
  sharesBefore: bigint | null;
  sharesAfter: bigint | null;
  feePaid: bigint;
  feeVault: bigint;
  feeLp: bigint;
  poolYesBefore: bigint | null;
  poolNoBefore: bigint | null;
  poolYesAfter: bigint | null;
  poolNoAfter: bigint | null;
  priceAtExecution: bigint | null;
  idempotencyKey: string | null;
  createdAt: Date;
}

export interface CreateTradeLedgerEntryDTO {
  userId: string;
  marketId: string;
  action: string;
  side: string | null;
  amountIn: bigint;
  amountOut: bigint;
  sharesBefore?: bigint | null;
  sharesAfter?: bigint | null;
  feePaid: bigint;
  feeVault: bigint;
  feeLp: bigint;
  poolYesBefore?: bigint | null;
  poolNoBefore?: bigint | null;
  poolYesAfter?: bigint | null;
  poolNoAfter?: bigint | null;
  priceAtExecution?: bigint | null;
  idempotencyKey?: string | null;
  originalTradeId?: string | null;
  voidReason?: string | null;
}

export interface FindTradesParams {
  userId?: string;
  marketId?: string;
  action?: string;
  page: number;
  pageSize: number;
}

export interface TradeLedgerRepository {
  findByIdempotencyKey(key: string, tx?: Transaction): Promise<TradeLedgerEntry | null>;
  create(entry: CreateTradeLedgerEntryDTO, tx?: Transaction): Promise<TradeLedgerEntry>;
  findAll(params: FindTradesParams): Promise<{ items: TradeLedgerEntry[]; total: number }>;
  getVolume24h(): Promise<string>;
  getTotalVolume(): Promise<string>;
}
