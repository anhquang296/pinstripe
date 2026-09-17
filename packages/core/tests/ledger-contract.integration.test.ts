import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import { CurrencyEnum } from '@utils/currency';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, TEST_LIVEMODE } from './factories';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function findPostingsByExternalId(externalId: string) {
  const [transaction] = await fastify.ledgerTransactionRepository.findLedgerTransactions({
    livemode: TEST_LIVEMODE,
    externalId,
  });

  if (!transaction) {
    throw new Error(`no ledger transaction carries the external id ${externalId}`);
  }

  const postings = await fastify.ledgerTransactionRepository.findLedgerPostings([transaction.id]);
  const accounts = await fastify.ledgerAccountRepository.findLedgerAccounts(
    { ids: _.map(postings, 'accountId') },
    postings.length,
  );
  const accountById = _.keyBy(accounts, 'id');

  return _.map(postings, (posting) => {
    return {
      code: _.get(accountById, [posting.accountId, 'code']),
      direction: posting.direction,
      amount: posting.amount,
    };
  });
}

it('names a cash receipt with the reference the processor reports', async () => {
  const { invoiceId } = await makeOpenInvoice(fastify);

  const paid = await fastify.invoiceService.payInvoice(invoiceId, {});
  const externalId = `invoice_payment:${invoiceId}:${paid.amountPaid}`;

  const postings = await findPostingsByExternalId(externalId);
  const [payment] = await fastify.invoiceRepository.findInvoicePayments([invoiceId]);

  expect(_.map(postings, 'code').sort()).toEqual([
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    LedgerAccountCodeEnum.CASH,
  ]);
  expect(_.get(payment, 'amount')).toBe(paid.amountPaid);
});

it('splits an issued invoice across receivable, revenue and the credit balance', async () => {
  const customer = await fastify.customerService.createCustomer(
    { name: 'Split Buyer', currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );

  await fastify.customerBalanceTransactionService.createCustomerBalanceTransaction(
    customer.id,
    { amount: -200_000, currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );
  await fastify.invoiceItemService.createInvoiceItem(
    { customerId: customer.id, description: 'Consulting', amount: 500_000 },
    TEST_LIVEMODE,
  );

  const draft = await fastify.invoiceService.createInvoice(
    { customerId: customer.id },
    TEST_LIVEMODE,
  );
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  const postings = await findPostingsByExternalId(`invoice:${open.id}`);
  const debits = _.sumBy(_.filter(postings, { direction: PostingDirectionEnum.DEBIT }), 'amount');
  const credits = _.sumBy(_.filter(postings, { direction: PostingDirectionEnum.CREDIT }), 'amount');

  expect(postings).toContainEqual({
    code: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    direction: PostingDirectionEnum.DEBIT,
    amount: 300_000,
  });
  expect(postings).toContainEqual({
    code: LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
    direction: PostingDirectionEnum.DEBIT,
    amount: 200_000,
  });
  expect(postings).toContainEqual({
    code: LedgerAccountCodeEnum.REVENUE,
    direction: PostingDirectionEnum.CREDIT,
    amount: 500_000,
  });
  expect(debits).toBe(credits);
});

it('returns the applied credit to the customer when the invoice is voided', async () => {
  const customer = await fastify.customerService.createCustomer(
    { name: 'Void Buyer', currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );

  await fastify.customerBalanceTransactionService.createCustomerBalanceTransaction(
    customer.id,
    { amount: -200_000, currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );
  await fastify.invoiceItemService.createInvoiceItem(
    { customerId: customer.id, description: 'Consulting', amount: 500_000 },
    TEST_LIVEMODE,
  );

  const draft = await fastify.invoiceService.createInvoice(
    { customerId: customer.id },
    TEST_LIVEMODE,
  );
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  await fastify.invoiceService.voidInvoice(open.id, {});

  const restored = await fastify.customerService.getCustomer(customer.id, TEST_LIVEMODE);
  const postings = await findPostingsByExternalId(`invoice_void:${open.id}`);
  const debits = _.sumBy(_.filter(postings, { direction: PostingDirectionEnum.DEBIT }), 'amount');
  const credits = _.sumBy(_.filter(postings, { direction: PostingDirectionEnum.CREDIT }), 'amount');

  expect(restored.balance).toBe(-200_000);
  expect(debits).toBe(credits);
});
