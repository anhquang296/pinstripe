import { ApiKeyRepository } from '@repositories/api-key.repository';
import { AuditLogRepository } from '@repositories/audit-log.repository';
import { EventRepository } from '@repositories/event.repository';
import { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import { OutboxEventRepository } from '@repositories/outbox-event.repository';
import { UserRepository } from '@repositories/user.repository';
import { WebhookRepository } from '@repositories/webhook.repository';
import fp from 'fastify-plugin';

export const repositoryRegistryPlugin = fp(async (fastify) => {
  fastify.decorate('apiKeyRepository', new ApiKeyRepository(fastify.database));
  fastify.decorate('userRepository', new UserRepository(fastify.database));
  fastify.decorate('auditLogRepository', new AuditLogRepository(fastify.database));
  fastify.decorate('eventRepository', new EventRepository(fastify.database));
  fastify.decorate('idempotencyKeyRepository', new IdempotencyKeyRepository(fastify.database));
  fastify.decorate('outboxEventRepository', new OutboxEventRepository(fastify.database));
  fastify.decorate('webhookRepository', new WebhookRepository(fastify.database));
});
