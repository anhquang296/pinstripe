import { randomBytes } from 'node:crypto';

import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateWebhookEndpointPayload,
  FindWebhookDeliveriesQuery,
  FindWebhookEndpointsQuery,
  PinstripeEvent,
  UpdateWebhookEndpointPayload,
  WebhookDeliveryResponse,
  WebhookDeliveryStatus,
  WebhookEndpointResponse,
} from '@contracts/webhooks.types';
import { WebhookDeliveryStatusEnum, WebhookEndpointStatusEnum } from '@contracts/webhooks.types';
import type { WebhookEndpoint } from '@database/schemas';
import { ConflictError, NotFoundError, TooManyRequestsError } from '@errors/app.error';
import type { DomainEventDispatchJob } from '@queues/domain-event.queue';
import { QueueNameEnum } from '@queues/queue-name';
import type { WebhookDeliveryJob } from '@queues/webhook.queue';
import { buildWebhookDeliveryJob, WEBHOOK_DELIVERY_JOB } from '@queues/webhook.queue';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { consumeRateLimit } from '@utils/rate-limit';
import { RedisNamespaceEnum } from '@utils/redis-key-factory';
import { buildWebhookSignature } from '@utils/webhook-signature';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const SECRET_BYTE_LENGTH = 24;
const SECRET_PREFIX = 'whsec_';
const ENDPOINT_SCAN_LIMIT = 200;

export interface WebhookDeliveryAttempt {
  endpointUrl: string;
  body: string;
  signature: string;
}

