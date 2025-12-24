import { UserRepository } from '../../ports/repositories/user.repository';
import { NotFoundError } from '../../../domain/errors/domain-error';

export interface GetUserDetailParams {
  userId: string;
}

export interface GetUserDetailResult {
  id: string;
  email: string;
  role: string;
  balance: string;
  isActive: boolean;
  createdAt: Date;
  stats: {
    totalTrades: number;
    totalVolume: string;
    activePositions: number;
    pointsGranted: string;
  };
}

export class GetUserDetailUseCase {
  constructor(
    private readonly deps: {
      userRepository: UserRepository;
    }
  ) { }

  async execute(params: GetUserDetailParams): Promise<GetUserDetailResult> {
    const { userId } = params;

    // 1. Find user
    const user = await this.deps.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', `User with ID ${userId} not found`);
    }

    // 2. Get user statistics
    const stats = await this.deps.userRepository.getUserStats(userId);

    // 3. Return combined result
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance.toString(),
      isActive: user.isActive,
      createdAt: user.createdAt,
      stats,
    };
  }
}
