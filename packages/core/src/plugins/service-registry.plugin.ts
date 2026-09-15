import fp from 'fastify-plugin';
import { IdempotencyService } from '@services/idempotency.service';
import { OutboxService } from '@services/outbox.service';

export const serviceRegistryPlugin = fp(async (fastify) => {
  fastify.decorate(
    'idempotencyService',
    new IdempotencyService(fastify, { retentionHours: fastify.config.IDEMPOTENCY_RETENTION_HOURS }),
  );
  fastify.decorate('outboxService', new OutboxService(fastify));
});
