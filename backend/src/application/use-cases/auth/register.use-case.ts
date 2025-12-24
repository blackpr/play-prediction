import { CreateUserDTO, UserRepository } from '../../ports/repositories/user.repository';
import { PointGrantRepository } from '../../ports/repositories/point-grant.repository';
import { AuthService } from '../../ports/services/auth.service';
import { AppConfig } from '../../../shared/config/app-config';
import { ConflictError, InternalServerError } from '../../../domain/errors/domain-error';
import { TransactionManager } from '../../ports/transaction-manager.port';

export class RegisterUseCase {
  private readonly authService: AuthService;
  private readonly userRepository: UserRepository;
  private readonly pointGrantRepository: PointGrantRepository;
  private readonly transactionManager: TransactionManager;

  constructor({
    authService,
    userRepository,
    pointGrantRepository,
    transactionManager,
  }: {
    authService: AuthService;
    userRepository: UserRepository;
    pointGrantRepository: PointGrantRepository;
    transactionManager: TransactionManager;
  }) {
    this.authService = authService;
    this.userRepository = userRepository;
    this.pointGrantRepository = pointGrantRepository;
    this.transactionManager = transactionManager;
  }

  async execute(params: { email: string; password: string }) {
    // 1. Create Supabase Auth user
    // The service handles mapping Supabase errors to Domain errors (e.g. EmailAlreadyExists -> ConflictError)
    const authUser = await this.authService.signUp(params.email, params.password);

    try {
      // 2. Create user profile and grant bonus in a transaction
      // Use result to return what we need
      return await this.transactionManager.run(async (tx) => {
        const newUser = await this.userRepository.create({
          id: authUser.id,
          email: params.email,
          role: 'user',
          balance: AppConfig.REGISTRATION_BONUS_AMOUNT,
        }, tx);

        await this.pointGrantRepository.create({
          userId: authUser.id,
          amount: AppConfig.REGISTRATION_BONUS_AMOUNT,
          balanceBefore: 0n,
          balanceAfter: AppConfig.REGISTRATION_BONUS_AMOUNT,
          grantType: 'REGISTRATION_BONUS',
          reason: 'Welcome bonus',
        }, tx);

        return {
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            balance: newUser.balance.toString(),
            createdAt: newUser.createdAt,
          },
          message: 'Please check your email to confirm your account'
        };
      });

    } catch (error) {
      // If DB steps fail, we have an orphaned auth user in Supabase.
      // In a real system we might want to schedule a cleanup job or try to delete the auth user here.
      // For now, allow the error to propagate as InternalServerError.

      // If it's a conflict error from DB (unlikely if unique email check passed at auth level, but possible race)
      if (error instanceof ConflictError) {
        throw error;
      }

      throw new InternalServerError('Failed to complete registration');
    }
  }
}
