import { PspTokenEnum } from '@clients/mock-psp.client';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '@constants/time';
import { EntitlementStatusEnum } from '@contracts/entitlements.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import type { SubscriptionResponse } from '@contracts/subscriptions.types';
import {
  BillingModeEnum,
  PauseCollectionBehaviorEnum,
  SubscriptionStatusEnum,
  TrialEndBehaviorEnum,
} from '@contracts/subscriptions.types';
import { ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makePaymentMethod } from './factories';

const UNIT_AMOUNT = 500_000;
const OK_TOKEN = PspTokenEnum.VISA_OK;
const DECLINED_TOKEN = PspTokenEnum.CARD_DECLINED;
const SHARD = { shardIndex: 0, shardCount: 1 };
const CLOCK_START = '2026-06-01T00:00:00.000Z';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

interface ScenarioOverrides {
  token?: string;
  testClockId?: string;
}

async function makePrice(): Promise<string> {
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });
  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: UNIT_AMOUNT,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  return price.id;
}

async function makeCustomer(overrides: ScenarioOverrides = {}): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: overrides.testClockId,
  });

  if (overrides.token) {
    await makePaymentMethod(fastify, customer.id, overrides.token);
  }

  return customer.id;
}

async function makeTestClock(): Promise<string> {
  const testClock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime: CLOCK_START,
  });

  return testClock.id;
}

async function readSubscription(id: string): Promise<SubscriptionResponse> {
  return fastify.subscriptionService.getSubscription(id);
}

async function readEntitlementStatus(subscriptionId: string, customerId: string): Promise<string> {
  await fastify.entitlementService.handleSubscriptionChanged(subscriptionId);

  const { data } = await fastify.entitlementService.findEntitlements({ customerId });
  const [entitlement] = data;

  return _.get(entitlement, 'status', EntitlementStatusEnum.REVOKED);
}

async function readSubscriptionInvoice(subscriptionId: string) {
  const [invoice] = await fastify.invoiceRepository.findInvoices({ subscriptionId });

  if (invoice) {
    return invoice;
  }

  throw new Error(`test fixture left subscription ${subscriptionId} without an invoice`);
}

async function runBilling(runAt: Date): Promise<void> {
  await fastify.billingRunService.runBillingShard({ ...SHARD, runAt: runAt.toISOString() });
  await fastify.paymentService.drainProviderEvents();
}

function offsetFrom(instant: string, milliseconds: number): Date {
  return new Date(new Date(instant).getTime() + milliseconds);
}

describe('BillingRunService.runBillingShard without a test clock', () => {
  it('rolls the period, drafts, finalizes and collects on the real clock alone', async () => {
    const customerId = await makeCustomer({ token: OK_TOKEN });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
      billingMode: BillingModeEnum.ARREARS,
    });

    await runBilling(offsetFrom(subscription.currentPeriodEnd, 8 * MILLISECONDS_PER_DAY));

    const invoice = await readSubscriptionInvoice(subscription.id);
    const rolled = await readSubscription(subscription.id);

    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
    expect(invoice.periodStart).toBe(subscription.currentPeriodStart);
    expect(rolled.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(rolled.currentPeriodStart).toBe(subscription.currentPeriodEnd);
    expect(rolled.chargedThroughDate).toBe(subscription.currentPeriodEnd);
  });

  it('leaves the first failed collection incomplete and expires it after 23 hours', async () => {
    const customerId = await makeCustomer({ token: DECLINED_TOKEN });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });
    const collectAt = offsetFrom(subscription.currentPeriodEnd, 8 * MILLISECONDS_PER_DAY);

    await runBilling(collectAt);
    const failed = await readSubscription(subscription.id);

    expect(failed.status).toBe(SubscriptionStatusEnum.INCOMPLETE);
    expect(await readEntitlementStatus(subscription.id, customerId)).toBe(
      EntitlementStatusEnum.BLOCKED,
    );

    await runBilling(new Date(collectAt.getTime() + 24 * MILLISECONDS_PER_HOUR));
    const expired = await readSubscription(subscription.id);

    expect(expired.status).toBe(SubscriptionStatusEnum.INCOMPLETE_EXPIRED);
    expect(await readEntitlementStatus(subscription.id, customerId)).toBe(
      EntitlementStatusEnum.REVOKED,
    );
  });

  it('moves a subscription that has paid before to past_due and then to unpaid', async () => {
    const customerId = await makeCustomer({ token: OK_TOKEN });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });

    await runBilling(offsetFrom(subscription.currentPeriodEnd, 8 * MILLISECONDS_PER_DAY));
    await makePaymentMethod(fastify, customerId, DECLINED_TOKEN);

    const paid = await readSubscription(subscription.id);
    let runAt = offsetFrom(paid.currentPeriodEnd, 8 * MILLISECONDS_PER_DAY);

    await runBilling(runAt);
    const pastDue = await readSubscription(subscription.id);

    expect(pastDue.status).toBe(SubscriptionStatusEnum.PAST_DUE);
    expect(await readEntitlementStatus(subscription.id, customerId)).toBe(
      EntitlementStatusEnum.ACTIVE,
    );

    const retryCount = fastify.workflowSchedules.dunningRetryDelayDays.length;

    for (const _attempt of _.range(retryCount)) {
      const [openInvoice] = await fastify.invoiceRepository.findInvoices({
        subscriptionId: subscription.id,
        status: InvoiceStatusEnum.OPEN,
      });

      const nextAttemptAt = _.get(openInvoice, 'nextAttemptAt', null);
      const retryAt = nextAttemptAt ? new Date(nextAttemptAt) : runAt;

      runAt = new Date(retryAt.getTime() + MILLISECONDS_PER_HOUR);

      await runBilling(runAt);
    }

    const unpaid = await readSubscription(subscription.id);

    expect(unpaid.status).toBe(SubscriptionStatusEnum.UNPAID);
    expect(await readEntitlementStatus(subscription.id, customerId)).toBe(
      EntitlementStatusEnum.BLOCKED,
    );
  });

  it('counts a cycle with no payment method on file as a failed collection', async () => {
    const customerId = await makeCustomer();
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });

    await runBilling(offsetFrom(subscription.currentPeriodEnd, 8 * MILLISECONDS_PER_DAY));

    const invoice = await readSubscriptionInvoice(subscription.id);
    const failed = await readSubscription(subscription.id);

    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
    expect(invoice.attemptCount).toBe(1);
    expect(failed.status).toBe(SubscriptionStatusEnum.INCOMPLETE);
  });
});

