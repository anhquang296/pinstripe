import fp from 'fastify-plugin';
import { CustomerRepository } from '@repositories/customer.repository';
import { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import { OutboxEventRepository } from '@repositories/outbox-event.repository';
import { PriceRepository } from '@repositories/price.repository';
import { ProductRepository } from '@repositories/product.repository';

export const repositoryRegistryPlugin = fp(async (fastify) => {
  fastify.decorate('customerRepository', new CustomerRepository(fastify.database));
  fastify.decorate('idempotencyKeyRepository', new IdempotencyKeyRepository(fastify.database));
  fastify.decorate('outboxEventRepository', new OutboxEventRepository(fastify.database));
  fastify.decorate('priceRepository', new PriceRepository(fastify.database));
  fastify.decorate('productRepository', new ProductRepository(fastify.database));
});
