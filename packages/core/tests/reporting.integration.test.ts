import { MILLISECONDS_PER_DAY } from '@constants/time';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { ReconciliationOutcomeEnum } from '@contracts/reporting.types';
import { BillingModeEnum } from '@contracts/subscriptions.types';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makePaymentMethod } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const MONTHLY_AMOUNT = 500_000;
const MONTHS_PER_YEAR = 12;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeActiveSubscription(
  amount: number,
  interval = RecurringIntervalEnum.MONTH,
): Promise<{ subscriptionId: string; customerId: string }> {
  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime: CLOCK_START,
  });

  const customer = await fastify.customerService.createCustomer({
    email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
  });

  await makePaymentMethod(fastify, customer.id);

  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: amount,
    recurring: { interval },
  });

  const subscription = await fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId: price.id }],
    billingMode: BillingModeEnum.ARREARS,
  });

  return { subscriptionId: subscription.id, customerId: customer.id };
}

describe('ReportingService.aggregateRevenueSummary', () => {
  it('counts a new monthly subscription into MRR and carries it into ARR', async () => {
    const before = await fastify.reportingService.aggregateRevenueSummary({});

    await makeActiveSubscription(MONTHLY_AMOUNT);

    const after = await fastify.reportingService.aggregateRevenueSummary({});

    expect(after.mrr - before.mrr).toBe(MONTHLY_AMOUNT);
    expect(after.arr).toBe(after.mrr * MONTHS_PER_YEAR);
    expect(after.activeSubscriptions).toBe(before.activeSubscriptions + 1);
  });

  it('normalises a yearly subscription down to a twelfth a month', async () => {
    const yearlyAmount = MONTHLY_AMOUNT * MONTHS_PER_YEAR;
    const before = await fastify.reportingService.aggregateRevenueSummary({});

    await makeActiveSubscription(yearlyAmount, RecurringIntervalEnum.YEAR);

    const after = await fastify.reportingService.aggregateRevenueSummary({});

    expect(after.mrr - before.mrr).toBe(MONTHLY_AMOUNT);
  });

  it('reports a churn rate between zero and one', async () => {
    const summary = await fastify.reportingService.aggregateRevenueSummary({});

    expect(summary.churnRate).toBeGreaterThanOrEqual(0);
    expect(summary.churnRate).toBeLessThanOrEqual(1);
  });

  it('keeps every currency to its own books', async () => {
    const vnd = await fastify.reportingService.aggregateRevenueSummary({
      currency: CurrencyEnum.VND,
    });

    const usd = await fastify.reportingService.aggregateRevenueSummary({
      currency: CurrencyEnum.USD,
    });

    expect(vnd.currency).toBe(CurrencyEnum.VND);
    expect(usd.currency).toBe(CurrencyEnum.USD);
    expect(usd.mrr).toBe(0);
  });

  it('answers for the window it was asked about, not for all time', async () => {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - MILLISECONDS_PER_DAY);

    const summary = await fastify.reportingService.aggregateRevenueSummary({
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    expect(summary.windowStart).toBe(windowStart.toISOString());
    expect(summary.windowEnd).toBe(windowEnd.toISOString());
  });
});

describe('ReconciliationService.aggregateReconciliationReport', () => {
  it('matches a collected payment against the balance it moved in the ledger', async () => {
    const { subscriptionId } = await makeActiveSubscription(MONTHLY_AMOUNT);

    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);
    const windowStart = new Date(Date.now() - MILLISECONDS_PER_DAY);

    const paymentIntent = await fastify.paymentService.createPaymentIntent({
      invoiceId: open.id,
    });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
    await fastify.paymentService.drainProviderEvents();

    const report = await fastify.reconciliationService.aggregateReconciliationReport({
      windowStart: windowStart.toISOString(),
      windowEnd: new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString(),
    });

    const settled = await fastify.paymentService.getPaymentIntent(paymentIntent.id);

    const exception = _.find(report.exceptions, {
      reference: `charge:${settled.latestChargeId}`,
    });

    expect(report.matched).toBeGreaterThan(0);
    expect(exception).toBeUndefined();
  });

  it('nets a refund back out so the processor and the ledger still agree', async () => {
    const { subscriptionId } = await makeActiveSubscription(MONTHLY_AMOUNT);

    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId: open.id });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
    await fastify.paymentService.drainProviderEvents();

    const { latestChargeId } = await fastify.paymentService.getPaymentIntent(paymentIntent.id);

    const chargeId = latestChargeId === null ? '' : latestChargeId;

    const refund = await fastify.refundService.createRefund({
      chargeId,
      amount: 100_000,
      reason: 'Đối soát',
    });

    await fastify.paymentService.drainProviderEvents();

    const report = await fastify.reconciliationService.aggregateReconciliationReport({
      windowStart: new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString(),
      windowEnd: new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString(),
    });

    const exception = _.find(report.exceptions, { reference: `refund:${refund.id}` });

    expect(exception).toBeUndefined();
  });

  it('still matches when the invoice was only part paid', async () => {
    const { subscriptionId } = await makeActiveSubscription(MONTHLY_AMOUNT);

    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    const paymentIntent = await fastify.paymentService.createPaymentIntent({
      invoiceId: open.id,
      amount: 120_000,
    });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
    await fastify.paymentService.drainProviderEvents();

    const report = await fastify.reconciliationService.aggregateReconciliationReport({
      windowStart: new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString(),
      windowEnd: new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString(),
    });

    const exception = _.find(report.exceptions, {
      reference: `payment_intent:${paymentIntent.id}`,
    });

    expect(exception).toBeUndefined();
  });

  it('flags a ledger balance movement the processor never reported', async () => {
    const customer = await fastify.customerService.createCustomer({
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
    });

    const strayReference = `charge:${generateGid(ObjectPrefixEnum.CHARGE)}`;

    await fastify.ledgerService.postTransaction({
      description: 'Tiền về số dư cổng, chưa khớp giao dịch nào',
      currency: CurrencyEnum.VND,
      externalId: strayReference,
      entries: [
        { accountCode: 'psp_receivable', direction: 'debit', amount: 77_000 },
        {
          accountCode: 'accounts_receivable',
          customerId: customer.id,
          direction: 'credit',
          amount: 77_000,
        },
      ],
    });

    const report = await fastify.reconciliationService.aggregateReconciliationReport({
      windowStart: new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString(),
      windowEnd: new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString(),
    });

    const exception = _.find(report.exceptions, { reference: strayReference });

    expect(_.get(exception, 'outcome')).toBe(ReconciliationOutcomeEnum.MISSING_IN_PROCESSOR);
    expect(_.get(exception, 'ledgerAmount')).toBe(77_000);
    expect(_.get(exception, 'processorAmount')).toBeNull();
  });

  it('reports the difference between the two sides, not just a list', async () => {
    const report = await fastify.reconciliationService.aggregateReconciliationReport({
      windowStart: new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString(),
      windowEnd: new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString(),
    });

    expect(report.difference).toBe(report.processorTotal - report.ledgerTotal);
  });
});