describe('SubscriptionService.updateSubscription pauseCollection', () => {
  it('holds the next invoice as a draft while collection is paused', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });

    const paused = await fastify.subscriptionService.updateSubscription(subscription.id, {
      pauseCollection: { behavior: PauseCollectionBehaviorEnum.KEEP_AS_DRAFT },
    });

    expect(paused.status).toBe(SubscriptionStatusEnum.PAUSED);
    expect(_.get(paused.pauseCollection, 'behavior')).toBe(
      PauseCollectionBehaviorEnum.KEEP_AS_DRAFT,
    );

    await fastify.testClockService.advanceTestClock(testClockId, {
      frozenTime: offsetFrom(subscription.currentPeriodEnd, MILLISECONDS_PER_DAY).toISOString(),
    });

    const invoice = await readSubscriptionInvoice(subscription.id);

    expect(invoice.status).toBe(InvoiceStatusEnum.DRAFT);
    expect(invoice.autoAdvance).toBe(false);

    const resumed = await fastify.subscriptionService.updateSubscription(subscription.id, {
      pauseCollection: null,
    });

    expect(resumed.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(resumed.pauseCollection).toBeNull();
  });

  it('resumes by itself once resumesAt has passed', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });
    const resumesAt = offsetFrom(CLOCK_START, 3 * MILLISECONDS_PER_DAY);

    await fastify.subscriptionService.updateSubscription(subscription.id, {
      pauseCollection: {
        behavior: PauseCollectionBehaviorEnum.KEEP_AS_DRAFT,
        resumesAt: resumesAt.toISOString(),
      },
    });
    await fastify.testClockService.advanceTestClock(testClockId, {
      frozenTime: offsetFrom(CLOCK_START, 4 * MILLISECONDS_PER_DAY).toISOString(),
    });

    const resumed = await readSubscription(subscription.id);

    expect(resumed.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(resumed.pauseCollection).toBeNull();
  });

  it.each([
    {
      behavior: PauseCollectionBehaviorEnum.VOID,
      expected: InvoiceStatusEnum.VOID,
    },
    {
      behavior: PauseCollectionBehaviorEnum.MARK_UNCOLLECTIBLE,
      expected: InvoiceStatusEnum.UNCOLLECTIBLE,
    },
  ])(
    'leaves the cycle invoice $expected when collection is paused with $behavior',
    async ({ behavior, expected }) => {
      const testClockId = await makeTestClock();
      const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
      const priceId = await makePrice();
      const subscription = await fastify.subscriptionService.createSubscription({
        customerId,
        items: [{ priceId }],
      });

      await fastify.subscriptionService.updateSubscription(subscription.id, {
        pauseCollection: { behavior },
      });
      await fastify.testClockService.advanceTestClock(testClockId, {
        frozenTime: offsetFrom(subscription.currentPeriodEnd, MILLISECONDS_PER_DAY).toISOString(),
      });

      const invoice = await readSubscriptionInvoice(subscription.id);

      expect(invoice.status).toBe(expected);
    },
  );
});

