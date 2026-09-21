import type { CreateMeterEventPayload } from '@vxrerp/billing/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

import { TICKET_EVENT_NAME, ZNS_EVENT_NAME } from './demo-catalog';
import { CURRENT_USAGE_SPREAD_DAYS, MILLISECONDS_PER_DAY } from './demo-history';
import type { SeededOperator } from './seed-demo.types';

const USAGE_BATCH_COUNT = 14;

export async function seedUsage(
  fastify: FastifyInstance,
  operators: readonly SeededOperator[],
): Promise<number> {
  const now = fastify.clock.now();
  const payloads: CreateMeterEventPayload[] = [];

  for (const { operator, customerId } of operators) {
    payloads.push(
      ...buildUsageEvents(TICKET_EVENT_NAME, operator.ticketsPerMonth, customerId, now),
      ...buildUsageEvents(ZNS_EVENT_NAME, operator.znsPerMonth, customerId, now),
    );
  }

  if (_.isEmpty(payloads)) {
    return 0;
  }

  const ingestion = await fastify.meterEventService.ingestMeterEventBatch({ events: payloads });

  return ingestion.accepted;
}

function buildUsageEvents(
  eventName: string,
  monthlyTotal: number,
  customerId: string,
  now: Date,
): CreateMeterEventPayload[] {
  if (monthlyTotal <= 0) {
    return [];
  }

  const perBatch = Math.floor(monthlyTotal / USAGE_BATCH_COUNT);
  const remainder = monthlyTotal - perBatch * USAGE_BATCH_COUNT;
  const spreadMs = CURRENT_USAGE_SPREAD_DAYS * MILLISECONDS_PER_DAY;
  const stepMs = spreadMs / USAGE_BATCH_COUNT;

  return _.times(USAGE_BATCH_COUNT, (index) => {
    const quantity = index === 0 ? perBatch + remainder : perBatch;
    const occurredAt = new Date(now.getTime() - spreadMs + stepMs * index);

    return {
      eventName,
      customerId,
      identifier: `seed-${eventName}-${customerId}-${index}`,
      timestamp: occurredAt.toISOString(),
      value: quantity,
      payload: { quantity: String(quantity) },
    };
  });
}
