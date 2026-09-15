import { setTimeout } from 'node:timers/promises';

import { MILLISECONDS_PER_DAY } from '@constants/time';
import type { MeterResponse } from '@contracts/meters.types';
import { MeterAggregationEnum } from '@contracts/meters.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const WATERMARK_SEPARATION_MS = 5;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY).toISOString();
}

const WINDOW_START = daysAgo(20);
const WINDOW_END = daysAgo(-1);
const INSIDE_WINDOW = daysAgo(10);
const BEFORE_WINDOW = daysAgo(30);

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function buildMeter(aggregation: MeterAggregationEnum): Promise<MeterResponse> {
  return fastify.meterService.createMeter({
    displayName: `Meter ${generateId(ObjectPrefixEnum.METER)}`,
    eventName: `api_request_${generateId(ObjectPrefixEnum.METER)}`,
    aggregation,
    valueKey: 'tokens',
  });
}

async function buildCustomer(): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    email: `${generateId(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
  });

  return customer.id;
}

async function ingestEvent(
  meter: MeterResponse,
  customerId: string,
  tokens: number,
  timestamp: string,
  identifier?: string,
) {
  return fastify.meterEventService.ingestMeterEvent({
    eventName: meter.eventName,
    customerId,
    identifier,
    timestamp,
    payload: { tokens },
  });
}

describe('MeterEventService.ingestMeterEvent', () => {
  it('stores an event once no matter how many times the same identifier arrives', async () => {
    const meter = await buildMeter(MeterAggregationEnum.SUM);
    const customerId = await buildCustomer();
    const identifier = generateId(ObjectPrefixEnum.METER_EVENT);

    await ingestEvent(meter, customerId, 10, INSIDE_WINDOW, identifier);
    await ingestEvent(meter, customerId, 10, INSIDE_WINDOW, identifier);
    await ingestEvent(meter, customerId, 10, INSIDE_WINDOW, identifier);

    const summary = await fastify.meterEventService.getMeterEventSummary(meter.id, {
      customerId,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });

    expect(summary.eventCount).toBe(1);
    expect(summary.value).toBe(10);
  });

  it('refuses an event whose value key is missing from the payload', async () => {
    const meter = await buildMeter(MeterAggregationEnum.SUM);
    const customerId = await buildCustomer();

    const act = fastify.meterEventService.ingestMeterEvent({
      eventName: meter.eventName,
      customerId,
      payload: { somethingElse: 3 },
    });

    await expect(act).rejects.toThrowError(BadRequestError);
  });

  it('refuses an event older than the deduplication window, because it can no longer be deduplicated', async () => {
    const meter = await buildMeter(MeterAggregationEnum.SUM);
    const customerId = await buildCustomer();
    const tooOld = new Date(Date.now() - 40 * MILLISECONDS_PER_DAY).toISOString();

    const act = ingestEvent(meter, customerId, 1, tooOld);

    await expect(act).rejects.toThrowError(BadRequestError);
  });
});

describe('MeterService.createMeter', () => {
  it('refuses a second meter listening for the same event name', async () => {
    const meter = await buildMeter(MeterAggregationEnum.COUNT);

    const act = fastify.meterService.createMeter({
      displayName: 'Duplicate listener',
      eventName: meter.eventName,
      aggregation: MeterAggregationEnum.COUNT,
    });

    await expect(act).rejects.toThrowError(ConflictError);
  });
});

describe('MeterEventService.getMeterEventSummary', () => {
  it('aggregates the way the meter says, over the same events', async () => {
    const customerId = await buildCustomer();
    const values = [5, 3, 9, 3];
    const summaries = [];

    for (const aggregation of [
      MeterAggregationEnum.SUM,
      MeterAggregationEnum.COUNT,
      MeterAggregationEnum.MAX,
      MeterAggregationEnum.UNIQUE_COUNT,
    ]) {
      const meter = await buildMeter(aggregation);

      for (const value of values) {
        await ingestEvent(meter, customerId, value, INSIDE_WINDOW);
      }

      summaries.push(
        await fastify.meterEventService.getMeterEventSummary(meter.id, {
          customerId,
          windowStart: WINDOW_START,
          windowEnd: WINDOW_END,
        }),
      );
    }

    expect(_.map(summaries, 'value')).toEqual([20, 4, 9, 3]);
  });

  it('counts only events whose timestamp falls inside the window', async () => {
    const meter = await buildMeter(MeterAggregationEnum.SUM);
    const customerId = await buildCustomer();

    await ingestEvent(meter, customerId, 7, INSIDE_WINDOW);
    await ingestEvent(meter, customerId, 100, BEFORE_WINDOW);

    const summary = await fastify.meterEventService.getMeterEventSummary(meter.id, {
      customerId,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });

    expect(summary.value).toBe(7);
  });

  it('leaves a closed period alone when a late event arrives, and bills it in the next one', async () => {
    const meter = await buildMeter(MeterAggregationEnum.SUM);
    const customerId = await buildCustomer();

    const onTimeEvent = await ingestEvent(meter, customerId, 40, INSIDE_WINDOW);
    const closedAt = onTimeEvent.receivedAt;

    await setTimeout(WATERMARK_SEPARATION_MS);
    await ingestEvent(meter, customerId, 60, daysAgo(5));

    const closedPeriod = await fastify.meterEventService.getMeterEventSummary(meter.id, {
      customerId,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      receivedBefore: closedAt,
    });
    const stragglers = await fastify.meterEventService.getMeterEventSummary(meter.id, {
      customerId,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      receivedAfter: closedAt,
    });

    expect(closedPeriod.value).toBe(40);
    expect(stragglers.value).toBe(60);
  });

  it('refuses a window that ends before it starts', async () => {
    const meter = await buildMeter(MeterAggregationEnum.SUM);
    const customerId = await buildCustomer();

    const act = fastify.meterEventService.getMeterEventSummary(meter.id, {
      customerId,
      windowStart: WINDOW_END,
      windowEnd: WINDOW_START,
    });

    await expect(act).rejects.toThrowError(BadRequestError);
  });
});

describe('meter_events table', () => {
  it('cannot be updated, because raw usage is what makes backfill possible', async () => {
    const meter = await buildMeter(MeterAggregationEnum.SUM);
    const customerId = await buildCustomer();
    const event = await ingestEvent(meter, customerId, 12, INSIDE_WINDOW);

    const act = fastify.database.master.execute(
      sql`update meter_events set value = 1 where id = ${event.id}`,
    );

    await expect(act).rejects.toThrowError(/append-only/);
  });
});
