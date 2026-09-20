import { MILLISECONDS_PER_DAY } from '@constants/time';
import { BillingReasonEnum, InvoiceStatusEnum } from '@contracts/invoices.types';
import { MeterAggregationEnum } from '@contracts/meters.types';
import { RecurringIntervalEnum, UsageTypeEnum } from '@contracts/prices.types';
import { ProrationBehaviorEnum } from '@contracts/subscriptions.types';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { LineItemTypeEnum } from '@utils/rating';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const PERIOD_START = '2026-03-01T00:00:00.000Z';
const PERIOD_END = '2026-04-01T00:00:00.000Z';
const NEXT_PERIOD_END = '2026-05-01T00:00:00.000Z';
const MID_PERIOD = '2026-03-16T12:00:00.000Z';
const NEXT_PERIOD_DAY = '2026-04-02T00:00:00.000Z';
const OLD_AMOUNT = 62_000;
const NEW_AMOUNT = 124_000;
const USAGE_UNIT_AMOUNT = 7;
const TOKENS = 1_200;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

interface Scenario {
  customerId: string;
  clockId: string;
  subscriptionId: string;
  oldPriceId: string;
  newPriceId: string;
}

async function makeCustomer(
  frozenTime = PERIOD_START,
): Promise<{ customerId: string; clockId: string }> {
  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime,
  });

  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
  });

  return { customerId: customer.id, clockId: clock.id };
}

async function makeProductId(): Promise<string> {
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });

  return product.id;
}

async function makeLicensedPriceId(unitAmount: number): Promise<string> {
  const price = await fastify.priceService.createPrice({
    productId: await makeProductId(),
    currency: CurrencyEnum.VND,
    unitAmount,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  return price.id;
}

async function makeMeteredPrice(): Promise<{ priceId: string; eventName: string }> {
  const meter = await fastify.meterService.createMeter({
    displayName: 'Advance tokens',
    eventName: `advance_tokens_${generateGid(ObjectPrefixEnum.METER)}`,
    aggregation: MeterAggregationEnum.SUM,
    valueKey: 'tokens',
  });

  const price = await fastify.priceService.createPrice({
    productId: await makeProductId(),
    currency: CurrencyEnum.VND,
    unitAmount: USAGE_UNIT_AMOUNT,
    meterId: meter.id,
    recurring: { interval: RecurringIntervalEnum.MONTH, usageType: UsageTypeEnum.METERED },
  });

  return { priceId: price.id, eventName: meter.eventName };
}

async function makeScenario(): Promise<Scenario> {
  const { customerId, clockId } = await makeCustomer();

  const oldPriceId = await makeLicensedPriceId(OLD_AMOUNT);
  const newPriceId = await makeLicensedPriceId(NEW_AMOUNT);

  const subscription = await fastify.subscriptionService.createSubscription({
    customerId,
    items: [{ priceId: oldPriceId }],
  });

  return { customerId, clockId, subscriptionId: subscription.id, oldPriceId, newPriceId };
}

async function findInvoices(subscriptionId: string) {
  const { data } = await fastify.invoiceService.findInvoices({ subscriptionId });

  return data;
}

async function getInvoiceByReason(subscriptionId: string, billingReason: BillingReasonEnum) {
  const invoices = await findInvoices(subscriptionId);
  const invoice = _.find(invoices, { billingReason });

  if (invoice) {
    return invoice;
  }

  throw new Error(`test fixture issued no ${billingReason} invoice for ${subscriptionId}`);
}

describe('SubscriptionService.createSubscription billing in advance', () => {
  it('issues an invoice for the period it is opening, not the one it just closed', async () => {
    const { subscriptionId } = await makeScenario();

    const invoice = await getInvoiceByReason(subscriptionId, BillingReasonEnum.SUBSCRIPTION_CREATE);

    const [lineItem] = invoice.lineItems;

    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
    expect(invoice.total).toBe(OLD_AMOUNT);
    expect(invoice.periodStart).toBe(PERIOD_START);
    expect(invoice.periodEnd).toBe(PERIOD_END);
    expect(_.get(lineItem, 'type')).toBe(LineItemTypeEnum.SUBSCRIPTION);
  });

  it('issues nothing at once while the subscription is still trialing', async () => {
    const { customerId } = await makeCustomer();

    const priceId = await makeLicensedPriceId(OLD_AMOUNT);

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
      trialPeriodDays: 7,
    });

    const invoices = await findInvoices(subscription.id);

    expect(invoices).toEqual([]);
  });

  it('defaults to billing in advance without being asked to', async () => {
    const { subscriptionId } = await makeScenario();

    const subscription = await fastify.subscriptionService.getSubscription(subscriptionId);

    expect(subscription.billingMode).toBe('advance');
  });
});

