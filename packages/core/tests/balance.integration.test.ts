import { BalanceTransactionTypeEnum } from '@contracts/balance.types';
import { DisputeReasonEnum } from '@contracts/disputes.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { CurrencyEnum } from '@utils/currency';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, settleInvoice } from './factories';

const BASE_AMOUNT = 500_000;
const SCAN_LIMIT = 500;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function readAccountBalance(code: LedgerAccountCodeEnum): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(code, CurrencyEnum.VND);

  return account.balance;
}

describe('BalanceService.recordChargeSettlement', () => {
  it('splits a settled charge into gross, fee and net', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });
    const { chargeId } = await settleInvoice(fastify, invoiceId);

    const [balanceTransaction] = await fastify.balanceTransactionRepository.findBalanceTransactions(
      {
        sourceId: chargeId,
      },
    );
    const fee = fastify.psp.calculateProcessingFee(BASE_AMOUNT);

    expect(balanceTransaction?.type).toBe(BalanceTransactionTypeEnum.CHARGE);
    expect(balanceTransaction?.gross).toBe(BASE_AMOUNT);
    expect(balanceTransaction?.fee).toBe(fee);
    expect(balanceTransaction?.net).toBe(BASE_AMOUNT - fee);
    expect(Date.parse(_.get(balanceTransaction, 'availableOn', ''))).toBeGreaterThan(
      Date.parse(_.get(balanceTransaction, 'createdAt', '')),
    );
  });

  it('books the fee as an expense and the rest as a receivable from the processor', async () => {
    const receivableBefore = await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE);
    const feesBefore = await readAccountBalance(LedgerAccountCodeEnum.PSP_FEES);
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });

    await settleInvoice(fastify, invoiceId);

    const fee = fastify.psp.calculateProcessingFee(BASE_AMOUNT);

    expect(await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE)).toBe(
      receivableBefore + BASE_AMOUNT - fee,
    );
    expect(await readAccountBalance(LedgerAccountCodeEnum.PSP_FEES)).toBe(feesBefore + fee);
  });
});

describe('BalanceService.getBalance', () => {
  it('holds a fresh charge as pending until it becomes available', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });

    await settleInvoice(fastify, invoiceId);

    const balance = await fastify.balanceService.getBalance();
    const pending = _.find(balance.pending, { currency: CurrencyEnum.VND });
    const available = _.find(balance.available, { currency: CurrencyEnum.VND });

    expect(pending?.amount).toBeGreaterThan(0);
    expect(available?.amount).toBe(0);
  });

  it('reports the disputed amount as reserved rather than spendable', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });
    const { chargeReference } = await settleInvoice(fastify, invoiceId);

    fastify.psp.openDispute({
      reference: chargeReference,
      amount: 120_000,
      reason: DisputeReasonEnum.FRAUDULENT,
    });

    await fastify.paymentService.drainProviderEvents();

    const balance = await fastify.balanceService.getBalance();
    const reserved = _.find(balance.reserved, { currency: CurrencyEnum.VND });

    expect(reserved?.amount).toBe(120_000);
  });
});

describe('a day of activity balances end to end', () => {
  it('keeps the balance transactions equal to cash plus the processor receivable', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });
    const { chargeId } = await settleInvoice(fastify, invoiceId);

    await fastify.refundService.createRefund({
      chargeId,
      amount: 50_000,
      reason: 'Trả lại một phần',
    });
    await fastify.paymentService.drainProviderEvents();

    await fastify.database.master.execute(
      `update balance_transactions set available_on = now() - interval '1 day'`,
    );

    const payout = await fastify.payoutService.createPayout({ currency: CurrencyEnum.VND });

    await fastify.database.master.execute(
      `update payouts set arrival_at = now() - interval '1 hour' where id = '${payout.id}'`,
    );
    await fastify.payoutService.settleDuePayouts();
    await fastify.paymentService.drainProviderEvents();

    const balanceTransactions = await fastify.balanceTransactionRepository.findBalanceTransactions(
      {},
      SCAN_LIMIT,
    );
    const cash = await readAccountBalance(LedgerAccountCodeEnum.CASH);
    const receivable = await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE);

    expect(_.sumBy(balanceTransactions, 'net')).toBe(cash + receivable);
  });
});