describe('SubscriptionService.cancelSubscription cancelAt', () => {
  it('cancels on the requested day and revokes the entitlement', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });
    const cancelAt = offsetFrom(CLOCK_START, 10 * MILLISECONDS_PER_DAY);

    const scheduled = await fastify.subscriptionService.cancelSubscription(subscription.id, {
      cancelAt: cancelAt.toISOString(),
      cancellationDetails: { comment: 'moving to the annual plan', feedback: 'switched_service' },
    });

    expect(scheduled.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(scheduled.cancelAt).toBe(cancelAt.toISOString());
    expect(scheduled.cancellationDetails.comment).toBe('moving to the annual plan');

    await fastify.testClockService.advanceTestClock(testClockId, {
      frozenTime: offsetFrom(CLOCK_START, 11 * MILLISECONDS_PER_DAY).toISOString(),
    });

    const canceled = await readSubscription(subscription.id);

    expect(canceled.status).toBe(SubscriptionStatusEnum.CANCELED);
    expect(canceled.endedAt).toBe(cancelAt.toISOString());
    expect(await readEntitlementStatus(subscription.id, customerId)).toBe(
      EntitlementStatusEnum.REVOKED,
    );
  });
});

describe('SubscriptionService trial end behavior', () => {
  it('cancels a trial that ends without a payment method', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
      trialPeriodDays: 7,
      trialSettings: { endBehavior: { missingPaymentMethod: TrialEndBehaviorEnum.CANCEL } },
    });

    await fastify.testClockService.advanceTestClock(testClockId, {
      frozenTime: offsetFrom(CLOCK_START, 8 * MILLISECONDS_PER_DAY).toISOString(),
    });

    const canceled = await readSubscription(subscription.id);

    expect(canceled.status).toBe(SubscriptionStatusEnum.CANCELED);
    expect(canceled.cancellationDetails.reason).toBe('payment_failed');
  });

  it('pauses a trial that ends without a payment method when asked to', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
      trialPeriodDays: 7,
      trialSettings: { endBehavior: { missingPaymentMethod: TrialEndBehaviorEnum.PAUSE } },
    });

    await fastify.testClockService.advanceTestClock(testClockId, {
      frozenTime: offsetFrom(CLOCK_START, 8 * MILLISECONDS_PER_DAY).toISOString(),
    });

    const paused = await readSubscription(subscription.id);

    expect(paused.status).toBe(SubscriptionStatusEnum.PAUSED);
    expect(_.get(paused.pauseCollection, 'behavior')).toBe(
      PauseCollectionBehaviorEnum.KEEP_AS_DRAFT,
    );
  });

  it('keeps billing a trial that ends with a payment method on file', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
      trialPeriodDays: 7,
      trialSettings: { endBehavior: { missingPaymentMethod: TrialEndBehaviorEnum.CANCEL } },
    });

    await fastify.testClockService.advanceTestClock(testClockId, {
      frozenTime: offsetFrom(CLOCK_START, 8 * MILLISECONDS_PER_DAY).toISOString(),
    });

    const active = await readSubscription(subscription.id);

    expect(active.status).toBe(SubscriptionStatusEnum.ACTIVE);
  });
});

describe('SubscriptionItemService', () => {
  it('keeps the item id when the quantity changes and opens a new billing window', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId, quantity: 1 }],
    });
    const [item] = subscription.items;
    const itemId = _.get(item, 'id', '');

    await fastify.testClockService.advanceTestClock(testClockId, {
      frozenTime: offsetFrom(CLOCK_START, MILLISECONDS_PER_DAY).toISOString(),
    });

    const updated = await fastify.subscriptionItemService.updateSubscriptionItem(itemId, {
      quantity: 3,
    });
    const changes = await fastify.subscriptionRepository.findSubscriptionItemChanges({
      subscriptionItemIds: [itemId],
    });

    expect(updated.id).toBe(itemId);
    expect(updated.quantity).toBe(3);
    expect(changes).toHaveLength(2);
    expect(_.map(changes, 'quantity')).toEqual([1, 3]);
  });

  it('adds and removes an item through the resource', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
    const priceId = await makePrice();
    const secondPriceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });

    const added = await fastify.subscriptionItemService.createSubscriptionItem({
      subscriptionId: subscription.id,
      priceId: secondPriceId,
      quantity: 2,
    });
    const afterAdd = await fastify.subscriptionItemService.findSubscriptionItems({
      subscriptionId: subscription.id,
    });

    expect(afterAdd.data).toHaveLength(2);

    const deleted = await fastify.subscriptionItemService.deleteSubscriptionItem(added.id, {});
    const afterDelete = await fastify.subscriptionItemService.findSubscriptionItems({
      subscriptionId: subscription.id,
    });

    expect(deleted.deleted).toBe(true);
    expect(afterDelete.data).toHaveLength(1);
  });

  it('refuses to remove the last item of a subscription', async () => {
    const testClockId = await makeTestClock();
    const customerId = await makeCustomer({ token: OK_TOKEN, testClockId });
    const priceId = await makePrice();
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId,
      items: [{ priceId }],
    });
    const [item] = subscription.items;

    const act = fastify.subscriptionItemService.deleteSubscriptionItem(_.get(item, 'id', ''), {});

    await expect(act).rejects.toThrowError(ConflictError);
  });
});
