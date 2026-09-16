import { randomBytes } from 'node:crypto';

import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateWebhookEndpointPayload,
  GetWebhookDeliveriesQuery,
  GetWebhookEndpointsQuery,
  UpdateWebhookEndpointPayload,
  WebhookDeliveryResponse,
  WebhookEndpointResponse,
} from '@contracts/webhooks.types';
import { WebhookDeliveryStatusEnum, WebhookEndpointStatusEnum } from '@contracts/webhooks.types';
import type { WebhookDelivery, WebhookEndpoint } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { DomainEventDispatchJob } from '@queues/domain-event.queue';
import { QueueNameEnum } from '@queues/queue-name';
import type { WebhookDeliveryJob } from '@queues/webhook.queue';
import { buildWebhookDeliveryJob, WEBHOOK_DELIVERY_JOB } from '@queues/webhook.queue';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
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
    const now = this.fastify.clock.now();
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

    if (!createdEndpoint) {
      throw new NotFoundError(`Webhook endpoint ${id} could not be created`);
    }

    return WebhookService.buildEndpoint(createdEndpoint, { hasSecret: true });
  }

  async updateWebhookEndpoint(
    id: string,
    payload: UpdateWebhookEndpointPayload,
  ): Promise<WebhookEndpointResponse> {
    await this.getWebhookEndpointEntity(id);

    const updatedEndpoint = await this.fastify.webhookRepository.updateWebhookEndpoint(id, {
      status: payload.status,
      enabledEvents: payload.enabledEvents ? [...payload.enabledEvents] : undefined,
      description: payload.description,
      metadata: payload.metadata,
      updatedAt: this.fastify.clock.now(),
    });

    if (!updatedEndpoint) {
      throw new NotFoundError(`No such webhook endpoint: ${id}`);
    }

    return WebhookService.buildEndpoint(updatedEndpoint, { hasSecret: false });
  }

  async getWebhookEndpoint(id: string): Promise<WebhookEndpointResponse> {
    const endpoint = await this.getWebhookEndpointEntity(id);

    return WebhookService.buildEndpoint(endpoint, { hasSecret: false });
  }

  async findWebhookEndpoints(
    query: GetWebhookEndpointsQuery,
  ): Promise<ListResponse<WebhookEndpointResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveEndpointCursor(query.startingAfter);
    const afterAt = await this.resolveEndpointCursor(query.endingBefore);
    const rows = await this.fastify.webhookRepository.findWebhookEndpoints(
      { status: query.status, beforeAt, afterAt },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/webhook_endpoints',
      hasMore: rows.length > limit,
      data: _.map(_.take(rows, limit), (endpoint) => {
        return WebhookService.buildEndpoint(endpoint, { hasSecret: false });
      }),
    };
  }

  async findWebhookDeliveries(
    query: GetWebhookDeliveriesQuery,
  ): Promise<ListResponse<WebhookDeliveryResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const rows = await this.fastify.webhookRepository.findWebhookDeliveries(
      { endpointId: query.endpointId, status: query.status },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/webhook_deliveries',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(WebhookService.buildDelivery).value(),
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

    const now = this.fastify.clock.now();
    const payload = {
      id: event.eventId,
      object: 'event',
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
          createdAt: now,
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
    const delivery = await this.fastify.webhookRepository.findWebhookDelivery(deliveryId);

    if (!delivery) {
      throw new NotFoundError(`No such webhook delivery: ${deliveryId}`);
    }

    const endpoint = await this.getWebhookEndpointEntity(delivery.endpointId);
    const body = JSON.stringify(delivery.payload);

    return {
      endpointUrl: endpoint.url,
      body,
      signature: buildWebhookSignature(body, endpoint.secret, this.fastify.clock.now()),
    };
  }

  async recordDeliveryResult(
    deliveryId: string,
    result: { responseStatus: number | null; error: string | null; attemptCount: number },
  ): Promise<void> {
    const isSucceeded = result.error === null;

    await this.fastify.webhookRepository.updateWebhookDelivery(deliveryId, {
      status: isSucceeded ? WebhookDeliveryStatusEnum.SUCCEEDED : WebhookDeliveryStatusEnum.FAILED,
      attemptCount: result.attemptCount,
      responseStatus: result.responseStatus,
      lastError: result.error,
      deliveredAt: isSucceeded ? this.fastify.clock.now() : null,
    });
  }

  private async getWebhookEndpointEntity(id: string): Promise<WebhookEndpoint> {
    const endpoint = await this.fastify.webhookRepository.findWebhookEndpoint(id);

    if (endpoint) {
      return endpoint;
    }

    throw new NotFoundError(`No such webhook endpoint: ${id}`);
  }

  private async resolveEndpointCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (!id) {
      return undefined;
    }

    const endpoint = await this.getWebhookEndpointEntity(id);

    return { createdAt: endpoint.createdAt, id: endpoint.id };
  }

  private static buildSecret(): string {
    return `${SECRET_PREFIX}${randomBytes(SECRET_BYTE_LENGTH).toString('hex')}`;
  }

  private static buildEndpoint(
    entity: WebhookEndpoint,
    options: { hasSecret: boolean },
  ): WebhookEndpointResponse {
    return {
      object: 'webhook_endpoint',
      id: entity.id,
      url: entity.url,
      status: entity.status,
      enabledEvents: entity.enabledEvents,
      description: entity.description,
      secret: options.hasSecret ? entity.secret : null,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private static buildDelivery(entity: WebhookDelivery): WebhookDeliveryResponse {
    return {
      object: 'webhook_delivery',
      id: entity.id,
      endpointId: entity.endpointId,
      eventId: entity.eventId,
      eventType: entity.eventType,
      status: entity.status,
      attemptCount: entity.attemptCount,
      responseStatus: entity.responseStatus,
      lastError: entity.lastError,
      deliveredAt: entity.deliveredAt ? entity.deliveredAt.toISOString() : null,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
