import type { AuditLogResponse, FindAuditLogsQuery } from '@contracts/audit-logs.types';
import type { ListResponse } from '@contracts/pagination.types';
import type { NewAuditLog } from '@database/schemas';
import type { AuditLogCursor } from '@repositories/audit-log.repository';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_AUDIT_LOG_LIMIT = 20;

export type CreateAuditLogPayload = Omit<NewAuditLog, 'id' | 'occurredAt'>;

export class AuditLogService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createAuditLog(payload: CreateAuditLogPayload): Promise<void> {
    try {
      await this.fastify.auditLogRepository.createAuditLog({
        ...payload,
        id: generateGid(ObjectPrefixEnum.AUDIT_LOG),
        occurredAt: this.fastify.clock.now().toISOString(),
      });
    } catch (error) {
      this.fastify.log.error(
        { error, requestId: payload.requestId },
        '[AuditLogService] createAuditLog() error',
      );
    }
  }

  async findAuditLogs(query: FindAuditLogsQuery): Promise<ListResponse<AuditLogResponse>> {
    const { limit = DEFAULT_AUDIT_LOG_LIMIT, actorId, action } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.auditLogRepository.findAuditLogs(
      { actorId, action, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/v1/audit_logs',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<AuditLogCursor | undefined> {
    if (id) {
      const auditLog = await this.fastify.auditLogRepository.getAuditLog(id);

      return { occurredAt: auditLog.occurredAt, id: auditLog.id };
    }

    return undefined;
  }
}
