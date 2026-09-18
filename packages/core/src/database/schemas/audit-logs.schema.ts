import type { AuditAction, AuditActorType } from '@contracts/audit-logs.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorType: text('actor_type').$type<AuditActorType>().notNull(),
    actorId: text('actor_id'),
    action: text('action').$type<AuditAction>().notNull(),
    permission: text('permission'),
    method: text('method').notNull(),
    route: text('route').notNull(),
    resourceId: text('resource_id'),
    statusCode: integer('status_code').notNull(),
    requestId: text('request_id').notNull(),
    ip: text('ip').notNull(),
    occurredAt: isoTimestamp('occurred_at').notNull(),
  },
  (table) => {
    return [
      index('audit_logs_actor_id_occurred_at_idx').on(table.actorId, table.occurredAt),
      index('audit_logs_occurred_at_id_idx').on(table.occurredAt, table.id),
    ];
  },
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
