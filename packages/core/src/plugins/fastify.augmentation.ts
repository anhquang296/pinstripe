import type { Redis } from 'ioredis';
import type { Env } from '@config/env.schema';
import type { DatabaseClient } from '@database/database.client';
import type { QueueRegistry } from '@queues/queue-registry';
import type { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import type { OutboxEventRepository } from '@repositories/outbox-event.repository';
import type { IdempotencyService } from '@services/idempotency.service';
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
    idempotencyKeyRepository: IdempotencyKeyRepository;
    outboxEventRepository: OutboxEventRepository;
    idempotencyService: IdempotencyService;
    outboxService: OutboxService;
  }
}

export {};
