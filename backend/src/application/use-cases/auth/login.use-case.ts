import { AuthService } from '../../ports/services/auth.service';
import { UserRepository } from '../../ports/repositories/user.repository';
import { NotFoundError } from '../../../domain/errors/domain-error';

export class LoginUseCase {
  private readonly authService: AuthService;
  private readonly userRepository: UserRepository;

  constructor({ authService, userRepository }: { authService: AuthService; userRepository: UserRepository }) {
    this.authService = authService;
    this.userRepository = userRepository;
  }

  async execute(params: { email: string; password: string }) {
    // 1. Authenticate with Identity Provider (Supabase)
    const authUser = await this.authService.login(params.email, params.password);

    // 2. Fetch internal user profile
    const user = await this.userRepository.findById(authUser.id);

    if (!user) {
      // This is the edge case where auth exists but DB record doesn't.
      // Could throw a specific 500-like error or 404.
      // NotFoundError is mapped to 404 usually.
      throw new NotFoundError('User Profile', authUser.id);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        balance: user.balance.toString(),
        createdAt: user.createdAt,
      }
    };
  }
}
