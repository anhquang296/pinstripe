import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { TEST_LIVEMODE } from './factories';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomerId(): Promise<string> {
  const customer = await fastify.customerService.createCustomer(
    { name: 'Standalone Buyer', currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );

  return customer.id;
}

it('bills a customer with no subscription from two invoice items', async () => {
  const customerId = await makeCustomerId();

  await fastify.invoiceItemService.createInvoiceItem(
    { customerId, description: 'Setup fee', amount: 300_000 },
    TEST_LIVEMODE,
  );
  await fastify.invoiceItemService.createInvoiceItem(
    { customerId, description: 'Training', unitAmount: 100_000, quantity: 2 },
    TEST_LIVEMODE,
  );

  const draft = await fastify.invoiceService.createInvoice({ customerId }, TEST_LIVEMODE);
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.status).toBe(InvoiceStatusEnum.OPEN);
  expect(open.subscriptionId).toBeNull();
  expect(open.lineItems).toHaveLength(2);
  expect(open.subtotal).toBe(500_000);
  expect(open.total).toBe(500_000);
  expect(open.amountDue).toBe(500_000);
});

it('applies a customer credit balance to the amount due and leaves the remainder as credit', async () => {
  const customerId = await makeCustomerId();

  await fastify.customerBalanceTransactionService.createCustomerBalanceTransaction(
    customerId,
    { amount: -800_000, currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );
  await fastify.invoiceItemService.createInvoiceItem(
    { customerId, description: 'Consulting', amount: 500_000 },
    TEST_LIVEMODE,
  );

  const draft = await fastify.invoiceService.createInvoice({ customerId }, TEST_LIVEMODE);
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);
  const customer = await fastify.customerService.getCustomer(customerId, TEST_LIVEMODE);

  expect(open.startingBalance).toBe(-800_000);
  expect(open.amountDue).toBe(0);
  expect(open.endingBalance).toBe(-300_000);
  expect(customer.balance).toBe(-300_000);
});

it('balances the ledger when a credit balance pays part of an invoice', async () => {
  const customerId = await makeCustomerId();

  await fastify.customerBalanceTransactionService.createCustomerBalanceTransaction(
    customerId,
    { amount: -200_000, currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );
  await fastify.invoiceItemService.createInvoiceItem(
    { customerId, description: 'Consulting', amount: 500_000 },
    TEST_LIVEMODE,
  );

  const granted = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
    CurrencyEnum.VND,
    TEST_LIVEMODE,
    customerId,
  );

  const draft = await fastify.invoiceService.createInvoice({ customerId }, TEST_LIVEMODE);
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  const receivable = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.VND,
    TEST_LIVEMODE,
    customerId,
  );
  const consumed = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
    CurrencyEnum.VND,
    TEST_LIVEMODE,
    customerId,
  );

  expect(open.amountDue).toBe(300_000);
  expect(granted.balance).toBe(200_000);
  expect(receivable.balance).toBe(300_000);
  expect(consumed.balance).toBe(0);
});

it('attaches a pending invoice item to the invoice it was billed on', async () => {
  const customerId = await makeCustomerId();

  const invoiceItem = await fastify.invoiceItemService.createInvoiceItem(
    { customerId, description: 'Overage', amount: 120_000 },
    TEST_LIVEMODE,
  );

  const draft = await fastify.invoiceService.createInvoice({ customerId }, TEST_LIVEMODE);
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);
  const billed = await fastify.invoiceItemService.getInvoiceItem(invoiceItem.id, TEST_LIVEMODE);

  const [lineItem] = open.lineItems;

  expect(billed.invoiceId).toBe(open.id);
  expect(_.get(lineItem, 'invoiceItemId')).toBe(invoiceItem.id);
});

it('refuses to add an invoice item to an invoice that has been issued', async () => {
  const customerId = await makeCustomerId();

  await fastify.invoiceItemService.createInvoiceItem(
    { customerId, description: 'First', amount: 100_000 },
    TEST_LIVEMODE,
  );

  const draft = await fastify.invoiceService.createInvoice({ customerId }, TEST_LIVEMODE);
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  const act = fastify.invoiceItemService.createInvoiceItem(
    { customerId, invoiceId: open.id, description: 'Too late', amount: 50_000 },
    TEST_LIVEMODE,
  );

  await expect(act).rejects.toThrow(ConflictError);
});
