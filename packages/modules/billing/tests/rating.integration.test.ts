import { MeterAggregationEnum } from '@contracts/meters.types';
import {
  BillingSchemeEnum,
  RecurringIntervalEnum,
  TiersModeEnum,
  UsageTypeEnum,
} from '@contracts/prices.types';
import { BillingModeEnum, ProrationBehaviorEnum } from '@contracts/subscriptions.types';
import { CurrencyEnum } from '@utils/currency';
import { LineItemTypeEnum } from '@utils/rating';
import { MILLISECONDS_PER_DAY } from '@vxrerp/platform/constants';
import { BadRequestError } from '@vxrerp/platform/errors';
import { generateGid, ObjectPrefixEnum } from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const CLOCK_START_DAYS_AGO = 2;

const CLOCK_START = new Date(
  Date.now() - CLOCK_START_DAYS_AGO * MILLISECONDS_PER_DAY,
).toISOString();

const BASE_AMOUNT = 500_000;
const SWAP_MID_CLOCK = new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString();
const SWAP_PERIOD_START = '2026-03-01T00:00:00.000Z';
const SWAP_MID_PERIOD = '2026-03-16T12:00:00.000Z';
const OLD_AMOUNT = 62_000;
const NEW_AMOUNT = 124_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeProduct(): Promise<string> {
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });

  return product.id;
}

async function makeCustomer(): Promise<{ customerId: string; clockId: string }> {
  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime: CLOCK_START,
  });

  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
  });

  return { customerId: customer.id, clockId: clock.id };
}

async function makeMeteredPrice(): Promise<{ priceId: string; eventName: string }> {
  const productId = await makeProduct();

  const meter = await fastify.meterService.createMeter({
    displayName: 'Swapped tokens',
    eventName: `swapped_tokens_${generateGid(ObjectPrefixEnum.METER)}`,
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

  return { priceId: price.id, eventName: meter.eventName };
}

interface SwapScenario {
  customerId: string;
  clockId: string;
  subscriptionId: string;
  oldPriceId: string;
  newPriceId: string;
}

async function makeSwapScenario(): Promise<SwapScenario> {
  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime: SWAP_PERIOD_START,
  });

  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
  });

  const productId = await makeProduct();

  const oldPrice = await fastify.priceService.createPrice({
    productId,
    currency: CurrencyEnum.VND,
    unitAmount: OLD_AMOUNT,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  const newPrice = await fastify.priceService.createPrice({
    productId,
    currency: CurrencyEnum.VND,
    unitAmount: NEW_AMOUNT,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  const subscription = await fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId: oldPrice.id }],
    billingMode: BillingModeEnum.ARREARS,
  });

  return {
    customerId: customer.id,
    clockId: clock.id,
    subscriptionId: subscription.id,
    oldPriceId: oldPrice.id,
    newPriceId: newPrice.id,
  };
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
      eventName: `rated_tokens_${generateGid(ObjectPrefixEnum.METER)}`,
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
      eventName: `idle_tokens_${generateGid(ObjectPrefixEnum.METER)}`,
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
      eventName: `unused_${generateGid(ObjectPrefixEnum.METER)}`,
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

describe('RatingService proration', () => {
  it('bills the removed item for its elapsed slice and the replacement for the remainder', async () => {
    const { clockId, subscriptionId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_PERIOD });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.CREATE_PRORATIONS,
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([
      LineItemTypeEnum.PRORATION,
      LineItemTypeEnum.PRORATION,
    ]);
    expect(_.map(ratedInvoice.lineItems, 'amount')).toEqual([OLD_AMOUNT / 2, NEW_AMOUNT / 2]);
    expect(ratedInvoice.total).toBe(OLD_AMOUNT / 2 + NEW_AMOUNT / 2);
  });

  it('bills the replacement for the whole period and the removed item for nothing without proration', async () => {
    const { clockId, subscriptionId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_PERIOD });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.NONE,
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([LineItemTypeEnum.SUBSCRIPTION]);
    expect(ratedInvoice.total).toBe(NEW_AMOUNT);
  });

  it('splits the period into three slices when the subscription is swapped twice', async () => {
    const { clockId, subscriptionId, oldPriceId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: '2026-03-11T00:00:00.000Z',
    });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
    });
    await fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: '2026-03-21T00:00:00.000Z',
    });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: oldPriceId }],
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([
      LineItemTypeEnum.PRORATION,
      LineItemTypeEnum.PRORATION,
      LineItemTypeEnum.PRORATION,
    ]);
    expect(ratedInvoice.total).toBe(20_000 + 40_000 + 22_000);
  });

  it('bills nothing for an item added and removed inside one period without proration', async () => {
    const { clockId, subscriptionId, oldPriceId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: '2026-03-11T00:00:00.000Z',
    });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.NONE,
    });
    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_PERIOD });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: oldPriceId }],
      prorationBehavior: ProrationBehaviorEnum.NONE,
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([LineItemTypeEnum.SUBSCRIPTION]);
    expect(ratedInvoice.total).toBe(OLD_AMOUNT);
  });

  it('keeps a metered line at a proration factor of one so usage is never divided twice', async () => {
    const { customerId, clockId } = await makeCustomer();

    const meteredPrice = await makeMeteredPrice();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId: meteredPrice.priceId }],
    });

    await fastify.meterEventService.ingestMeterEvent({
      eventName: meteredPrice.eventName,
      customerId,
      timestamp: CLOCK_START,
      payload: { tokens: 100 },
    });
    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscription.id, {
      items: [{ priceId: meteredPrice.priceId, quantity: 2 }],
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscription.id);
    const usageLineItems = _.filter(ratedInvoice.lineItems, { type: LineItemTypeEnum.USAGE });

    expect(_.map(usageLineItems, 'prorationFactor')).toEqual([1, 1]);
    expect(ratedInvoice.total).toBe(100 * 7);
  });

  it('drops the removed metered item usage when the replacement measures a different meter', async () => {
    const { customerId, clockId } = await makeCustomer();

    const oldMeteredPrice = await makeMeteredPrice();
    const newMeteredPrice = await makeMeteredPrice();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId: oldMeteredPrice.priceId }],
    });

    await fastify.meterEventService.ingestMeterEvent({
      eventName: oldMeteredPrice.eventName,
      customerId,
      timestamp: CLOCK_START,
      payload: { tokens: 100 },
    });
    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscription.id, {
      items: [{ priceId: newMeteredPrice.priceId }],
      prorationBehavior: ProrationBehaviorEnum.NONE,
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscription.id);

    expect(ratedInvoice.lineItems).toHaveLength(1);
    expect(ratedInvoice.total).toBe(0);
  });
});

describe('RatingService.rateProrationInvoice', () => {
  it('rates only the window that closed inside the period', async () => {
    const { clockId, subscriptionId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_PERIOD });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
    });

    const ratedInvoice = await fastify.ratingService.rateProrationInvoice(subscriptionId);

    expect(ratedInvoice.lineItems).toHaveLength(1);
    expect(ratedInvoice.total).toBe(OLD_AMOUNT / 2);
  });

  it('rates no line items when every item is still live', async () => {
    const { subscriptionId } = await makeSwapScenario();

    const ratedInvoice = await fastify.ratingService.rateProrationInvoice(subscriptionId);

    expect(ratedInvoice.lineItems).toEqual([]);
    expect(ratedInvoice.total).toBe(0);
  });
});
