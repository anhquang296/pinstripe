import { MILLISECONDS_PER_DAY } from '@constants/time';
import {
  BillingReasonEnum,
  CreditNoteStatusEnum,
  CreditNoteTypeEnum,
  InvoiceStatusEnum,
} from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { BillingModeEnum, ProrationBehaviorEnum } from '@contracts/subscriptions.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { LineItemTypeEnum } from '@utils/rating';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeSubscription as makeSubscriptionFixture } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const SWAP_MID_CLOCK = new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString();
const BASE_AMOUNT = 500_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function readPeriodEnd(subscriptionId: string): Promise<Date> {
  const subscription = await fastify.subscriptionRepository.findSubscription(subscriptionId);

  if (subscription) {
    return new Date(subscription.currentPeriodEnd);
  }

  throw new Error(`test fixture lost subscription ${subscriptionId}`);
}

async function makeSubscription(
  amount = BASE_AMOUNT,
): Promise<{ subscriptionId: string; customerId: string }> {
  return makeSubscriptionFixture(fastify, {
    unitAmount: amount,
    frozenTime: CLOCK_START,
    billingMode: BillingModeEnum.ARREARS,
  });
}

async function readSubscriptionRow(subscriptionId: string) {
  const subscription = await fastify.subscriptionRepository.findSubscription(subscriptionId);

  if (subscription) {
    return subscription;
  }

  throw new Error(`test fixture lost subscription ${subscriptionId}`);
}

async function readProrationInvoice(subscriptionId: string) {
  const { data: invoices } = await fastify.invoiceService.findInvoices({ subscriptionId });
  const prorationInvoice = _.find(invoices, {
    billingReason: BillingReasonEnum.SUBSCRIPTION_UPDATE,
  });

  if (prorationInvoice) {
    return prorationInvoice;
  }

  throw new Error(`test fixture issued no proration invoice for ${subscriptionId}`);
}

interface SwapScenario {
  subscriptionId: string;
  customerId: string;
  clockId: string;
  oldPriceId: string;
  newPriceId: string;
}

async function makeSwapScenario(): Promise<SwapScenario> {
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
  const oldPrice = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: BASE_AMOUNT,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });
  const newPrice = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: BASE_AMOUNT * 2,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });
  const subscription = await fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId: oldPrice.id }],
    billingMode: BillingModeEnum.ARREARS,
  });

  return {
    subscriptionId: subscription.id,
    customerId: customer.id,
    clockId: clock.id,
    oldPriceId: oldPrice.id,
    newPriceId: newPrice.id,
  };
}

describe('InvoiceService.createInvoice', () => {
  it('returns the same draft when asked twice for one billing period', async () => {
    const { subscriptionId } = await makeSubscription();

    const first = await fastify.invoiceService.createInvoice({ subscriptionId });
    const second = await fastify.invoiceService.createInvoice({ subscriptionId });

    expect(second.id).toBe(first.id);
    expect(first.status).toBe(InvoiceStatusEnum.DRAFT);
    expect(first.number).toBeNull();
  });
});

describe('InvoiceService.finalizeInvoice', () => {
  it('freezes the rated total into line items and assigns a number', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });

    const invoice = await fastify.invoiceService.finalizeInvoice(draft.id);

    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
    expect(invoice.number).toMatch(/^INV-\d{6}$/);
    expect(invoice.total).toBe(BASE_AMOUNT);
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.finalizedAt).not.toBeNull();
  });

  it('debits receivable and credits revenue for the invoiced total', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });

    await fastify.invoiceService.finalizeInvoice(draft.id);

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(receivable.balance).toBe(BASE_AMOUNT);
  });

  it('refuses to finalize an invoice twice', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });

    await fastify.invoiceService.finalizeInvoice(draft.id);

    await expect(fastify.invoiceService.finalizeInvoice(draft.id)).rejects.toThrow(ConflictError);
  });

  it('hands out invoice numbers without leaving a gap', async () => {
    const drafts = await Promise.all(
      _.times(3, async () => {
        const { subscriptionId } = await makeSubscription();

        return fastify.invoiceService.createInvoice({ subscriptionId });
      }),
    );

    const finalized = [];

    for (const draft of drafts) {
      finalized.push(await fastify.invoiceService.finalizeInvoice(draft.id));
    }

    const sequenceValues = _.map(finalized, (invoice) => {
      const { number: invoiceNumber } = invoice;
      const numberSegments = invoiceNumber === null ? [''] : invoiceNumber.split('-');

      return Number(_.last(numberSegments));
    });
    const gaps = _.filter(sequenceValues, (value, index) => {
      const previousValue = _.get(sequenceValues, index - 1, 0);

      return index > 0 && value !== previousValue + 1;
    });

    expect(gaps).toEqual([]);
  });
});

