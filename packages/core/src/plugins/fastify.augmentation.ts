import type { Redis } from 'ioredis';
import type { Env } from '@config/env.schema';
import type { DatabaseClient } from '@database/database.client';
import type { QueueRegistry } from '@queues/queue-registry';
import type { CustomerRepository } from '@repositories/customer.repository';
import type { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import type { PriceRepository } from '@repositories/price.repository';
import type { ProductRepository } from '@repositories/product.repository';
import type { OutboxEventRepository } from '@repositories/outbox-event.repository';
import type { CustomerService } from '@services/customer.service';
import type { IdempotencyService } from '@services/idempotency.service';
import type { PriceService } from '@services/price.service';
import type { ProductService } from '@services/product.service';
import type { OutboxService } from '@services/outbox.service';
import type { Clock } from '@utils/clock';
import type { RedisKeyFactory } from '@utils/redis-key-factory';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    clock: Clock;
    database: DatabaseClient;
    redis: Redis;
    redisKeyFactory: RedisKeyFactory;
    queues: QueueRegistry;
    customerRepository: CustomerRepository;
    idempotencyKeyRepository: IdempotencyKeyRepository;
    priceRepository: PriceRepository;
    productRepository: ProductRepository;
    outboxEventRepository: OutboxEventRepository;
    customerService: CustomerService;
    idempotencyService: IdempotencyService;
    priceService: PriceService;
    productService: ProductService;
    outboxService: OutboxService;
  }
}

export {};
