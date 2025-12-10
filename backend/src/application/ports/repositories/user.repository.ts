
export interface User {
  id: string;
  email: string;
  role: string;
  balance: bigint;
  createdAt: Date;
  // Add other fields as needed
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