describe('InvoiceService.payInvoice', () => {
  it('settles the invoice and moves the receivable into cash', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    const paid = await fastify.invoiceService.payInvoice(open.id, {});

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(paid.status).toBe(InvoiceStatusEnum.PAID);
    expect(paid.amountRemaining).toBe(0);
    expect(receivable.balance).toBe(0);
  });

  it('keeps the invoice open when only part of it is paid', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    const partial = await fastify.invoiceService.payInvoice(open.id, { amount: 200_000 });

    expect(partial.status).toBe(InvoiceStatusEnum.OPEN);
    expect(partial.amountRemaining).toBe(BASE_AMOUNT - 200_000);
  });

  it('rejects a payment larger than what is still owed', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await expect(
      fastify.invoiceService.payInvoice(open.id, { amount: BASE_AMOUNT + 1 }),
    ).rejects.toThrow(BadRequestError);
  });
});

describe('InvoiceService.voidInvoice', () => {
  it('reverses the receivable it had posted', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    const voided = await fastify.invoiceService.voidInvoice(open.id, {});

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(voided.status).toBe(InvoiceStatusEnum.VOID);
    expect(receivable.balance).toBe(0);
  });

  it('refuses to void an invoice that has been paid', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await fastify.invoiceService.payInvoice(open.id, {});

    await expect(fastify.invoiceService.voidInvoice(open.id, {})).rejects.toThrow(ConflictError);
  });
});

describe('issued invoices are immutable in the database', () => {
  it('rejects a direct rewrite of the billed total', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    const act = async () => {
      return fastify.database.master.execute(
        `update invoices set total = 1 where id = '${open.id}'`,
      );
    };

    await expect(act()).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/immutable/) },
    });
  });

  it('rejects a direct rewrite of a line item', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);
    const lineItemId = _.get(open, 'lineItems.0.id');

    const act = async () => {
      return fastify.database.master.execute(
        `update invoice_line_items set amount = 1 where id = '${lineItemId}'`,
      );
    };

    await expect(act()).rejects.toThrow();
  });
});

