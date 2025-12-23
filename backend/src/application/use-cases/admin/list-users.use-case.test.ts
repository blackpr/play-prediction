import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListUsersUseCase } from './list-users.use-case';
import { UserRepository, PaginatedUsers } from '../../ports/repositories/user.repository';

describe('ListUsersUseCase', () => {
  let useCase: ListUsersUseCase;
  let mockUserRepository: UserRepository;

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByRole: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      updateBalance: vi.fn(),
      count: vi.fn(),
    };

    useCase = new ListUsersUseCase({ userRepository: mockUserRepository });
  });

  it('should list users with default pagination', async () => {
    const mockResult: PaginatedUsers = {
      items: [
        {
          id: 'user-1',
          email: 'user1@example.com',
          role: 'user',
          balance: 1000000n,
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          role: 'user',
          balance: 2000000n,
          isActive: true,
          createdAt: new Date('2024-01-02'),
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 2,
      },
    };

    vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult);

    const result = await useCase.execute({});

    expect(mockUserRepository.findAll).toHaveBeenCalledWith({
      search: undefined,
      role: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(result).toEqual(mockResult);
  });

  it('should filter users by email search', async () => {
    const mockResult: PaginatedUsers = {
      items: [
        {
          id: 'user-1',
          email: 'admin@example.com',
          role: 'admin',
          balance: 1000000n,
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
      },
    };

    vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult);

    const result = await useCase.execute({ search: 'admin' });

    expect(mockUserRepository.findAll).toHaveBeenCalledWith({
      search: 'admin',
      role: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toContain('admin');
  });

  it('should filter users by role', async () => {
    const mockResult: PaginatedUsers = {
      items: [
        {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
          balance: 1000000n,
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
      },
    };

    vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult);

    const result = await useCase.execute({ role: 'admin' });

    expect(mockUserRepository.findAll).toHaveBeenCalledWith({
      search: undefined,
      role: 'admin',
      page: 1,
      pageSize: 20,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].role).toBe('admin');
  });

  it('should apply combined filters', async () => {
    const mockResult: PaginatedUsers = {
      items: [
        {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
          balance: 1000000n,
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
      },
    };

    vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult);

    const result = await useCase.execute({ search: 'admin', role: 'admin' });

    expect(mockUserRepository.findAll).toHaveBeenCalledWith({
      search: 'admin',
      role: 'admin',
      page: 1,
      pageSize: 20,
    });
    expect(result.items).toHaveLength(1);
  });

  it('should handle custom pagination', async () => {
    const mockResult: PaginatedUsers = {
      items: [],
      pagination: {
        page: 2,
        pageSize: 10,
        totalItems: 25,
      },
    };

    vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult);

    const result = await useCase.execute({ page: 2, pageSize: 10 });

    expect(mockUserRepository.findAll).toHaveBeenCalledWith({
      search: undefined,
      role: undefined,
      page: 2,
      pageSize: 10,
    });
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.pageSize).toBe(10);
  });

  it('should cap pageSize at 100', async () => {
    const mockResult: PaginatedUsers = {
      items: [],
      pagination: {
        page: 1,
        pageSize: 100,
        totalItems: 0,
      },
    };

    vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult);

    await useCase.execute({ pageSize: 500 });

    expect(mockUserRepository.findAll).toHaveBeenCalledWith({
      search: undefined,
      role: undefined,
      page: 1,
      pageSize: 100,
    });
  });

  it('should return empty results when no users match', async () => {
    const mockResult: PaginatedUsers = {
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
      },
    };

    vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult);

    const result = await useCase.execute({ search: 'nonexistent' });

    expect(result.items).toHaveLength(0);
    expect(result.pagination.totalItems).toBe(0);
  });
});
