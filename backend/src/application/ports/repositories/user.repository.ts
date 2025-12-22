
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

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByRole(role: string): Promise<User | null>;
  create(user: CreateUserDTO, tx?: Transaction): Promise<User>;
}
