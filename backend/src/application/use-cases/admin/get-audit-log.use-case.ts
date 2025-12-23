import { AuditLogRepository } from '../../ports/repositories/audit-log.repository';

export interface GetAuditLogRequest {
  page?: number;
  pageSize?: number;
  adminId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export class GetAuditLogUseCase {
  private readonly auditLogRepository: AuditLogRepository;

  constructor({ auditLogRepository }: { auditLogRepository: AuditLogRepository }) {
    this.auditLogRepository = auditLogRepository;
  }

  async execute(request: GetAuditLogRequest) {
    const page = request.page || 1;
    const pageSize = request.pageSize || 20;

    const startDate = request.startDate ? new Date(request.startDate) : undefined;
    const endDate = request.endDate ? new Date(request.endDate) : undefined;

    return this.auditLogRepository.findAll({
      page,
      pageSize,
      adminId: request.adminId,
      action: request.action,
      startDate,
      endDate,
    });
  }
}
