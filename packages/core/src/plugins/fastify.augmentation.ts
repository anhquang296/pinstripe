import type { Env } from '@config/env.schema';
import type { DatabaseClient } from '@database/database.client';
import type { ListenAddress, WorkflowSchedules } from '@plugins/config.plugin';
import type { QueueRegistry } from '@queues/queue-registry';
import type { CustomerRepository } from '@repositories/customer.repository';
import type { EntitlementRepository } from '@repositories/entitlement.repository';
import type { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import type { LedgerAccountRepository } from '@repositories/ledger-account.repository';
import type { LedgerTransactionRepository } from '@repositories/ledger-transaction.repository';
import type { OutboxEventRepository } from '@repositories/outbox-event.repository';
import type { PriceRepository } from '@repositories/price.repository';
import type { ProductRepository } from '@repositories/product.repository';
import type { SubscriptionRepository } from '@repositories/subscription.repository';
import type { TestClockRepository } from '@repositories/test-clock.repository';
import type { CustomerService } from '@services/customer.service';
import type { EntitlementService } from '@services/entitlement.service';
import type { IdempotencyService } from '@services/idempotency.service';
import type { LedgerService } from '@services/ledger.service';
import type { OutboxService } from '@services/outbox.service';
import type { PriceService } from '@services/price.service';
import type { ProductService } from '@services/product.service';
import type { SubscriptionService } from '@services/subscription.service';
import type { TestClockService } from '@services/test-clock.service';
import type { Clock } from '@utils/clock';
import type { RedisKeyFactory } from '@utils/redis-key-factory';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    clock: Clock;
    database: DatabaseClient;
    redis: Redis;
    redisKeyFactory: RedisKeyFactory;
    serverAddress: ListenAddress;
    workerAddress: ListenAddress;
    workflowSchedules: WorkflowSchedules;
    workerConnection: Redis;
    queuePrefix: string;
    queues: QueueRegistry;
    customerRepository: CustomerRepository;
    idempotencyKeyRepository: IdempotencyKeyRepository;
    entitlementRepository: EntitlementRepository;
    priceRepository: PriceRepository;
    productRepository: ProductRepository;
    subscriptionRepository: SubscriptionRepository;
    testClockRepository: TestClockRepository;
    ledgerAccountRepository: LedgerAccountRepository;
    ledgerTransactionRepository: LedgerTransactionRepository;
    outboxEventRepository: OutboxEventRepository;
    customerService: CustomerService;
    idempotencyService: IdempotencyService;
    entitlementService: EntitlementService;
    priceService: PriceService;
    productService: ProductService;
    subscriptionService: SubscriptionService;
    testClockService: TestClockService;
    ledgerService: LedgerService;
    outboxService: OutboxService;
  }
}

export {};
