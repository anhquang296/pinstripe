import type { CustomerResponse } from '@contracts/customers.types';
import { EntitlementStatusEnum } from '@contracts/entitlements.types';
import type { PriceResponse } from '@contracts/prices.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import {
  BillingModeEnum,
  ProrationBehaviorEnum,
  SubscriptionStatusEnum,
} from '@contracts/subscriptions.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const CLOCK_START = '2026-01-01T00:00:00.000Z';
const SWAP_AT = '2026-01-16T12:00:00.000Z';
const TRIAL_DAYS = 7;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function buildScenario(): Promise<{
  customer: CustomerResponse;
  price: PriceResponse;
  clockId: string;
}> {
  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime: CLOCK_START,
  });

  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
  });

  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 500_000,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  return { customer, price, clockId: clock.id };
}

describe('SubscriptionService.createSubscription', () => {
  it('starts a trialing subscription whose period ends when the trial does', async () => {
    const { customer, price } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
      trialPeriodDays: TRIAL_DAYS,
    });

    expect(subscription.status).toBe(SubscriptionStatusEnum.TRIALING);
    expect(subscription.currentPeriodEnd).toBe('2026-01-08T00:00:00.000Z');
    expect(subscription.trialEnd).toBe('2026-01-08T00:00:00.000Z');
  });

  it('grants the customer entitlement to the product while trialing', async () => {
    const { customer, price } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
      trialPeriodDays: TRIAL_DAYS,
    });

    await fastify.entitlementService.handleSubscriptionChanged(subscription.id);

    const entitlements = await fastify.entitlementService.findEntitlements({
      customerId: customer.id,
    });

    expect(entitlements.data).toHaveLength(1);
    expect(_.get(entitlements.data, '0.status')).toBe(EntitlementStatusEnum.ACTIVE);
  });

  it('refuses a one time price', async () => {
    const { customer } = await buildScenario();

    const product = await fastify.productService.createProduct({ name: 'One off setup' });

    const oneTime = await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      unitAmount: 100_000,
    });

    const act = fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: oneTime.id }],
    });

    await expect(act).rejects.toThrowError(BadRequestError);
  });
});

describe('TestClockService.advanceTestClock', () => {
  it('moves a trialing subscription to active when the trial ends', async () => {
    const { customer, price, clockId } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
      trialPeriodDays: TRIAL_DAYS,
    });

    await fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: '2026-01-09T00:00:00.000Z',
    });
    const advanced = await fastify.subscriptionService.getSubscription(subscription.id);

    expect(advanced.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(advanced.currentPeriodStart).toBe('2026-01-08T00:00:00.000Z');
    expect(advanced.currentPeriodEnd).toBe('2026-02-08T00:00:00.000Z');
  });

  it('rolls every period that the clock jumped over, not just one', async () => {
    const { customer, price, clockId } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
    });

    await fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: '2026-04-15T00:00:00.000Z',
    });
    const advanced = await fastify.subscriptionService.getSubscription(subscription.id);

    expect(advanced.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(advanced.currentPeriodEnd).toBe('2026-05-01T00:00:00.000Z');
  });

  it('refuses to move backwards', async () => {
    const { clockId } = await buildScenario();

    const act = fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: '2025-12-01T00:00:00.000Z',
    });

    await expect(act).rejects.toThrowError(BadRequestError);
  });
});