describe('RatingService.rateUpcomingInvoice billing in advance', () => {
  it('credits the unused half of the old price and charges the unused half of the new one', async () => {
    const { subscriptionId, clockId, newPriceId } = await makeScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: MID_PERIOD });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.CREATE_PRORATIONS,
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(ratedInvoice.periodStart).toBe(PERIOD_END);
    expect(ratedInvoice.periodEnd).toBe(NEXT_PERIOD_END);
    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([
      LineItemTypeEnum.PRORATION,
      LineItemTypeEnum.PRORATION,
      LineItemTypeEnum.SUBSCRIPTION,
    ]);
    expect(_.map(ratedInvoice.lineItems, 'isCredit')).toEqual([true, false, false]);
    expect(_.map(ratedInvoice.lineItems, 'amount')).toEqual([
      -OLD_AMOUNT / 2,
      NEW_AMOUNT / 2,
      NEW_AMOUNT,
    ]);
  });

  it('rates the next period alone when nothing changed inside this one', async () => {
    const { subscriptionId } = await makeScenario();

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(ratedInvoice.total).toBe(OLD_AMOUNT);
    expect(_.map(ratedInvoice.lineItems, 'type')).toEqual([LineItemTypeEnum.SUBSCRIPTION]);
  });
});

describe('SubscriptionService.updateSubscription billing in advance', () => {
  it('invoices the swap at once with a credit line and a charge line that balance by time', async () => {
    const { subscriptionId, clockId, newPriceId } = await makeScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: MID_PERIOD });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
    });

    const invoice = await getInvoiceByReason(subscriptionId, BillingReasonEnum.SUBSCRIPTION_UPDATE);

    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
    expect(_.map(invoice.lineItems, 'amount')).toEqual([-OLD_AMOUNT / 2, NEW_AMOUNT / 2]);
    expect(invoice.total).toBe(NEW_AMOUNT / 2 - OLD_AMOUNT / 2);
  });

  it('bills the swap once, so the next cycle invoice carries only the new period', async () => {
    const { subscriptionId, clockId, newPriceId } = await makeScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: MID_PERIOD });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
    });
    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: NEXT_PERIOD_DAY });

    const invoice = await getInvoiceByReason(subscriptionId, BillingReasonEnum.SUBSCRIPTION_CYCLE);

    expect(invoice.periodStart).toBe(PERIOD_END);
    expect(invoice.total).toBe(NEW_AMOUNT);
    expect(_.map(invoice.lineItems, 'type')).toEqual([LineItemTypeEnum.SUBSCRIPTION]);
  });
});

describe('SubscriptionService.cancelSubscription billing in advance', () => {
  it('charges nothing for the period a cancelling subscription will never have', async () => {
    const { subscriptionId, clockId } = await makeScenario();

    await fastify.subscriptionService.cancelSubscription(subscriptionId, {
      cancelAtPeriodEnd: true,
    });
    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: NEXT_PERIOD_DAY });

    const invoices = await findInvoices(subscriptionId);

    expect(_.map(invoices, 'billingReason')).toEqual([BillingReasonEnum.SUBSCRIPTION_CREATE]);
    expect(_.sumBy(invoices, 'total')).toBe(OLD_AMOUNT);
  });
});

describe('BillingRunService cycle invoice billing in advance', () => {
  it('bills the licensed item for the period ahead and the metered item for the one behind', async () => {
    const recentStart = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();

    const { customerId, clockId } = await makeCustomer(recentStart);

    const licensedPriceId = await makeLicensedPriceId(NEW_AMOUNT);
    const metered = await makeMeteredPrice();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId: licensedPriceId }, { priceId: metered.priceId }],
    });

    await fastify.meterEventService.ingestMeterEvent({
      eventName: metered.eventName,
      customerId,
      timestamp: recentStart,
      payload: { tokens: TOKENS },
    });
    await fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: new Date(
        Date.parse(subscription.currentPeriodEnd) + MILLISECONDS_PER_DAY,
      ).toISOString(),
    });

    const createInvoice = await getInvoiceByReason(
      subscription.id,
      BillingReasonEnum.SUBSCRIPTION_CREATE,
    );

    const cycleInvoice = await getInvoiceByReason(
      subscription.id,
      BillingReasonEnum.SUBSCRIPTION_CYCLE,
    );

    const usageLine = _.find(cycleInvoice.lineItems, { type: LineItemTypeEnum.USAGE });
    const licensedLine = _.find(cycleInvoice.lineItems, { type: LineItemTypeEnum.SUBSCRIPTION });

    expect(createInvoice.total).toBe(NEW_AMOUNT);
    expect(cycleInvoice.total).toBe(NEW_AMOUNT + TOKENS * USAGE_UNIT_AMOUNT);
    expect(_.get(usageLine, 'periodStart')).toBe(subscription.currentPeriodStart);
    expect(_.get(usageLine, 'periodEnd')).toBe(subscription.currentPeriodEnd);
    expect(_.get(licensedLine, 'periodStart')).toBe(subscription.currentPeriodEnd);
  });
});
