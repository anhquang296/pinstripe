import { MILLISECONDS_PER_DAY } from '@constants/time';
import { MeterAggregationEnum } from '@contracts/meters.types';
import {
  BillingSchemeEnum,
  RecurringIntervalEnum,
  TiersModeEnum,
  UsageTypeEnum,
} from '@contracts/prices.types';
import { BadRequestError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import { LineItemTypeEnum } from '@utils/rating';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const CLOCK_START_DAYS_AGO = 2;
const CLOCK_START = new Date(
  Date.now() - CLOCK_START_DAYS_AGO * MILLISECONDS_PER_DAY,
).toISOString();
const BASE_AMOUNT = 500_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeProduct(): Promise<string> {
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateId(ObjectPrefixEnum.PRODUCT)}`,
  });

  return product.id;
}

async function makeCustomer(): Promise<{ customerId: string; clockId: string }> {
  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateId(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime: CLOCK_START,
  });
  const customer = await fastify.customerService.createCustomer({
    email: `${generateId(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
  });

  return { customerId: customer.id, clockId: clock.id };
}

describe('RatingService.rateUpcomingInvoice', () => {
  it('rates a licensed subscription at the unit amount times its quantity', async () => {
    const { customerId } = await makeCustomer();
    const productId = await makeProduct();
    const price = await fastify.priceService.createPrice({
      productId,
      currency: CurrencyEnum.VND,
      unitAmount: BASE_AMOUNT,
      recurring: { interval: RecurringIntervalEnum.MONTH },
    });
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId: price.id, quantity: 3 }],
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscription.id);

    expect(ratedInvoice.total).toBe(BASE_AMOUNT * 3);
    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([LineItemTypeEnum.SUBSCRIPTION]);
  });

  it('rates a metered subscription from the usage recorded inside the period', async () => {
    const { customerId } = await makeCustomer();
    const productId = await makeProduct();
    const meter = await fastify.meterService.createMeter({
      displayName: 'Rated tokens',
      eventName: `rated_tokens_${generateId(ObjectPrefixEnum.METER)}`,
      aggregation: MeterAggregationEnum.SUM,
      valueKey: 'tokens',
    });
    const price = await fastify.priceService.createPrice({
      productId,
      currency: CurrencyEnum.VND,
      unitAmount: 7,
      meterId: meter.id,
      recurring: { interval: RecurringIntervalEnum.MONTH, usageType: UsageTypeEnum.METERED },
    });
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId: price.id }],
    });

    await fastify.meterEventService.ingestMeterEvent({
      eventName: meter.eventName,
      customerId,
      timestamp: CLOCK_START,
      payload: { tokens: 1_200 },
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscription.id);

    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([LineItemTypeEnum.USAGE]);
    expect(ratedInvoice.total).toBe(1_200 * 7);
  });

  it('rates a metered subscription with no usage as zero', async () => {
    const { customerId } = await makeCustomer();
    const productId = await makeProduct();
    const meter = await fastify.meterService.createMeter({
      displayName: 'Idle tokens',
      eventName: `idle_tokens_${generateId(ObjectPrefixEnum.METER)}`,
      aggregation: MeterAggregationEnum.SUM,
      valueKey: 'tokens',
    });
    const price = await fastify.priceService.createPrice({
      productId,
      currency: CurrencyEnum.VND,
      billingScheme: BillingSchemeEnum.TIERED,
      tiersMode: TiersModeEnum.GRADUATED,
      tiers: [
        { upTo: 1_000, unitAmount: 10 },
        { upTo: null, unitAmount: 4 },
      ],
      meterId: meter.id,
      recurring: { interval: RecurringIntervalEnum.MONTH, usageType: UsageTypeEnum.METERED },
    });
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId: price.id }],
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscription.id);

    expect(ratedInvoice.total).toBe(0);
  });
});

describe('PriceService.createPrice metered shape', () => {
  it('rejects a metered price that names no meter', async () => {
    const productId = await makeProduct();

    const act = async () => {
      return fastify.priceService.createPrice({
        productId,
        currency: CurrencyEnum.VND,
        unitAmount: 7,
        recurring: { interval: RecurringIntervalEnum.MONTH, usageType: UsageTypeEnum.METERED },
      });
    };

    await expect(act()).rejects.toThrow(BadRequestError);
  });

  it('rejects a licensed price that names a meter it will never read', async () => {
    const productId = await makeProduct();
    const meter = await fastify.meterService.createMeter({
      displayName: 'Unused meter',
      eventName: `unused_${generateId(ObjectPrefixEnum.METER)}`,
      aggregation: MeterAggregationEnum.COUNT,
    });

    const act = async () => {
      return fastify.priceService.createPrice({
        productId,
        currency: CurrencyEnum.VND,
        unitAmount: 7,
        meterId: meter.id,
        recurring: { interval: RecurringIntervalEnum.MONTH },
      });
    };

    await expect(act()).rejects.toThrow(BadRequestError);
  });
});
