import { DomainEventTypeEnum } from '@contracts/events.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { PayoutStatusEnum } from '@contracts/payouts.types';
import { ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, settleInvoice, TEST_LIVEMODE } from './factories';

const BASE_AMOUNT = 500_000;
const EVENT_SCAN_LIMIT = 200;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeAvailableBalance(): Promise<void> {
  const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });

  await settleInvoice(fastify, invoiceId);
  await fastify.database.master.execute(
    `update balance_transactions set available_on = now() - interval '1 day' where payout_id is null`,
  );
}

async function readAccountBalance(code: LedgerAccountCodeEnum): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(code, CurrencyEnum.VND, TEST_LIVEMODE);

  return account.balance;
}

async function makeDuePayout() {
  const payout = await fastify.payoutService.createPayout(
    { currency: CurrencyEnum.VND },
    TEST_LIVEMODE,
  );

  await fastify.database.master.execute(
    `update payouts set arrival_at = now() - interval '1 hour' where id = '${payout.id}'`,
  );

  return payout;
}

async function detectEvent(eventType: DomainEventTypeEnum, aggregateId: string): Promise<boolean> {
  await fastify.outboxService.relayOutboxEvents(EVENT_SCAN_LIMIT);

  const published = await fastify.eventService.findEvents(
    { type: eventType, limit: 100 },
    TEST_LIVEMODE,
  );

  return _.some(published.data, (event) => {
    return _.get(event.data.object, 'id') === aggregateId;
  });
}

describe('PayoutService.createPayout', () => {
  it('sweeps the available balance into a payout on its way to the bank', async () => {
    await makeAvailableBalance();

    const receivableBefore = await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE);
    const payout = await fastify.payoutService.createPayout(
      { currency: CurrencyEnum.VND },
      TEST_LIVEMODE,
    );
    const swept = await fastify.balanceTransactionRepository.findBalanceTransactions({
      payoutId: payout.id,
    });

    expect(payout.status).toBe(PayoutStatusEnum.IN_TRANSIT);
    expect(payout.amount).toBe(receivableBefore);
    expect(swept.length).toBeGreaterThan(0);
    expect(await readAccountBalance(LedgerAccountCodeEnum.PAYOUTS_CLEARING)).toBe(payout.amount);
    expect(await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE)).toBe(0);
  });

  it('refuses a payout when nothing is available yet', async () => {
    await expect(
      fastify.payoutService.createPayout({ currency: CurrencyEnum.VND }, TEST_LIVEMODE),
    ).rejects.toThrow(ConflictError);
  });
});

describe('PayoutService.settleDuePayouts', () => {
  it('moves the money into cash and reports payout.paid once the bank confirms', async () => {
    await makeAvailableBalance();

    const cashBefore = await readAccountBalance(LedgerAccountCodeEnum.CASH);
    const clearingBefore = await readAccountBalance(LedgerAccountCodeEnum.PAYOUTS_CLEARING);
    const payout = await makeDuePayout();

    await fastify.payoutService.settleDuePayouts();
    await fastify.paymentService.drainProviderEvents();

    const paid = await fastify.payoutService.getPayout(payout.id, TEST_LIVEMODE);

    expect(paid.status).toBe(PayoutStatusEnum.PAID);
    expect(paid.paidAt).not.toBeNull();
    expect(await readAccountBalance(LedgerAccountCodeEnum.CASH)).toBe(cashBefore + payout.amount);
    expect(await readAccountBalance(LedgerAccountCodeEnum.PAYOUTS_CLEARING)).toBe(clearingBefore);
    expect(await detectEvent(DomainEventTypeEnum.PAYOUT_PAID, payout.id)).toBe(true);
  });

  it('returns the money to the balance when the bank refuses the payout', async () => {
    await makeAvailableBalance();

    const receivableBefore = await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE);
    const clearingBefore = await readAccountBalance(LedgerAccountCodeEnum.PAYOUTS_CLEARING);
    const payout = await makeDuePayout();
    const { pspReference } = await fastify.payoutService.getPayout(payout.id, TEST_LIVEMODE);

    fastify.psp.failPayout(pspReference ?? '');

    await fastify.paymentService.drainProviderEvents();

    const failed = await fastify.payoutService.getPayout(payout.id, TEST_LIVEMODE);
    const released = await fastify.balanceTransactionRepository.findBalanceTransactions({
      payoutId: payout.id,
    });

    expect(failed.status).toBe(PayoutStatusEnum.FAILED);
    expect(failed.failureCode).not.toBeNull();
    expect(released).toHaveLength(0);
    expect(await readAccountBalance(LedgerAccountCodeEnum.PSP_RECEIVABLE)).toBe(receivableBefore);
    expect(await readAccountBalance(LedgerAccountCodeEnum.PAYOUTS_CLEARING)).toBe(clearingBefore);
    expect(await detectEvent(DomainEventTypeEnum.PAYOUT_FAILED, payout.id)).toBe(true);
  });
});
