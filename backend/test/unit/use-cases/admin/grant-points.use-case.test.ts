import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrantPointsUseCase } from '../../../../src/application/use-cases/admin/grant-points.use-case';
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/domain-error';
import { PointGrantType } from '../../../../src/infrastructure/database/drizzle/schema';

describe('GrantPointsUseCase', () => {
  let useCase: GrantPointsUseCase;
  let mockUserRepository: any;
  let mockPointGrantRepository: any;
  let mockAuditLogRepository: any;
  let mockTransactionManager: any;

  const mockUser = {
    id: 'user-id',
    email: 'user@example.com',
    role: 'user',
    balance: 10000000n, // 10 Points
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdmin = {
    id: 'admin-id',
    email: 'admin@example.com',
    role: 'admin',
    balance: 50000000n,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      updateBalance: vi.fn(),
    };

    mockPointGrantRepository = {
      create: vi.fn(),
    };

    mockAuditLogRepository = {
      create: vi.fn(),
    };

    mockTransactionManager = {
      run: vi.fn((callback) => callback({})), // Execute callback immediately with mock tx
    };

    useCase = new GrantPointsUseCase({
      userRepository: mockUserRepository,
      pointGrantRepository: mockPointGrantRepository,
      auditLogRepository: mockAuditLogRepository,
      transactionManager: mockTransactionManager,
    });
  });

  describe('execute', () => {
    it('should successfully grant points and log to point_grants table', async () => {
      mockUserRepository.findById
        .mockResolvedValueOnce(mockUser) // First call for user
        .mockResolvedValueOnce(mockAdmin); // Second call for admin

      const result = await useCase.execute({
        userId: 'user-id',
        amount: 5000000n, // 5 Points
        reason: 'Contest winner reward',
        adminId: 'admin-id',
      });

      // Verify user balance was updated
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith(
        'user-id',
        15000000n, // 10 + 5 Points
        {}
      );

      // Verify point grant was logged
      expect(mockPointGrantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          amount: 5000000n,
          balanceBefore: 10000000n,
          balanceAfter: 15000000n,
          grantType: PointGrantType.ADMIN_GRANT,
          reason: 'Contest winner reward',
          grantedBy: 'admin-id',
        }),
        {}
      );

      // Verify audit log creation
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-id',
          action: 'POINTS_GRANTED',
          entityType: 'USER',
          entityId: 'user-id',
        }),
        {}
      );

      // Verify result
      expect(result.userId).toBe('user-id');
      expect(result.amount).toBe('5000000');
      expect(result.previousBalance).toBe('10000000');
      expect(result.newBalance).toBe('15000000');
      expect(result.reason).toBe('Contest winner reward');
      expect(result.grantedBy).toBe('admin@example.com');
      expect(result.grantId).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'non-existent-id',
          amount: 5000000n,
          reason: 'Test grant',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(NotFoundError);

      expect(mockUserRepository.updateBalance).not.toHaveBeenCalled();
      expect(mockPointGrantRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when amount is zero', async () => {
      await expect(
        useCase.execute({
          userId: 'user-id',
          amount: 0n,
          reason: 'Test grant',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.updateBalance).not.toHaveBeenCalled();
      expect(mockPointGrantRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when amount is negative', async () => {
      await expect(
        useCase.execute({
          userId: 'user-id',
          amount: -1000000n,
          reason: 'Test grant',
          adminId: 'admin-id',
        })
      ).rejects.toThrow(ValidationError);

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.updateBalance).not.toHaveBeenCalled();
      expect(mockPointGrantRepository.create).not.toHaveBeenCalled();
    });

    it('should correctly calculate balanceBefore and balanceAfter', async () => {
      const userWithBalance = {
        ...mockUser,
        balance: 123456789n,
      };

      mockUserRepository.findById
        .mockResolvedValueOnce(userWithBalance)
        .mockResolvedValueOnce(mockAdmin);

      await useCase.execute({
        userId: 'user-id',
        amount: 1000000n, // 1 Point
        reason: 'Bonus',
        adminId: 'admin-id',
      });

      expect(mockPointGrantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          balanceBefore: 123456789n,
          balanceAfter: 124456789n, // 123456789 + 1000000
        }),
        {}
      );

      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith(
        'user-id',
        124456789n,
        {}
      );
    });

    it('should record grantedBy admin ID correctly', async () => {
      mockUserRepository.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockAdmin);

      await useCase.execute({
        userId: 'user-id',
        amount: 1000000n,
        reason: 'Test',
        adminId: 'admin-id',
      });

      expect(mockPointGrantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          grantedBy: 'admin-id',
        }),
        {}
      );
    });

    it('should use transaction for atomicity', async () => {
      mockUserRepository.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockAdmin);

      await useCase.execute({
        userId: 'user-id',
        amount: 1000000n,
        reason: 'Test',
        adminId: 'admin-id',
      });

      // Verify transaction was used
      expect(mockTransactionManager.run).toHaveBeenCalled();

      // Verify all operations received the transaction object
      expect(mockUserRepository.updateBalance).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(BigInt),
        {} // Mock transaction object
      );

      expect(mockPointGrantRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
        {} // Mock transaction object
      );
    });

    it('should handle large point amounts correctly', async () => {
      mockUserRepository.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockAdmin);

      const largeAmount = 1000000000000n; // 1 million Points

      const result = await useCase.execute({
        userId: 'user-id',
        amount: largeAmount,
        reason: 'Large grant',
        adminId: 'admin-id',
      });

      expect(result.amount).toBe(largeAmount.toString());
      expect(result.newBalance).toBe((mockUser.balance + largeAmount).toString());
    });

    it('should throw NotFoundError when admin does not exist', async () => {
      mockUserRepository.findById
        .mockResolvedValueOnce(mockUser) // User exists
        .mockResolvedValueOnce(null); // Admin not found

      await expect(
        useCase.execute({
          userId: 'user-id',
          amount: 1000000n,
          reason: 'Test',
          adminId: 'non-existent-admin',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
