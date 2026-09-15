import { CustomerService } from '@services/customer.service';
import { EntitlementService } from '@services/entitlement.service';
import { IdempotencyService } from '@services/idempotency.service';
import { LedgerService } from '@services/ledger.service';
import { OutboxService } from '@services/outbox.service';
import { PriceService } from '@services/price.service';
import { ProductService } from '@services/product.service';
import { SubscriptionService } from '@services/subscription.service';
import { TestClockService } from '@services/test-clock.service';
import fp from 'fastify-plugin';

export const serviceRegistryPlugin = fp(async (fastify) => {
  fastify.decorate(
    'idempotencyService',
    new IdempotencyService(fastify, { retentionHours: fastify.config.IDEMPOTENCY_RETENTION_HOURS }),
  );
  fastify.decorate('outboxService', new OutboxService(fastify));
  fastify.decorate('customerService', new CustomerService(fastify));
  fastify.decorate('productService', new ProductService(fastify));
  fastify.decorate('priceService', new PriceService(fastify));
  fastify.decorate('ledgerService', new LedgerService(fastify));
  fastify.decorate('entitlementService', new EntitlementService(fastify));
  fastify.decorate('subscriptionService', new SubscriptionService(fastify));
  fastify.decorate('testClockService', new TestClockService(fastify));
});