export class WebhookService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createWebhookEndpoint(
    payload: CreateWebhookEndpointPayload,
  ): Promise<WebhookEndpointResponse> {
    const now = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.WEBHOOK_ENDPOINT);
    const createdEndpoint = await this.fastify.webhookRepository.createWebhookEndpoint({
      id,
      url: payload.url,
      status: WebhookEndpointStatusEnum.ENABLED,
      enabledEvents: [...payload.enabledEvents],
      description: payload.description ?? '',
      secret: WebhookService.buildSecret(),
      metadata: payload.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    if (createdEndpoint) {
      return WebhookService.buildEndpoint(createdEndpoint, { hasSecret: true });
    }

    throw new NotFoundError(`Webhook endpoint ${id} could not be created`);
  }

  async updateWebhookEndpoint(
    id: string,
    payload: UpdateWebhookEndpointPayload,
  ): Promise<WebhookEndpointResponse> {
    await this.fastify.webhookRepository.getWebhookEndpoint(id);

    const updatedEndpoint = await this.fastify.webhookRepository.updateWebhookEndpoint(id, {
      status: payload.status,
      enabledEvents: payload.enabledEvents ? [...payload.enabledEvents] : undefined,
      description: payload.description,
      metadata: payload.metadata,
      updatedAt: this.fastify.clock.now().toISOString(),
    });

    if (updatedEndpoint) {
      return WebhookService.buildEndpoint(updatedEndpoint, { hasSecret: false });
    }

    throw new NotFoundError(`No such webhook endpoint: ${id}`);
  }

  async getWebhookEndpoint(id: string): Promise<WebhookEndpointResponse> {
    const endpoint = await this.fastify.webhookRepository.getWebhookEndpoint(id);

    return WebhookService.buildEndpoint(endpoint, { hasSecret: false });
  }

  async findWebhookEndpoints(
    query: FindWebhookEndpointsQuery,
  ): Promise<ListResponse<WebhookEndpointResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveEndpointCursor(query.startingAfter);
    const afterAt = await this.resolveEndpointCursor(query.endingBefore);
    const rows = await this.fastify.webhookRepository.findWebhookEndpoints(
      { status: query.status, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/v1/webhook_endpoints',
      hasMore: rows.length > limit,
      data: _.map(_.take(rows, limit), (endpoint) => {
        return WebhookService.buildEndpoint(endpoint, { hasSecret: false });
      }),
    };
  }

  async findWebhookDeliveries(
    query: FindWebhookDeliveriesQuery,
  ): Promise<ListResponse<WebhookDeliveryResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const rows = await this.fastify.webhookRepository.findWebhookDeliveries(
      { endpointId: query.endpointId, status: query.status },
      limit + 1,
    );

    return {
      url: '/v1/webhook_deliveries',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async handleDomainEvent(event: DomainEventDispatchJob): Promise<number> {
    const endpoints = await this.fastify.webhookRepository.findWebhookEndpoints(
      { status: WebhookEndpointStatusEnum.ENABLED },
      ENDPOINT_SCAN_LIMIT,
    );
    const subscribed = _.filter(endpoints, (endpoint) => {
      return _.includes(endpoint.enabledEvents, event.eventType);
    });

    if (_.isEmpty(subscribed)) {
      return 0;
    }

    const createdAt = this.fastify.clock.now().toISOString();
    const payload: PinstripeEvent = {
      id: event.eventId,
      type: event.eventType,
      createdAt: event.occurredAt,
      data: { object: event.payload },
    };
    const deliveries = await this.fastify.webhookRepository.createWebhookDeliveries(
      _.map(subscribed, (endpoint) => {
        return {
          id: generateGid(ObjectPrefixEnum.WEBHOOK_DELIVERY),
          endpointId: endpoint.id,
          eventId: event.eventId,
          eventType: event.eventType,
          status: WebhookDeliveryStatusEnum.PENDING,
          attemptCount: 0,
          responseStatus: null,
          lastError: null,
          payload,
          deliveredAt: null,
          createdAt,
        };
      }),
    );

    await Promise.all(
      _.map(deliveries, (delivery) => {
        return this.dispatchWebhookDelivery(delivery.id);
      }),
    );

    return deliveries.length;
  }

  private async removeQueuedDelivery(deliveryId: string): Promise<void> {
    const queued = await this.fastify.queues
      .resolve(QueueNameEnum.WEBHOOK)
      .getJob(`webhook-delivery-${deliveryId}`);

    if (queued) {
      await queued.remove();
    }
  }

  private async dispatchWebhookDelivery(deliveryId: string): Promise<Job<WebhookDeliveryJob>> {
    const { webhookMaxAttempts, webhookBackoffMs } = this.fastify.workflowSchedules;

    return this.fastify.queues
      .resolve(QueueNameEnum.WEBHOOK)
      .add(WEBHOOK_DELIVERY_JOB, buildWebhookDeliveryJob(deliveryId), {
        jobId: `webhook-delivery-${deliveryId}`,
        attempts: webhookMaxAttempts,
        backoff: { type: 'exponential', delay: webhookBackoffMs },
        removeOnComplete: true,
      });
  }

  async resolveDeliveryAttempt(deliveryId: string): Promise<WebhookDeliveryAttempt> {
    const delivery = await this.fastify.webhookRepository.getWebhookDelivery(deliveryId);
    const endpoint = await this.fastify.webhookRepository.getWebhookEndpoint(delivery.endpointId);

    await this.assertEndpointWithinRateLimit(endpoint.id);

    const body = JSON.stringify(delivery.payload);

    return {
      endpointUrl: endpoint.url,
      body,
      signature: buildWebhookSignature(body, endpoint.secret, this.fastify.clock.now()),
    };
  }

  private async assertEndpointWithinRateLimit(endpointId: string): Promise<void> {
    const { webhookEndpointRateLimit, webhookEndpointRateWindowSeconds } =
      this.fastify.workflowSchedules;

    const key = this.fastify.redisKeyFactory.build(
      RedisNamespaceEnum.WEBHOOK_RATE_LIMIT,
      endpointId,
    );

    const { isAllowed, resetSeconds } = await consumeRateLimit(this.fastify.redis, key, {
      limit: webhookEndpointRateLimit,
      windowSeconds: webhookEndpointRateWindowSeconds,
    });

    if (isAllowed) {
      return;
    }

    throw new TooManyRequestsError(
      `Webhook endpoint ${endpointId} is over its delivery rate limit; retry in ${resetSeconds} seconds`,
    );
  }

  async recordDeliveryResult(
    deliveryId: string,
    result: { responseStatus: number | null; error: string | null; attemptCount: number },
  ): Promise<void> {
    const isSucceeded = result.error === null;
    const isExhausted = result.attemptCount >= this.fastify.workflowSchedules.webhookMaxAttempts;
    const deliveredAt = isSucceeded ? this.fastify.clock.now().toISOString() : null;

    await this.fastify.webhookRepository.updateWebhookDelivery(deliveryId, {
      status: WebhookService.resolveDeliveryStatus(isSucceeded, isExhausted),
      attemptCount: result.attemptCount,
      responseStatus: result.responseStatus,
      lastError: result.error,
      deliveredAt,
    });
  }

  async replayWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryResponse> {
    const delivery = await this.fastify.webhookRepository.getWebhookDelivery(deliveryId);

    if (delivery.status === WebhookDeliveryStatusEnum.PENDING) {
      throw new ConflictError(`Webhook delivery ${deliveryId} is still being attempted`);
    }

    const replayed = await this.fastify.webhookRepository.updateWebhookDelivery(deliveryId, {
      status: WebhookDeliveryStatusEnum.PENDING,
      attemptCount: 0,
      responseStatus: null,
      lastError: null,
      deliveredAt: null,
    });

    if (!replayed) {
      throw new NotFoundError(`No such webhook delivery: ${deliveryId}`);
    }

    await this.removeQueuedDelivery(deliveryId);
    await this.dispatchWebhookDelivery(deliveryId);

    return replayed;
  }

  private static resolveDeliveryStatus(
    isSucceeded: boolean,
    isExhausted: boolean,
  ): WebhookDeliveryStatus {
    if (isSucceeded) {
      return WebhookDeliveryStatusEnum.SUCCEEDED;
    }

    return isExhausted ? WebhookDeliveryStatusEnum.EXHAUSTED : WebhookDeliveryStatusEnum.FAILED;
  }

  private async resolveEndpointCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const endpoint = await this.fastify.webhookRepository.getWebhookEndpoint(id);

      return { createdAt: endpoint.createdAt, id: endpoint.id };
    }

    return undefined;
  }

  private static buildSecret(): string {
    return `${SECRET_PREFIX}${randomBytes(SECRET_BYTE_LENGTH).toString('hex')}`;
  }

  private static buildEndpoint(
    entity: WebhookEndpoint,
    options: { hasSecret: boolean },
  ): WebhookEndpointResponse {
    return {
      id: entity.id,
      url: entity.url,
      status: entity.status,
      enabledEvents: entity.enabledEvents,
      description: entity.description,
      secret: options.hasSecret ? entity.secret : null,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
