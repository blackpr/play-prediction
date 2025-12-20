
export interface PointGrant {
  id: string;
  userId: string;
  amount: bigint;
  balanceBefore: bigint;
  balanceAfter: bigint;
  grantType: string;
  reason: string | null;
  grantedBy: string | null;
  createdAt: Date;
}


export interface CreatePointGrantDTO {
  userId: string;
  amount: bigint;
  balanceBefore: bigint;
  balanceAfter: bigint;
  grantType: string;
  reason?: string;
}

import { Transaction } from '../transaction-manager.port';

export interface PointGrantRepository {
  create(grant: CreatePointGrantDTO, tx?: Transaction): Promise<void>;
  findByUserId(userId: string, options: { page: number; pageSize: number }): Promise<{ items: (PointGrant & { grantedByEmail?: string })[]; total: number }>;
}

