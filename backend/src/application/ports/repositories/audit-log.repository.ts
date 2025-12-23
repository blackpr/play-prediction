import { AuditLog } from '../../../domain/entities/audit-log.entity';

export interface AuditLogRepository {
  findAll(options: {
    page: number;
    pageSize: number;
    adminId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ items: AuditLog[]; total: number }>;

  create(log: Omit<AuditLog, 'id' | 'createdAt' | 'adminEmail'>, tx?: any): Promise<AuditLog>;
}
