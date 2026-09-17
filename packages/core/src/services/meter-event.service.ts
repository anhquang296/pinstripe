import { MILLISECONDS_PER_DAY } from '@constants/time';
import type {
  CreateMeterEventBatchPayload,
  CreateMeterEventPayload,
  GetMeterEventSummariesQuery,
  MeterEventBatchResultResponse,
  MeterEventResponse,
  MeterEventSummaryResponse,
} from '@contracts/meters.types';
import { MeterAggregationEnum } from '@contracts/meters.types';
import type { Meter, NewMeterEvent } from '@database/schemas';
import { BadRequestError, NotFoundError } from '@errors/app.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { RedisNamespaceEnum } from '@utils/redis-key-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export interface MeterEventServiceConfig {
  dedupWindowDays: number;
}

export class MeterEventService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: MeterEventServiceConfig,
  ) {}

  async ingestMeterEvent(payload: CreateMeterEventPayload): Promise<MeterEventResponse> {
    const meter = await this.fastify.meterService.resolveMeter(payload.eventName);
    const receivedAt = this.fastify.clock.now();
    const event = this.buildMeterEvent(meter, payload, receivedAt);
    const isKnown = await this.isIdentifierKnown(meter.id, event.identifier);

    if (isKnown) {
      return MeterEventService.buildMeterEvent(event);
    }

    const insertedIds = await this.fastify.meterEventRepository.createMeterEvents([event]);

    await this.rememberIdentifiers(_.isEmpty(insertedIds) ? [] : [event]);

    return MeterEventService.buildMeterEvent(event);
  }

  async ingestMeterEventBatch(
    payload: CreateMeterEventBatchPayload,
  ): Promise<MeterEventBatchResultResponse> {
    const receivedAt = this.fastify.clock.now();
    const eventNames = _.uniq(_.map(payload.events, 'eventName'));
    const meters = await Promise.all(
      _.map(eventNames, (eventName) => {
        return this.fastify.meterService.resolveMeter(eventName);
      }),
    );
    const metersByEventName = _.keyBy(meters, 'eventName');

    const events = _.map(payload.events, (event) => {
      const meter = metersByEventName[event.eventName];

      if (meter) {
        return this.buildMeterEvent(meter, event, receivedAt);
      }

      throw new NotFoundError(`No active meter listens for event ${event.eventName}`);
    });
    const unknownEvents = await this.rejectKnownEvents(events);
    const insertedIds = await this.fastify.meterEventRepository.createMeterEvents(unknownEvents);
    const insertedIdSet = new Set(insertedIds);

    await this.rememberIdentifiers(
      _.filter(unknownEvents, (event) => {
        return insertedIdSet.has(event.id);
      }),
    );

    return {
      object: 'meter_event_batch',
      accepted: insertedIds.length,
      duplicates: events.length - insertedIds.length,
    };
  }

  async getMeterEventSummary(
    meterId: string,
    query: GetMeterEventSummariesQuery,
  ): Promise<MeterEventSummaryResponse> {
    const meter = await this.getMeter(meterId);

    const windowStart = new Date(query.windowStart);
    const windowEnd = new Date(query.windowEnd);

    if (windowEnd.getTime() <= windowStart.getTime()) {
      throw new BadRequestError('windowEnd must be after windowStart', { param: 'windowEnd' });
    }

    const totals = await this.fastify.meterEventRepository.aggregateMeterEventTotals(
      meter.aggregation,
      {
        meterId,
        customerId: query.customerId,
        timestampFrom: windowStart,
        timestampTo: windowEnd,
        receivedBefore: query.receivedBefore ? new Date(query.receivedBefore) : undefined,
        receivedAfter: query.receivedAfter ? new Date(query.receivedAfter) : undefined,
      },
    );

    return {
      object: 'meter_event_summary',
      meterId,
      customerId: query.customerId,
      aggregation: meter.aggregation,
      value: totals.value,
      eventCount: totals.eventCount,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    };
  }

  private async getMeter(meterId: string): Promise<Meter> {
    const meter = await this.fastify.meterRepository.findMeter(meterId);

    if (meter) {
      return meter;
    }

    throw new NotFoundError(`No such meter: ${meterId}`);
  }

  private buildMeterEvent(
    meter: Meter,
    payload: CreateMeterEventPayload,
    receivedAt: Date,
  ): NewMeterEvent {
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : receivedAt;

    MeterEventService.assertWithinWindow(timestamp, receivedAt, this.config.dedupWindowDays);

    return {
      id: generateGid(ObjectPrefixEnum.METER_EVENT),
      livemode: meter.livemode,
      identifier: payload.identifier ?? generateGid(ObjectPrefixEnum.METER_EVENT),
      meterId: meter.id,
      customerId: payload.customerId,
      eventName: payload.eventName,
      value: MeterEventService.resolveValue(meter, payload),
      payload: payload.payload ?? {},
      timestamp,
      receivedAt,
    };
  }

  private buildDedupKey(meterId: string, identifier: string): string {
    return this.fastify.redisKeyFactory.build(RedisNamespaceEnum.METER_DEDUP, meterId, identifier);
  }

  private async isIdentifierKnown(meterId: string, identifier: string): Promise<boolean> {
    const knownCount = await this.fastify.redis.exists(this.buildDedupKey(meterId, identifier));

    return knownCount > 0;
  }

  private async rejectKnownEvents(events: readonly NewMeterEvent[]): Promise<NewMeterEvent[]> {
    if (_.isEmpty(events)) {
      return [];
    }

    const keys = _.map(events, (event) => {
      return this.buildDedupKey(event.meterId, event.identifier);
    });
    const knownValues = await this.fastify.redis.mget(keys);

    return _.filter(events, (_event, index) => {
      return knownValues[index] === null;
    });
  }

  private async rememberIdentifiers(events: readonly NewMeterEvent[]): Promise<void> {
    if (_.isEmpty(events)) {
      return;
    }

    const windowSeconds = Math.floor((this.config.dedupWindowDays * MILLISECONDS_PER_DAY) / 1000);
    const pipeline = this.fastify.redis.pipeline();

    for (const event of events) {
      pipeline.set(this.buildDedupKey(event.meterId, event.identifier), '1', 'EX', windowSeconds);
    }

    await pipeline.exec();
  }

  private static assertWithinWindow(
    timestamp: Date,
    receivedAt: Date,
    dedupWindowDays: number,
  ): void {
    const oldestAccepted = receivedAt.getTime() - dedupWindowDays * MILLISECONDS_PER_DAY;

    if (timestamp.getTime() >= oldestAccepted) {
      return;
    }

    throw new BadRequestError(
      `timestamp is older than the ${dedupWindowDays} day deduplication window and cannot be deduplicated`,
      { param: 'timestamp' },
    );
  }

  private static resolveValue(meter: Meter, payload: CreateMeterEventPayload): number {
    if (meter.aggregation === MeterAggregationEnum.COUNT) {
      return 1;
    }

    const rawValue = payload.value ?? _.get(payload.payload, meter.valueKey);

    if (_.isFinite(rawValue)) {
      return Number(rawValue);
    }

    throw new BadRequestError(
      `Meter ${meter.id} aggregates ${meter.aggregation} over "${meter.valueKey}", which is missing from this event`,
      { param: 'payload' },
    );
  }

  private static buildMeterEvent(event: NewMeterEvent): MeterEventResponse {
    return {
      object: 'meter_event',
      id: event.id,
      identifier: event.identifier,
      meterId: event.meterId,
      customerId: event.customerId,
      eventName: event.eventName,
      value: event.value,
      payload: event.payload ?? {},
      timestamp: event.timestamp.toISOString(),
      receivedAt: event.receivedAt.toISOString(),
    };
  }
}
