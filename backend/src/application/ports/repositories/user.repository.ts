
export interface User {
  id: string;
  email: string;
  role: string;
  balance: bigint;
  isActive: boolean;
  createdAt: Date;
}

import { Transaction } from '../transaction-manager.port';

export interface CreateUserDTO {
  id: string;
  email: string;
  role: string;
  balance: bigint;
}

export interface FindAllUsersParams {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedUsers {
  items: User[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByRole(role: string): Promise<User | null>;
  findAll(params: FindAllUsersParams): Promise<PaginatedUsers>;
  create(user: CreateUserDTO, tx?: Transaction): Promise<User>;
  updateBalance(userId: string, newBalance: bigint, tx?: Transaction): Promise<void>;
  count(): Promise<number>;
}
