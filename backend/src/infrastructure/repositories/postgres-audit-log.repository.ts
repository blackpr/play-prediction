import { AuditLogRepository } from '@/application/ports/repositories/audit-log.repository';
import { AuditLog } from '@/domain/entities/audit-log.entity';
import { DrizzleDB } from '@/infrastructure/database';
import { auditLogs, users } from '@/infrastructure/database/drizzle/schema';
import { desc, eq, and, gte, lte, count } from 'drizzle-orm';

export class PostgresAuditLogRepository implements AuditLogRepository {
  private readonly db: DrizzleDB;

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
  }

  async findAll(options: {
    page: number;
    pageSize: number;
    adminId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ items: AuditLog[]; total: number }> {
    const { page, pageSize, adminId, action, startDate, endDate } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (adminId) {
      // Simple UUID validation to prevent database crash on invalid input
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(adminId)) {
        conditions.push(eq(auditLogs.adminId, adminId));
      } else {
        // If invalid UUID, we can return empty result or just not filter by adminId
        // The user likely wants to see nothing if they started typing an ID that isn't a UUID yet
        // but for now, we'll just skip the filter to prevent the 500
        conditions.push(eq(auditLogs.adminId, '00000000-0000-0000-0000-000000000000'));
      }
    }
    if (action) conditions.push(eq(auditLogs.action, action));
    if (startDate) conditions.push(gte(auditLogs.createdAt, startDate));
    if (endDate) conditions.push(lte(auditLogs.createdAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db
        .select({
          id: auditLogs.id,
          adminId: auditLogs.adminId,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          details: auditLogs.details,
          createdAt: auditLogs.createdAt,
          adminEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.adminId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause),
    ]);

    return {
      items: items.map(
        (item) =>
          new AuditLog(
            item.id,
            item.adminId,
            item.action,
            item.details,
            item.entityType,
            item.entityId,
            item.createdAt,
            item.adminEmail || undefined
          )
      ),
      total: Number(totalResult[0]?.count || 0),
    };
  }

  async create(log: Omit<AuditLog, 'id' | 'createdAt' | 'adminEmail'>, tx?: any): Promise<AuditLog> {
    const db = tx || this.db;
    const [inserted] = await db
      .insert(auditLogs)
      .values({
        adminId: log.adminId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.details,
      })
      .returning();

    return new AuditLog(
      inserted.id,
      inserted.adminId,
      inserted.action,
      inserted.details,
      inserted.entityType,
      inserted.entityId,
      inserted.createdAt
    );
  }
}