describe('SubscriptionService.cancelSubscription', () => {
  it('keeps the subscription billing and entitled until the period ends', async () => {
    const { customer, price, clockId } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
    });

    const canceling = await fastify.subscriptionService.cancelSubscription(subscription.id, {
      cancelAtPeriodEnd: true,
    });

    await fastify.entitlementService.handleSubscriptionChanged(subscription.id);

    const entitlements = await fastify.entitlementService.findEntitlements({
      customerId: customer.id,
    });

    expect(canceling.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(canceling.cancelAtPeriodEnd).toBe(true);
    expect(canceling.canceledAt).not.toBeNull();
    expect(_.get(entitlements.data, '0.status')).toBe(EntitlementStatusEnum.ACTIVE);

    await fastify.testClockService.advanceTestClock(clockId, {
      frozenTime: '2026-02-02T00:00:00.000Z',
    });
    const ended = await fastify.subscriptionService.getSubscription(subscription.id);

    await fastify.entitlementService.handleSubscriptionChanged(subscription.id);

    const afterEnd = await fastify.entitlementService.findEntitlements({
      customerId: customer.id,
    });

    expect(ended.status).toBe(SubscriptionStatusEnum.CANCELED);
    expect(ended.endedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(_.get(afterEnd.data, '0.status')).toBe(EntitlementStatusEnum.REVOKED);
  });

  it('revokes entitlement immediately when cancelled outright', async () => {
    const { customer, price } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
    });

    await fastify.entitlementService.handleSubscriptionChanged(subscription.id);

    await fastify.subscriptionService.cancelSubscription(subscription.id, {});
    await fastify.entitlementService.handleSubscriptionChanged(subscription.id);

    const entitlements = await fastify.entitlementService.findEntitlements({
      customerId: customer.id,
    });

    expect(_.get(entitlements.data, '0.status')).toBe(EntitlementStatusEnum.REVOKED);
  });

  it('refuses to cancel a subscription that is already canceled', async () => {
    const { customer, price } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
    });

    await fastify.subscriptionService.cancelSubscription(subscription.id, {});

    const act = fastify.subscriptionService.cancelSubscription(subscription.id, {});

    await expect(act).rejects.toThrowError(ConflictError);
  });
});

describe('SubscriptionService.updateSubscription proration', () => {
  it('rejects a proration behavior when the payload changes no items', async () => {
    const { customer, price } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
    });

    const act = () => {
      return fastify.subscriptionService.updateSubscription(subscription.id, {
        prorationBehavior: ProrationBehaviorEnum.NONE,
        metadata: { plan: 'pro' },
      });
    };

    await expect(act).rejects.toThrowError(BadRequestError);
  });

  it('records the swap instant as the billing boundary on both the closed and the replacement window', async () => {
    const { customer, price, clockId } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
    });

    const [itemBefore] = subscription.items;

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_AT });

    const updated = await fastify.subscriptionService.updateSubscription(subscription.id, {
      items: [{ priceId: price.id, quantity: 4 }],
    });

    const changes = await fastify.subscriptionRepository.findSubscriptionItemChanges({
      subscriptionIds: [subscription.id],
    });

    const closedChange = _.find(changes, (change) => {
      return change.billedThrough !== null;
    });

    const openChange = _.find(changes, (change) => {
      return change.billedThrough === null;
    });

    expect(_.map(updated.items, 'id')).toEqual([_.get(itemBefore, 'id')]);
    expect(_.get(closedChange, 'billedThrough')).toBe(SWAP_AT);
    expect(_.get(openChange, 'billedFrom')).toBe(SWAP_AT);
    expect(_.get(openChange, 'quantity')).toBe(4);
  });

  it('records the period start as the billing boundary when no proration is wanted', async () => {
    const { customer, price, clockId } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
    });

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_AT });
    await fastify.subscriptionService.updateSubscription(subscription.id, {
      items: [{ priceId: price.id, quantity: 2 }],
      prorationBehavior: ProrationBehaviorEnum.NONE,
    });

    const changes = await fastify.subscriptionRepository.findSubscriptionItemChanges({
      subscriptionIds: [subscription.id],
    });

    const openChange = _.find(changes, (change) => {
      return change.billedThrough === null;
    });

    expect(_.get(openChange, 'billedFrom')).toBe(subscription.currentPeriodStart);
  });

  it('leaves no invoice behind when an always_invoice update is rejected', async () => {
    const { customer, price, clockId } = await buildScenario();

    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
      billingMode: BillingModeEnum.ARREARS,
    });

    const archivedPrice = await fastify.priceService.updatePrice(price.id, { active: false });

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_AT });

    const act = () => {
      return fastify.subscriptionService.updateSubscription(subscription.id, {
        items: [{ priceId: archivedPrice.id }],
        prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
      });
    };

    await expect(act).rejects.toThrowError(BadRequestError);

    const { data: invoices } = await fastify.invoiceService.findInvoices({
      subscriptionId: subscription.id,
    });

    expect(invoices).toEqual([]);
  });
});
