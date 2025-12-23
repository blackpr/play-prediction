import { UserRepository } from '../../ports/repositories/user.repository';
import { PointGrantRepository } from '../../ports/repositories/point-grant.repository';
import { TransactionManager } from '../../ports/transaction-manager.port';
import { NotFoundError, ValidationError } from '../../../domain/errors/domain-error';
import { PointGrantType } from '../../../infrastructure/database/drizzle/schema';

export interface GrantPointsParams {
  userId: string;
  amount: bigint;
  reason: string;
  adminId: string;
}

export interface GrantPointsResult {
  grantId: string;
  userId: string;
  amount: string;
  previousBalance: string;
  newBalance: string;
  reason: string;
  grantedBy: string;
  createdAt: Date;
}

export class GrantPointsUseCase {
  constructor(
    private readonly deps: {
      userRepository: UserRepository;
      pointGrantRepository: PointGrantRepository;
      transactionManager: TransactionManager;
    }
  ) { }

  async execute(params: GrantPointsParams): Promise<GrantPointsResult> {
    const { userId, amount, reason, adminId } = params;

    // Validate amount is positive
    if (amount <= 0n) {
      throw new ValidationError(
        'Amount must be greater than 0',
        { amount: amount.toString() }
      );
    }

    return await this.deps.transactionManager.run(async (tx) => {
      // 1. Find and validate user exists
      const user = await this.deps.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', `User with ID ${userId} not found`);
      }

      // 2. Get admin user for response
      const admin = await this.deps.userRepository.findById(adminId);
      if (!admin) {
        throw new NotFoundError('Admin', `Admin with ID ${adminId} not found`);
      }

      // 3. Calculate new balance
      const previousBalance = user.balance;
      const newBalance = previousBalance + amount;

      // 4. Update user balance
      await this.deps.userRepository.updateBalance(userId, newBalance, tx);

      // 5. Log to point_grants table
      const grantId = crypto.randomUUID();
      await this.deps.pointGrantRepository.create(
        {
          userId,
          amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          grantType: PointGrantType.ADMIN_GRANT,
          reason,
          grantedBy: adminId,
        },
        tx
      );

      return {
        grantId,
        userId,
        amount: amount.toString(),
        previousBalance: previousBalance.toString(),
        newBalance: newBalance.toString(),
        reason,
        grantedBy: admin.email,
        createdAt: new Date(),
      };
    });
  }
}
