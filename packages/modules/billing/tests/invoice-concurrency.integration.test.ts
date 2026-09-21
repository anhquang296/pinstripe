import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { CurrencyEnum } from '@utils/currency';
import { ConflictError } from '@vxrerp/platform/errors';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice } from './factories';

const UNIT_AMOUNT = 900_000;
const FIRST_PAYMENT = 300_000;
const SECOND_PAYMENT = 250_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function readInvoiceRow(invoiceId: string) {
  const invoice = await fastify.invoiceRepository.findInvoice(invoiceId);

  if (invoice) {
    return invoice;
  }

  throw new Error(`test fixture lost invoice ${invoiceId}`);
}

async function readReceivable(customerId: string): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.VND,
    customerId,
  );

  return account.balance;
}

it('sums both amounts when two partial payments settle concurrently', async () => {
  const { invoiceId, customerId } = await makeOpenInvoice(fastify, { unitAmount: UNIT_AMOUNT });

  await Promise.all([
    fastify.invoiceService.payInvoice(invoiceId, { amount: FIRST_PAYMENT }),
    fastify.invoiceService.payInvoice(invoiceId, { amount: SECOND_PAYMENT }),
  ]);

  const invoice = await readInvoiceRow(invoiceId);

  expect(invoice.amountPaid).toBe(FIRST_PAYMENT + SECOND_PAYMENT);
  expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
  expect(await readReceivable(customerId)).toBe(UNIT_AMOUNT - FIRST_PAYMENT - SECOND_PAYMENT);
});

it('rejects the loser when two payments both claim the whole balance', async () => {
  const { invoiceId, customerId } = await makeOpenInvoice(fastify, { unitAmount: UNIT_AMOUNT });

  const outcomes = await Promise.allSettled([
    fastify.invoiceService.payInvoice(invoiceId, { amount: UNIT_AMOUNT }),
    fastify.invoiceService.payInvoice(invoiceId, { amount: UNIT_AMOUNT }),
  ]);

  const rejected = _.filter(outcomes, { status: 'rejected' });

  expect(rejected).toHaveLength(1);
  expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

  const invoice = await readInvoiceRow(invoiceId);

  expect(invoice.amountPaid).toBe(UNIT_AMOUNT);
  expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
  expect(await readReceivable(customerId)).toBe(0);
});
