import type { BetterAuthClient } from '@clients/better-auth.client';
import type { FileStorageClient } from '@clients/file-storage.client';
import type { SmtpClient } from '@clients/smtp.client';
import type { Env } from '@config/env.schema';
import type { DatabaseClient } from '@database/database.client';
import type { ListenAddress, WorkflowSchedules } from '@plugins/config.plugin';
import type { QueueRegistry } from '@queues/queue-registry';
import type { ApiKeyRepository } from '@repositories/api-key.repository';
import type { AuditLogRepository } from '@repositories/audit-log.repository';
import type { EventRepository } from '@repositories/event.repository';
import type { IdempotencyKeyRepository } from '@repositories/idempotency-key.repository';
import type { OutboxEventRepository } from '@repositories/outbox-event.repository';
import type { UserRepository } from '@repositories/user.repository';
import type { WebhookRepository } from '@repositories/webhook.repository';
import type { ApiKeyService } from '@services/api-key.service';
import type { AuditLogService } from '@services/audit-log.service';
import type { DomainEventDispatchService } from '@services/domain-event-dispatch.service';
import type { EventService } from '@services/event.service';
import type { IdempotencyService } from '@services/idempotency.service';
import type { OutboxService } from '@services/outbox.service';
import type { UserService } from '@services/user.service';
import type { WebhookService } from '@services/webhook.service';
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
    betterAuth: BetterAuthClient;
    fileStorage: FileStorageClient;
    mailer: SmtpClient | null;
    apiKeyRepository: ApiKeyRepository;
    userRepository: UserRepository;
    auditLogRepository: AuditLogRepository;
    eventRepository: EventRepository;
    idempotencyKeyRepository: IdempotencyKeyRepository;
    outboxEventRepository: OutboxEventRepository;
    webhookRepository: WebhookRepository;
    apiKeyService: ApiKeyService;
    userService: UserService;
    auditLogService: AuditLogService;
    eventService: EventService;
    idempotencyService: IdempotencyService;
    outboxService: OutboxService;
    webhookService: WebhookService;
    domainEventDispatchService: DomainEventDispatchService;
  }
}

export {};
