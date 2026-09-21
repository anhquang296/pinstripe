import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { AuditAction } from '@contracts/audit-logs.types';
import type { DatabaseClient } from '@database/database.client';
import type { AuditLog, NewAuditLog } from '@database/schemas';
import { auditLogs } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface AuditLogCursor {
  occurredAt: string;
  id: string;
}

export interface AuditLogFilters {
  actorId?: string;
  action?: AuditAction;
  beforeAt?: AuditLogCursor;
  afterAt?: AuditLogCursor;
}

export class AuditLogRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getAuditLog(id: string): Promise<AuditLog> {
    const [auditLog] = await this._db.master
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1);

    if (auditLog) {
      return auditLog;
    }

    throw new NotFoundError(`No such audit log: ${id}`);
  }

  async findAuditLogs(
    filters: AuditLogFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<AuditLog[]> {
    const where = and(
      filters.actorId ? eq(auditLogs.actorId, filters.actorId) : undefined,
      filters.action ? eq(auditLogs.action, filters.action) : undefined,
      filters.beforeAt
        ? sql`(${auditLogs.occurredAt}, ${auditLogs.id}) < (${filters.beforeAt.occurredAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${auditLogs.occurredAt}, ${auditLogs.id}) > (${filters.afterAt.occurredAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.occurredAt), desc(auditLogs.id))
      .limit(limit);
  }

  async createAuditLog(payload: NewAuditLog): Promise<void> {
    await this._db.master.insert(auditLogs).values(payload);
  }
}
