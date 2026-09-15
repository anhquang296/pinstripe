import fp from 'fastify-plugin';
import { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import { OutboxEventRepository } from '@repositories/outbox-event.repository';

export const repositoryRegistryPlugin = fp(async (fastify) => {
  fastify.decorate('idempotencyKeyRepository', new IdempotencyKeyRepository(fastify.database));
  fastify.decorate('outboxEventRepository', new OutboxEventRepository(fastify.database));
});
