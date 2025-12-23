
import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { GetAuditLogUseCase } from './get-audit-log.use-case';
import { AuditLogRepository } from '@/application/ports/repositories/audit-log.repository';
import { AuditLog } from '@/domain/entities/audit-log.entity';

describe('GetAuditLogUseCase', () => {
  let useCase: GetAuditLogUseCase;
  let mockRepository: Mocked<AuditLogRepository>;

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      create: vi.fn(),
    };
    useCase = new GetAuditLogUseCase({ auditLogRepository: mockRepository });
  });

  it('should return paginated audit logs', async () => {
    const mockLogs = [
      new AuditLog('1', 'admin-1', 'ACTION', 'details', 'ENTITY', 'entity-1', new Date()),
    ];
    mockRepository.findAll.mockResolvedValue({ items: mockLogs, total: 1 });

    const result = await useCase.execute({ page: 1, pageSize: 10 });

    expect(mockRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      adminId: undefined,
      action: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    expect(result).toEqual({ items: mockLogs, total: 1 });
  });

  it('should pass filters to repository', async () => {
    mockRepository.findAll.mockResolvedValue({ items: [], total: 0 });

    const filters = {
      page: 2,
      pageSize: 50,
      adminId: 'admin-123',
      action: 'MARKET_CREATED',
      startDate: '2023-01-01',
      endDate: '2023-12-31',
    };

    await useCase.execute(filters);

    expect(mockRepository.findAll).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      adminId: 'admin-123',
      action: 'MARKET_CREATED',
      startDate: expect.any(Date),
      endDate: expect.any(Date),
    });
  });
});
