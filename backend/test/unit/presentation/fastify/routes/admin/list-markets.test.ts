import { FastifyRequest, FastifyReply } from 'fastify';
import { listAdminMarkets } from '@/presentation/fastify/routes/admin/list-markets';
import { AppCradle } from '@/shared/container/types';
import { GetAdminMarketsUseCase } from '@/application/use-cases/admin/get-admin-markets.use-case';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('listAdminMarkets', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockGetAdminMarketsUseCase: Partial<GetAdminMarketsUseCase>;

  beforeEach(() => {
    mockGetAdminMarketsUseCase = {
      execute: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
      }),
    };

    mockRequest = {
      query: {},
      diScope: {
        cradle: {
          getAdminMarketsUseCase: mockGetAdminMarketsUseCase,
        } as unknown as AppCradle,
      } as any,
    };

    mockReply = {
      send: vi.fn(),
    };
  });

  it('should list markets with default parameters', async () => {
    await listAdminMarkets(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockGetAdminMarketsUseCase.execute).toHaveBeenCalledWith({
      status: undefined,
      category: undefined,
      page: 1,
      pageSize: 20,
      sort: 'createdAt',
      order: 'desc',
      search: undefined,
    });

    expect(mockReply.send).toHaveBeenCalledWith({
      success: true,
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
    });
  });

  it('should filter by specific status', async () => {
    mockRequest.query = { status: 'DRAFT' };

    await listAdminMarkets(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockGetAdminMarketsUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFT',
    }));
  });

  it('should allow "all" status to mean undefined filter', async () => {
    mockRequest.query = { status: 'all' };

    await listAdminMarkets(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockGetAdminMarketsUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      status: undefined,
    }));
  });

  it('should handle pagination and search', async () => {
    mockRequest.query = { page: 2, pageSize: 50, search: 'bitcoin' };

    await listAdminMarkets(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockGetAdminMarketsUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      pageSize: 50,
      search: 'bitcoin',
    }));
  });
});
