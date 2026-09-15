import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum MeterAggregationEnum {
  SUM = 'sum',
  COUNT = 'count',
  MAX = 'max',
  UNIQUE_COUNT = 'unique_count',
}
export type MeterAggregation = `${MeterAggregationEnum}`;

export enum MeterStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
export type MeterStatus = `${MeterStatusEnum}`;

export const meterSchema = Type.Object({
  object: Type.Literal('meter'),
  id: Type.String(),
  displayName: Type.String(),
  eventName: Type.String(),
  aggregation: Type.Unsafe<MeterAggregation>(Type.Enum(MeterAggregationEnum)),
  valueKey: Type.String(),
  status: Type.Unsafe<MeterStatus>(Type.Enum(MeterStatusEnum)),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const meterParamsSchema = Type.Object({
  meterId: Type.String(),
});

export const createMeterSchema = Type.Object(
  {
    displayName: Type.String({ minLength: 1 }),
    eventName: Type.String({ minLength: 1, maxLength: 100 }),
    aggregation: Type.Unsafe<MeterAggregation>(Type.Enum(MeterAggregationEnum)),
    valueKey: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateMeterSchema = Type.Object(
  {
    displayName: Type.Optional(Type.String({ minLength: 1 })),
    status: Type.Optional(Type.Unsafe<MeterStatus>(Type.Enum(MeterStatusEnum))),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const getMetersSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<MeterStatus>(Type.Enum(MeterStatusEnum))),
  },
  { additionalProperties: false },
);

export const meterEventSchema = Type.Object({
  object: Type.Literal('meter_event'),
  id: Type.String(),
  identifier: Type.String(),
  meterId: Type.String(),
  customerId: Type.String(),
  eventName: Type.String(),
  value: Type.Number(),
  payload: Type.Record(Type.String(), Type.Unknown()),
  timestamp: Type.String(),
  receivedAt: Type.String(),
});

export const createMeterEventSchema = Type.Object(
  {
    eventName: Type.String({ minLength: 1 }),
    customerId: Type.String({ minLength: 1 }),
    identifier: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    timestamp: Type.Optional(Type.String({ format: 'date-time' })),
    payload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    value: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const createMeterEventBatchSchema = Type.Object(
  {
    events: Type.Array(createMeterEventSchema, { minItems: 1, maxItems: 1000 }),
  },
  { additionalProperties: false },
);

export const meterEventBatchResultSchema = Type.Object({
  object: Type.Literal('meter_event_batch'),
  accepted: Type.Integer(),
  duplicates: Type.Integer(),
});

export const meterEventSummarySchema = Type.Object({
  object: Type.Literal('meter_event_summary'),
  meterId: Type.String(),
  customerId: Type.String(),
  aggregation: Type.Unsafe<MeterAggregation>(Type.Enum(MeterAggregationEnum)),
  value: Type.Number(),
  eventCount: Type.Integer(),
  windowStart: Type.String(),
  windowEnd: Type.String(),
});

export const getMeterEventSummariesSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    windowStart: Type.String({ format: 'date-time' }),
    windowEnd: Type.String({ format: 'date-time' }),
    receivedBefore: Type.Optional(Type.String({ format: 'date-time' })),
    receivedAfter: Type.Optional(Type.String({ format: 'date-time' })),
  },
  { additionalProperties: false },
);

export type MeterResponse = Static<typeof meterSchema>;
export type MeterEventResponse = Static<typeof meterEventSchema>;
export type MeterEventBatchResultResponse = Static<typeof meterEventBatchResultSchema>;
export type MeterEventSummaryResponse = Static<typeof meterEventSummarySchema>;
export type CreateMeterPayload = Static<typeof createMeterSchema>;
export type UpdateMeterPayload = Static<typeof updateMeterSchema>;
export type GetMetersQuery = Static<typeof getMetersSchema>;
export type CreateMeterEventPayload = Static<typeof createMeterEventSchema>;
export type CreateMeterEventBatchPayload = Static<typeof createMeterEventBatchSchema>;
export type GetMeterEventSummariesQuery = Static<typeof getMeterEventSummariesSchema>;
