import { ApiKeyService } from '@services/api-key.service';
import { AuditLogService } from '@services/audit-log.service';
import { EventService } from '@services/event.service';
import { IdempotencyService } from '@services/idempotency.service';
import { OutboxService } from '@services/outbox.service';
import { UserService } from '@services/user.service';
import { WebhookService } from '@services/webhook.service';
import fp from 'fastify-plugin';

export const serviceRegistryPlugin = fp(async (fastify) => {
  fastify.decorate(
    'idempotencyService',
    new IdempotencyService(fastify, { retentionHours: fastify.config.IDEMPOTENCY_RETENTION_HOURS }),
  );
  fastify.decorate('outboxService', new OutboxService(fastify));
  fastify.decorate('apiKeyService', new ApiKeyService(fastify));
  fastify.decorate('userService', new UserService(fastify));
  fastify.decorate('auditLogService', new AuditLogService(fastify));
  fastify.decorate('eventService', new EventService(fastify));
  fastify.decorate('webhookService', new WebhookService(fastify));
});
