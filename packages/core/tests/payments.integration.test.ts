import { MILLISECONDS_PER_DAY } from '@constants/time';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { PaymentAttemptOutcomeEnum, PaymentIntentStatusEnum } from '@contracts/payments.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice as makeOpenInvoiceFixture } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const BASE_AMOUNT = 500_000;
const DECLINED_METHOD = 'pm_card_declined';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeOpenInvoice(): Promise<{ invoiceId: string; customerId: string }> {
  return makeOpenInvoiceFixture(fastify, { unitAmount: BASE_AMOUNT, frozenTime: CLOCK_START });
}

async function readReceivable(customerId: string): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.VND,
    false,
    customerId,
  );

  return account.balance;
}

describe('PaymentService.createPaymentIntent', () => {
  it('defaults the amount to what the invoice still owes', async () => {
    const { invoiceId } = await makeOpenInvoice();

    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    expect(paymentIntent.amount).toBe(BASE_AMOUNT);
    expect(paymentIntent.status).toBe(PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD);
  });

  it('rejects an intent larger than what is still owed', async () => {
    const { invoiceId } = await makeOpenInvoice();

    await expect(
      fastify.paymentService.createPaymentIntent({ invoiceId, amount: BASE_AMOUNT + 1 }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses to take payment on an invoice that is not open', async () => {
    const { invoiceId } = await makeOpenInvoice();

    await fastify.invoiceService.voidInvoice(invoiceId, {});

    await expect(fastify.paymentService.createPaymentIntent({ invoiceId })).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('PaymentService.confirmPaymentIntent', () => {
  it('settles the invoice and moves the receivable into cash', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const confirmed = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(confirmed.status).toBe(PaymentIntentStatusEnum.SUCCEEDED);
    expect(confirmed.pspReference).toMatch(/^mockpsp_/);
    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
    expect(await readReceivable(customerId)).toBe(0);
  });

  it('leaves the invoice untouched when the processor declines', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const declined = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {
      paymentMethod: DECLINED_METHOD,
    });
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(declined.status).toBe(PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD);
    expect(declined.failureCode).toBe('card_declined');
    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
    expect(await readReceivable(customerId)).toBe(BASE_AMOUNT);
  });

  it('keeps every attempt on the record so a decline is still auditable', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {
      paymentMethod: DECLINED_METHOD,
    });
    const succeeded = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {
      paymentMethod: 'pm_card_ok',
    });

    expect(_.map(succeeded.attempts, 'outcome')).toEqual([
      PaymentAttemptOutcomeEnum.DECLINED,
      PaymentAttemptOutcomeEnum.SUCCEEDED,
    ]);
  });

  it('refuses to confirm an intent that already succeeded', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    await expect(fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {})).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('RefundService.createRefund', () => {
  it('returns money already taken and reduces revenue rather than the receivable', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    const refund = await fastify.refundService.createRefund({
      paymentIntentId: paymentIntent.id,
      amount: 200_000,
      reason: 'Khách trả lại dịch vụ',
    });
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(refund.amount).toBe(200_000);
    expect(refund.pspReference).toMatch(/^mockpsp_/);
    expect(invoice.amountRefunded).toBe(200_000);
    expect(await readReceivable(customerId)).toBe(0);
  });

  it('refunds the whole payment when no amount is given', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    const refund = await fastify.refundService.createRefund({
      paymentIntentId: paymentIntent.id,
      reason: 'Hoàn toàn bộ',
    });

    expect(refund.amount).toBe(BASE_AMOUNT);
  });

  it('refuses to refund more than the payment took', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
    await fastify.refundService.createRefund({
      paymentIntentId: paymentIntent.id,
      amount: BASE_AMOUNT,
      reason: 'Hoàn toàn bộ',
    });

    await expect(
      fastify.refundService.createRefund({
        paymentIntentId: paymentIntent.id,
        amount: 1,
        reason: 'Một đồng nữa',
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses to refund an intent that never took money', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await expect(
      fastify.refundService.createRefund({
        paymentIntentId: paymentIntent.id,
        amount: 1,
        reason: 'Chưa thu được đồng nào',
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('payment records are append-only in the database', () => {
  it('rejects a direct rewrite of a refund', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    const refund = await fastify.refundService.createRefund({
      paymentIntentId: paymentIntent.id,
      amount: 1_000,
      reason: 'Điều chỉnh nhỏ',
    });

    const act = async () => {
      return fastify.database.master.execute(
        `update refunds set amount = 999 where id = '${refund.id}'`,
      );
    };

    await expect(act()).rejects.toThrow(/append-only/);
  });
});
