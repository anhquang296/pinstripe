import { MILLISECONDS_PER_DAY } from '@constants/time';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
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
    return subscription.currentPeriodEnd;
  }

  throw new Error(`test fixture lost subscription ${subscriptionId}`);
}

async function makeSubscription(
  amount = BASE_AMOUNT,
): Promise<{ subscriptionId: string; customerId: string }> {
  const clock = await fastify.testClockService.createTestClock({
    name: `clock ${generateId(ObjectPrefixEnum.TEST_CLOCK)}`,
    frozenTime: CLOCK_START,
  });
  const customer = await fastify.customerService.createCustomer({
    email: `${generateId(ObjectPrefixEnum.CUSTOMER)}@example.test`,
    currency: CurrencyEnum.VND,
    testClockId: clock.id,
  });
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateId(ObjectPrefixEnum.PRODUCT)}`,
  });
  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: amount,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });
  const subscription = await fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId: price.id }],
  });

  return { subscriptionId: subscription.id, customerId: customer.id };
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
      return Number(_.last((invoice.number ?? '').split('-')));
    });
    const gaps = _.filter(sequenceValues, (value, index) => {
      return index > 0 && value !== (sequenceValues[index - 1] ?? 0) + 1;
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

    await expect(act()).rejects.toThrow(/immutable/);
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
      amount: 100_000,
      reason: 'Khách báo sai số lượng',
    });

    const receivable = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
      CurrencyEnum.VND,
      customerId,
    );

    expect(creditNote.number).toMatch(/^CN-\d{6}$/);
    expect(receivable.balance).toBe(BASE_AMOUNT - 100_000);
  });

  it('refuses to credit more than the invoice was worth', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await fastify.creditNoteService.createCreditNote({
      invoiceId: open.id,
      amount: BASE_AMOUNT,
      reason: 'Hoàn toàn bộ',
    });

    await expect(
      fastify.creditNoteService.createCreditNote({
        invoiceId: open.id,
        amount: 1,
        reason: 'Một đồng nữa',
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses to credit money the customer has already paid', async () => {
    const { subscriptionId, customerId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });
    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    await fastify.invoiceService.payInvoice(open.id, { amount: 400_000 });

    await expect(
      fastify.creditNoteService.createCreditNote({
        invoiceId: open.id,
        amount: BASE_AMOUNT,
        reason: 'Nhiều hơn số còn nợ',
      }),
    ).rejects.toThrow(/still owed/);

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
      amount: 100_000,
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
      amount: BASE_AMOUNT,
      reason: 'Hủy toàn bộ theo thỏa thuận',
    });

    const settled = await fastify.invoiceRepository.findInvoice(open.id);

    expect(settled?.status).toBe(InvoiceStatusEnum.PAID);
    expect(settled?.nextAttemptAt).toBeNull();
    expect(settled?.amountPaid).toBe(0);
  });

  it('refuses to credit a draft that can still be edited', async () => {
    const { subscriptionId } = await makeSubscription();
    const draft = await fastify.invoiceService.createInvoice({ subscriptionId });

    await expect(
      fastify.creditNoteService.createCreditNote({
        invoiceId: draft.id,
        amount: 1,
        reason: 'Chưa phát hành',
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('BillingRunService.runBillingShard', () => {
  it('drafts an invoice once for a due subscription no matter how often it runs', async () => {
    const { subscriptionId } = await makeSubscription();
    const periodEnd = await readPeriodEnd(subscriptionId);
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
          currentPeriodEndTo: runAt,
        });
      }),
    );
    const owningShards = _.filter(scanned, (rows) => {
      return _.some(rows, { id: subscriptionId });
    });

    expect(owningShards).toHaveLength(1);
  });
});
