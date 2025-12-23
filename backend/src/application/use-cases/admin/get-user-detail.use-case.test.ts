import { describe, it, expect, beforeEach } from 'vitest';
import { GetUserDetailUseCase } from './get-user-detail.use-case';
import { UserRepository, User, UserStats } from '../../ports/repositories/user.repository';
import { NotFoundError } from '../../../domain/errors/domain-error';

describe('GetUserDetailUseCase', () => {
  let useCase: GetUserDetailUseCase;
  let mockUserRepository: UserRepository;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
    balance: 1000000000n,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockStats: UserStats = {
    totalTrades: 15,
    totalVolume: '5000000',
    activePositions: 3,
    pointsGranted: '10000000',
  };

  beforeEach(() => {
    mockUserRepository = {
      findById: async (id: string) => (id === mockUser.id ? mockUser : null),
      getUserStats: async () => mockStats,
    } as any;

    useCase = new GetUserDetailUseCase({
      userRepository: mockUserRepository,
    });
  });

  it('should return user details with statistics', async () => {
    const result = await useCase.execute({ userId: 'user-123' });

    expect(result).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      balance: '1000000000',
      isActive: true,
      createdAt: mockUser.createdAt,
      stats: {
        totalTrades: 15,
        totalVolume: '5000000',
        activePositions: 3,
        pointsGranted: '10000000',
      },
    });
  });

  it('should throw NotFoundError when user does not exist', async () => {
    await expect(
      useCase.execute({ userId: 'non-existent-id' })
    ).rejects.toThrow(NotFoundError);

    await expect(
      useCase.execute({ userId: 'non-existent-id' })
    ).rejects.toThrow('User with ID non-existent-id not found');
  });

  it('should handle user with no trading activity (zero stats)', async () => {
    const zeroStats: UserStats = {
      totalTrades: 0,
      totalVolume: '0',
      activePositions: 0,
      pointsGranted: '0',
    };

    mockUserRepository.getUserStats = async () => zeroStats;

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.stats).toEqual({
      totalTrades: 0,
      totalVolume: '0',
      activePositions: 0,
      pointsGranted: '0',
    });
  });

  it('should handle admin user with high activity', async () => {
    const adminUser: User = {
      ...mockUser,
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'admin',
      balance: 5000000000n,
    };

    const highStats: UserStats = {
      totalTrades: 150,
      totalVolume: '50000000',
      activePositions: 25,
      pointsGranted: '100000000',
    };

    mockUserRepository.findById = async (id: string) =>
      id === 'admin-123' ? adminUser : null;
    mockUserRepository.getUserStats = async () => highStats;

    const result = await useCase.execute({ userId: 'admin-123' });

    expect(result.id).toBe('admin-123');
    expect(result.email).toBe('admin@example.com');
    expect(result.role).toBe('admin');
    expect(result.balance).toBe('5000000000');
    expect(result.stats.totalTrades).toBe(150);
    expect(result.stats.totalVolume).toBe('50000000');
    expect(result.stats.activePositions).toBe(25);
    expect(result.stats.pointsGranted).toBe('100000000');
  });

  it('should handle inactive user', async () => {
    const inactiveUser: User = {
      ...mockUser,
      isActive: false,
    };

    mockUserRepository.findById = async () => inactiveUser;

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.isActive).toBe(false);
  });

  it('should convert bigint balance to string', async () => {
    const userWithLargeBalance: User = {
      ...mockUser,
      balance: 999999999999n,
    };

    mockUserRepository.findById = async () => userWithLargeBalance;

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.balance).toBe('999999999999');
    expect(typeof result.balance).toBe('string');
  });

  it('should preserve createdAt timestamp', async () => {
    const specificDate = new Date('2024-06-15T10:30:00Z');
    const userWithDate: User = {
      ...mockUser,
      createdAt: specificDate,
    };

    mockUserRepository.findById = async () => userWithDate;

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.createdAt).toEqual(specificDate);
  });

  it('should handle user with partial stats', async () => {
    const partialStats: UserStats = {
      totalTrades: 5,
      totalVolume: '1000000',
      activePositions: 0, // No active positions
      pointsGranted: '0', // No grants
    };

    mockUserRepository.getUserStats = async () => partialStats;

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.stats.totalTrades).toBe(5);
    expect(result.stats.activePositions).toBe(0);
    expect(result.stats.pointsGranted).toBe('0');
  });

  it('should handle treasury user', async () => {
    const treasuryUser: User = {
      ...mockUser,
      id: 'treasury-123',
      email: 'treasury@example.com',
      role: 'treasury',
    };

    mockUserRepository.findById = async (id: string) =>
      id === 'treasury-123' ? treasuryUser : null;

    const result = await useCase.execute({ userId: 'treasury-123' });

    expect(result.role).toBe('treasury');
  });
});
