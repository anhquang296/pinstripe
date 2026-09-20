import { MILLISECONDS_PER_DAY } from '@constants/time';
import type { CreateMeterEventPayload, MeterResponse } from '@contracts/meters.types';
import { MeterAggregationEnum } from '@contracts/meters.types';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const TOTAL_EVENTS = 100_000;
const DUPLICATE_RATE = 10;
const BATCH_SIZE = 1_000;
const TOKENS_PER_EVENT = 3;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

function buildEvents(meter: MeterResponse, customerId: string): CreateMeterEventPayload[] {
  const timestamp = new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString();

  return _.times(TOTAL_EVENTS, (index) => {
    const isDuplicate = index % DUPLICATE_RATE === 0 && index > 0;
    const identifierIndex = isDuplicate ? index - 1 : index;

    return {
      eventName: meter.eventName,
      customerId,
      identifier: `ingest-${customerId}-${identifierIndex}`,
      timestamp,
      payload: { tokens: TOKENS_PER_EVENT },
    };
  });
}

describe('MeterEventService.ingestMeterEventBatch', () => {
  it('drops every repeated identifier and still totals exactly what it accepted', async () => {
    const meter = await fastify.meterService.createMeter({
      displayName: 'Ingestion volume',
      eventName: `ingest_volume_${generateGid(ObjectPrefixEnum.METER)}`,
      aggregation: MeterAggregationEnum.SUM,
      valueKey: 'tokens',
    });

    const customer = await fastify.customerService.createCustomer({
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
    });

    const events = buildEvents(meter, customer.id);

    const expectedDuplicates = _.filter(events, (_event, index) => {
      return index % DUPLICATE_RATE === 0 && index > 0;
    }).length;

    let accepted = 0;
    let duplicates = 0;

    for (const batch of _.chunk(events, BATCH_SIZE)) {
      const batchResult = await fastify.meterEventService.ingestMeterEventBatch({ events: batch });

      accepted += batchResult.accepted;
      duplicates += batchResult.duplicates;
    }

    const summary = await fastify.meterEventService.getMeterEventSummary(meter.id, {
      customerId: customer.id,
      windowStart: new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString(),
      windowEnd: new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString(),
    });

    expect(duplicates).toBe(expectedDuplicates);
    expect(accepted).toBe(TOTAL_EVENTS - expectedDuplicates);
    expect(summary.eventCount).toBe(accepted);
    expect(summary.value).toBe(accepted * TOKENS_PER_EVENT);
  });
});
