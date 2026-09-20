import type { DomainEventType } from '@contracts/events.types';
import { DomainEventTypeEnum } from '@contracts/events.types';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum WebhookEndpointStatusEnum {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
}
export type WebhookEndpointStatus = `${WebhookEndpointStatusEnum}`;

export enum WebhookDeliveryStatusEnum {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  EXHAUSTED = 'exhausted',
}
export type WebhookDeliveryStatus = `${WebhookDeliveryStatusEnum}`;

export const webhookEndpointSchema = Type.Object({
  id: Type.String(),
  url: Type.String(),
  status: Type.Unsafe<WebhookEndpointStatus>(Type.Enum(WebhookEndpointStatusEnum)),
  enabledEvents: Type.Array(Type.String()),
  description: Type.String(),
  secret: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const webhookDeliverySchema = Type.Object({
  id: Type.String(),
  endpointId: Type.String(),
  eventId: Type.String(),
  eventType: Type.String(),
  status: Type.Unsafe<WebhookDeliveryStatus>(Type.Enum(WebhookDeliveryStatusEnum)),
  attemptCount: Type.Integer(),
  responseStatus: Type.Union([Type.Integer(), Type.Null()]),
  lastError: Type.Union([Type.String(), Type.Null()]),
  deliveredAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const webhookEndpointParamsSchema = Type.Object({
  webhookEndpointId: Type.String(),
});

export const createWebhookEndpointSchema = Type.Object(
  {
    url: Type.String({ format: 'uri', minLength: 1 }),
    enabledEvents: Type.Array(Type.Unsafe<string>(Type.Enum(DomainEventTypeEnum)), { minItems: 1 }),
    description: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateWebhookEndpointSchema = Type.Object(
  {
    status: Type.Optional(Type.Unsafe<WebhookEndpointStatus>(Type.Enum(WebhookEndpointStatusEnum))),
    enabledEvents: Type.Optional(
      Type.Array(Type.Unsafe<string>(Type.Enum(DomainEventTypeEnum)), { minItems: 1 }),
    ),
    description: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findWebhookEndpointsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<WebhookEndpointStatus>(Type.Enum(WebhookEndpointStatusEnum))),
  },
  { additionalProperties: false },
);

export const webhookDeliveryParamsSchema = Type.Object({
  webhookDeliveryId: Type.String(),
});

export const findWebhookDeliveriesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    after: Type.Optional(Type.String()),
    before: Type.Optional(Type.String()),
    endpointId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<WebhookDeliveryStatus>(Type.Enum(WebhookDeliveryStatusEnum))),
  },
  { additionalProperties: false },
);

export type PinstripeEvent<T = unknown> = {
  id: string;
  type: DomainEventType;
  createdAt: string;
  data: { object: T };
};

export type WebhookEndpointResponse = Static<typeof webhookEndpointSchema>;
export type WebhookDeliveryResponse = Static<typeof webhookDeliverySchema>;
export type CreateWebhookEndpointPayload = Static<typeof createWebhookEndpointSchema>;
export type UpdateWebhookEndpointPayload = Static<typeof updateWebhookEndpointSchema>;
export type FindWebhookEndpointsQuery = Static<typeof findWebhookEndpointsSchema>;
export type FindWebhookDeliveriesQuery = Static<typeof findWebhookDeliveriesSchema>;