describe('CreditNoteService.createCreditNote', () => {
  it('numbers credit notes in their own sequence and credits the receivable back', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    const creditNote = await fastify.creditNoteService.createCreditNote({
      invoiceId: open.id,
      lines: [{ amount: 100_000, description: 'Một ghế thừa' }],
      reason: 'Khách báo sai số lượng',
    });

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(creditNote.number).toMatch(/^CN-\d{6}$/);
    expect(creditNote.type).toBe(CreditNoteTypeEnum.PRE_PAYMENT);
    expect(creditNote.status).toBe(CreditNoteStatusEnum.ISSUED);
    expect(creditNote.lines).toHaveLength(1);
    expect(receivable.balance).toBe(BASE_AMOUNT - 100_000);
  });

  it('reverses its own ledger entry when it is voided', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    const creditNote = await fastify.creditNoteService.createCreditNote({
      invoiceId: open.id,
      lines: [{ amount: 100_000 }],
      reason: 'Ghi nhầm',
    });
    const voided = await fastify.creditNoteService.voidCreditNote(creditNote.id, {
      reason: 'Ghi nhầm thật',
    });

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );
    const invoice = await fastify.invoiceService.getInvoice(open.id);

    expect(voided.status).toBe(CreditNoteStatusEnum.VOID);
    expect(voided.voidedAt).not.toBeNull();
    expect(receivable.balance).toBe(BASE_AMOUNT);
    expect(invoice.amountCredited).toBe(0);
  });

  it('refuses to credit more than the invoice was worth', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await fastify.creditNoteService.createCreditNote({
      invoiceId: open.id,
      lines: [{ amount: BASE_AMOUNT }],
      reason: 'Hoàn toàn bộ',
    });

    await expect(
      fastify.creditNoteService.createCreditNote({
        invoiceId: open.id,
        lines: [{ amount: 1 }],
        reason: 'Một đồng nữa',
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses to credit more than the customer has already paid', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await fastify.invoiceService.payInvoice(open.id, { amount: 400_000 });

    await expect(
      fastify.creditNoteService.createCreditNote({
        invoiceId: open.id,
        lines: [{ amount: BASE_AMOUNT }],
        reason: 'Nhiều hơn số đã trả',
      }),
    ).rejects.toThrow(/exceeds the 400000 paid/);

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(receivable.balance).toBe(BASE_AMOUNT - 400_000);
  });

  it('settles the invoice when a payment and a credit note together cover it', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await fastify.creditNoteService.createCreditNote({
      invoiceId: open.id,
      lines: [{ amount: 100_000 }],
      reason: 'Chiết khấu thỏa thuận',
    });

    const paid = await fastify.invoiceService.payInvoice(open.id, {});

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(paid.status).toBe(InvoiceStatusEnum.PAID);
    expect(paid.amountPaid).toBe(BASE_AMOUNT - 100_000);
    expect(paid.amountCredited).toBe(100_000);
    expect(paid.amountRemaining).toBe(0);
    expect(receivable.balance).toBe(0);
  });

  it('settles an invoice a credit note has fully covered, so nothing keeps chasing it', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await fastify.creditNoteService.createCreditNote({
      invoiceId: open.id,
      lines: [{ amount: BASE_AMOUNT }],
      reason: 'Hủy toàn bộ theo thỏa thuận',
    });

    const settled = await fastify.invoiceRepository.findInvoice(open.id);

    expect(_.get(settled, 'status')).toBe(InvoiceStatusEnum.PAID);
    expect(_.get(settled, 'nextAttemptAt')).toBeNull();
    expect(_.get(settled, 'amountPaid')).toBe(0);
  });

  it('refuses to credit a draft that can still be edited', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });

    await expect(
      fastify.creditNoteService.createCreditNote({
        invoiceId: draft.id,
        lines: [{ amount: 1 }],
        reason: 'Chưa phát hành',
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('BillingRunService.runBillingShard', () => {
  it('drafts an invoice once for a due subscription no matter how often it runs', async () => {
    const customer = await fastify.customerService.createCustomer({
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
    });
    const product = await fastify.productService.createProduct({
      name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
    });
    const price = await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      unitAmount: BASE_AMOUNT,
      recurring: { interval: RecurringIntervalEnum.MONTH },
    });
    const subscription = await fastify.subscriptionService.createSubscription({
      customerId: customer.id,
      items: [{ priceId: price.id }],
      billingMode: BillingModeEnum.ARREARS,
    });
    const periodEnd = await readPeriodEnd(subscription.id);
    const runAt = new Date(periodEnd.getTime() + 1_000);
    const job = { shardIndex: 0, shardCount: 1, runAt: runAt.toISOString() };

    const first = await fastify.billingRunService.runBillingShard(job);
    const second = await fastify.billingRunService.runBillingShard(job);

    expect(first.drafted).toBeGreaterThan(0);
    expect(second.drafted).toBe(0);
  });

  it('sends every subscription to exactly one shard', async () => {
    const { subscriptionId } = await makeSubscription();
    const periodEnd = await readPeriodEnd(subscriptionId);
    const runAt = new Date(periodEnd.getTime() + 1_000);
    const shardCount = 4;

    const scanned = await Promise.all(
      _.map(_.range(shardCount), (shardIndex) => {
        return fastify.subscriptionRepository.findSubscriptions({
          shardCount,
          shardIndex,
          currentPeriodEndTo: runAt.toISOString(),
        });
      }),
    );
    const owningShards = _.filter(scanned, (rows) => {
      return _.some(rows, { id: subscriptionId });
    });

    expect(owningShards).toHaveLength(1);
  });
});

describe('InvoiceService.issueProrationInvoice', () => {
  it('issues an open numbered invoice for the removed item elapsed slice at the swap', async () => {
    const { subscriptionId, clockId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
    });

    const { data: invoices } = await fastify.invoiceService.findInvoices({ subscriptionId });
    const prorationInvoice = _.find(invoices, {
      billingReason: BillingReasonEnum.SUBSCRIPTION_UPDATE,
    });

    expect(_.get(prorationInvoice, 'status')).toBe(InvoiceStatusEnum.OPEN);
    expect(_.get(prorationInvoice, 'number')).toMatch(/^INV-/);
    expect(_.get(prorationInvoice, 'total')).toBeGreaterThan(0);
    expect(_.map(_.get(prorationInvoice, 'lineItems'), 'type')).toEqual([
      LineItemTypeEnum.PRORATION,
    ]);
  });

  it('leaves the replacement remainder to the period end and never repeats the invoiced slice', async () => {
    const { subscriptionId, clockId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
    });

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(_.map(ratedInvoice.lineItems, 'priceId')).toEqual([newPriceId]);
  });

  it('issues no invoice when the update only replaces an item with itself', async () => {
    const { subscriptionId, clockId, oldPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: oldPriceId }],
      prorationBehavior: ProrationBehaviorEnum.NONE,
    });

    const { data: invoices } = await fastify.invoiceService.findInvoices({ subscriptionId });

    expect(invoices).toEqual([]);
  });

  it('posts a receivable for the immediate invoice', async () => {
    const { subscriptionId, customerId, clockId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
    });

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(receivable.balance).toBeGreaterThan(0);
  });

  it('still drafts the cycle invoice for the same period after a proration invoice was issued', async () => {
    const { subscriptionId, clockId, newPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
    });

    const subscription = await readSubscriptionRow(subscriptionId);
    const { isCreated } = await fastify.invoiceService.ensureDraftInvoice(
      subscription,
      {},
      {
        periodStart: new Date(subscription.currentPeriodStart),
        periodEnd: new Date(subscription.currentPeriodEnd),
      },
    );

    expect(isCreated).toBe(true);
  });

  it('re-bills the slice at period end after the proration invoice is voided', async () => {
    const { subscriptionId, clockId, newPriceId, oldPriceId } = await makeSwapScenario();

    await fastify.testClockService.advanceTestClock(clockId, { frozenTime: SWAP_MID_CLOCK });
    await fastify.subscriptionService.updateSubscription(subscriptionId, {
      items: [{ priceId: newPriceId }],
      prorationBehavior: ProrationBehaviorEnum.ALWAYS_INVOICE,
    });

    const prorationInvoice = await readProrationInvoice(subscriptionId);

    await fastify.invoiceService.voidInvoice(prorationInvoice.id, {});

    const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    expect(_.map(ratedInvoice.lineItems, 'priceId')).toEqual([oldPriceId, newPriceId]);
  });
});
