import { PspTokenEnum } from '@clients/mock-psp.client';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import {
  CaptureMethodEnum,
  ChargeOutcomeEnum,
  ChargeStatusEnum,
  DeclineCodeEnum,
  PaymentCancellationReasonEnum,
  PaymentIntentStatusEnum,
  PspEventTypeEnum,
  PspProviderEnum,
  RefundStatusEnum,
} from '@contracts/payments.types';
import { BadRequestError, ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice as makeOpenInvoiceFixture, makePaymentMethod } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const BASE_AMOUNT = 500_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

interface InvoiceFixture {
  invoiceId: string;
  customerId: string;
  paymentMethodId: string;
}

async function makeOpenInvoice(token?: string): Promise<InvoiceFixture> {
  const fixture = await makeOpenInvoiceFixture(fastify, {
    unitAmount: BASE_AMOUNT,
    frozenTime: CLOCK_START,
    token,
  });

  return {
    invoiceId: fixture.invoiceId,
    customerId: fixture.customerId,
    paymentMethodId: fixture.paymentMethodId,
  };
}

async function readReceivable(customerId: string): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.VND,
    customerId,
  );

  return account.balance;
}

async function settle(paymentIntentId: string) {
  await fastify.paymentService.confirmPaymentIntent(paymentIntentId, {});
  await fastify.paymentService.drainProviderEvents();

  return fastify.paymentService.getPaymentIntent(paymentIntentId);
}

async function settleCharge(invoiceId: string): Promise<string> {
  const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });
  const settled = await settle(paymentIntent.id);
  const { latestChargeId } = settled;

  if (latestChargeId) {
    return latestChargeId;
  }

  throw new Error('settleCharge() the payment intent settled without a charge');
}

describe('PaymentService.createPaymentIntent', () => {
  it('defaults the amount to what the invoice still owes', async () => {
    const { invoiceId } = await makeOpenInvoice();

    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    expect(paymentIntent.amount).toBe(BASE_AMOUNT);
    expect(paymentIntent.status).toBe(PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD);
    expect(paymentIntent.captureMethod).toBe(CaptureMethodEnum.AUTOMATIC);
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

  it('takes a standalone payment that is attached to no invoice at all', async () => {
    const customer = await fastify.customerService.createCustomer({
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
    });

    await makePaymentMethod(fastify, customer.id);

    const paymentIntent = await fastify.paymentService.createPaymentIntent({
      customerId: customer.id,
      amount: 120_000,
    });
    const settled = await settle(paymentIntent.id);

    expect(settled.invoiceId).toBeNull();
    expect(settled.status).toBe(PaymentIntentStatusEnum.SUCCEEDED);
    expect(settled.amountReceived).toBe(120_000);
  });

  it('refuses a standalone payment with no amount to charge', async () => {
    const customer = await fastify.customerService.createCustomer({
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
    });

    await expect(
      fastify.paymentService.createPaymentIntent({ customerId: customer.id }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses a payment intent with neither an invoice nor a customer', async () => {
    await expect(fastify.paymentService.createPaymentIntent({ amount: 1_000 })).rejects.toThrow(
      BadRequestError,
    );
  });
});

describe('PaymentService.confirmPaymentIntent', () => {
  it('leaves the intent processing rather than claiming the money is in', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const confirmed = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(confirmed.status).toBe(PaymentIntentStatusEnum.PROCESSING);
    expect(confirmed.pspReference).toMatch(/^mockpsp_/);
    expect(confirmed.charges).toHaveLength(0);
    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
  });

  it('settles the invoice and moves the receivable into cash once the callback lands', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const settled = await settle(paymentIntent.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(settled.status).toBe(PaymentIntentStatusEnum.SUCCEEDED);
    expect(settled.amountReceived).toBe(BASE_AMOUNT);
    expect(settled.latestChargeId).not.toBeNull();
    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
    expect(await readReceivable(customerId)).toBe(0);
  });

  it('records one captured charge behind the intent it settled', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const settled = await settle(paymentIntent.id);
    const [charge] = settled.charges;

    expect(settled.charges).toHaveLength(1);
    expect(charge).toMatchObject({
      status: ChargeStatusEnum.SUCCEEDED,
      outcome: ChargeOutcomeEnum.APPROVED,
      captured: true,
      amountCaptured: BASE_AMOUNT,
      amountRefunded: 0,
    });
    expect(_.get(charge, 'balanceTransactionId')).toBeNull();
  });

  it('parks a card that needs 3DS in requires_action with somewhere to send the customer', async () => {
    const { invoiceId } = await makeOpenInvoice(PspTokenEnum.VISA_3DS);
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const confirmed = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    await fastify.paymentService.drainProviderEvents();

    const stillWaiting = await fastify.paymentService.getPaymentIntent(paymentIntent.id);
    const { pspReference, nextAction } = confirmed;
    const expectedReference = pspReference === null ? 'no-reference' : pspReference;
    const redirectUrl = _.get(nextAction, 'redirectUrl');

    expect(confirmed.status).toBe(PaymentIntentStatusEnum.REQUIRES_ACTION);
    expect(redirectUrl).toContain(expectedReference);
    expect(stillWaiting.status).toBe(PaymentIntentStatusEnum.REQUIRES_ACTION);
  });

  it('finishes a 3DS payment through the callback and pays the invoice exactly once', async () => {
    const { invoiceId } = await makeOpenInvoice(PspTokenEnum.VISA_3DS);
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });
    const confirmed = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    const { pspReference } = confirmed;
    const authenticationReference = pspReference === null ? '' : pspReference;

    fastify.psp.completeAuthentication(authenticationReference);
    await fastify.paymentService.drainProviderEvents();

    const settled = await fastify.paymentService.getPaymentIntent(paymentIntent.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);
    const payments = await fastify.invoiceRepository.findInvoicePayments([invoiceId]);

    expect(settled.status).toBe(PaymentIntentStatusEnum.SUCCEEDED);
    expect(settled.charges).toHaveLength(1);
    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
    expect(payments).toHaveLength(1);
  });

  it('leaves the invoice untouched when the processor declines', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice(PspTokenEnum.CARD_DECLINED);
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const declined = await settle(paymentIntent.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(declined.status).toBe(PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD);
    expect(declined.declineCode).toBe(DeclineCodeEnum.GENERIC_DECLINE);
    expect(declined.failureCode).toBe('card_declined');
    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
    expect(await readReceivable(customerId)).toBe(BASE_AMOUNT);
  });

  it('keeps a declined charge on the record so the attempt is still auditable', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice(PspTokenEnum.CARD_DECLINED);
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await settle(paymentIntent.id);

    const workingPaymentMethod = await makePaymentMethod(fastify, customerId);
    const succeeded = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {
      paymentMethodId: workingPaymentMethod.id,
    });

    await fastify.paymentService.drainProviderEvents();

    const final = await fastify.paymentService.getPaymentIntent(succeeded.id);

    expect(_.map(final.charges, 'outcome')).toEqual([
      ChargeOutcomeEnum.DECLINED,
      ChargeOutcomeEnum.APPROVED,
    ]);
  });

  it('refuses to confirm an intent that already succeeded', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await settle(paymentIntent.id);

    await expect(fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {})).rejects.toThrow(
      ConflictError,
    );
  });

  it('refuses to confirm when there is no payment method anywhere to charge', async () => {
    const customer = await fastify.customerService.createCustomer({
      email: `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`,
      currency: CurrencyEnum.VND,
    });
    const paymentIntent = await fastify.paymentService.createPaymentIntent({
      customerId: customer.id,
      amount: 10_000,
    });

    await expect(fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {})).rejects.toThrow(
      BadRequestError,
    );
  });
});

describe('PaymentService.capturePaymentIntent', () => {
  it('holds an authorization in requires_capture instead of taking the money', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({
      invoiceId,
      captureMethod: CaptureMethodEnum.MANUAL,
    });

    const authorized = await settle(paymentIntent.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);
    const [charge] = authorized.charges;

    expect(authorized.status).toBe(PaymentIntentStatusEnum.REQUIRES_CAPTURE);
    expect(authorized.amountCapturable).toBe(BASE_AMOUNT);
    expect(authorized.amountReceived).toBe(0);
    expect(charge).toMatchObject({ outcome: ChargeOutcomeEnum.AUTHORIZED, captured: false });
    expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
  });

  it('pays the invoice when the authorization is captured', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({
      invoiceId,
      captureMethod: CaptureMethodEnum.MANUAL,
    });

    await settle(paymentIntent.id);
    await fastify.paymentService.capturePaymentIntent(paymentIntent.id, {});
    await fastify.paymentService.drainProviderEvents();

    const captured = await fastify.paymentService.getPaymentIntent(paymentIntent.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(captured.status).toBe(PaymentIntentStatusEnum.SUCCEEDED);
    expect(captured.amountReceived).toBe(BASE_AMOUNT);
    expect(invoice.status).toBe(InvoiceStatusEnum.PAID);
  });

  it('refuses to capture more than was authorized', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({
      invoiceId,
      captureMethod: CaptureMethodEnum.MANUAL,
    });

    await settle(paymentIntent.id);

    await expect(
      fastify.paymentService.capturePaymentIntent(paymentIntent.id, { amount: BASE_AMOUNT + 1 }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses to capture an intent that never authorized anything', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    await expect(fastify.paymentService.capturePaymentIntent(paymentIntent.id, {})).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('PaymentService.cancelPaymentIntent', () => {
  it('keeps the reason the intent was given up on', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const canceled = await fastify.paymentService.cancelPaymentIntent(paymentIntent.id, {
      cancellationReason: PaymentCancellationReasonEnum.DUPLICATE,
    });

    expect(canceled.status).toBe(PaymentIntentStatusEnum.CANCELED);
    expect(canceled.cancellationReason).toBe(PaymentCancellationReasonEnum.DUPLICATE);
  });

  it('defaults the reason to the customer having asked', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });

    const canceled = await fastify.paymentService.cancelPaymentIntent(paymentIntent.id, {});

    expect(canceled.cancellationReason).toBe(PaymentCancellationReasonEnum.REQUESTED_BY_CUSTOMER);
  });
});

describe('PaymentService.handleProviderEvent', () => {
  it('applies a redelivered callback exactly once', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });
    const confirmed = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});
    const [event] = fastify.psp.takePendingEvents();

    if (!event) {
      throw new Error('the simulated processor queued no callback to redeliver');
    }

    const first = await fastify.paymentService.handleProviderEvent(PspProviderEnum.MOCK, event);
    const second = await fastify.paymentService.handleProviderEvent(PspProviderEnum.MOCK, event);

    const settled = await fastify.paymentService.getPaymentIntent(paymentIntent.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);
    const payments = await fastify.invoiceRepository.findInvoicePayments([invoiceId]);

    expect(confirmed.status).toBe(PaymentIntentStatusEnum.PROCESSING);
    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(settled.charges).toHaveLength(1);
    expect(invoice.amountPaid).toBe(BASE_AMOUNT);
    expect(payments).toHaveLength(1);
  });

  it('ignores a second callback that arrives under a new event id for a settled intent', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });
    const confirmed = await fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    await fastify.paymentService.drainProviderEvents();

    const { pspReference } = confirmed;
    const reference = pspReference === null ? '' : pspReference;

    await fastify.paymentService.handleProviderEvent(PspProviderEnum.MOCK, {
      id: `mockpsp_evt_${generateGid(ObjectPrefixEnum.PSP_EVENT)}`,
      type: PspEventTypeEnum.PAYMENT_SUCCEEDED,
      reference,
      amount: BASE_AMOUNT,
    });

    const settled = await fastify.paymentService.getPaymentIntent(paymentIntent.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(settled.charges).toHaveLength(1);
    expect(invoice.amountPaid).toBe(BASE_AMOUNT);
  });
});

describe('RefundService.createRefund', () => {
  it('returns money already taken and reduces revenue rather than the receivable', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice();
    const chargeId = await settleCharge(invoiceId);

    const refund = await fastify.refundService.createRefund({
      chargeId,
      amount: 200_000,
      reason: 'Khách trả lại dịch vụ',
    });

    await fastify.paymentService.drainProviderEvents();

    const settledRefund = await fastify.refundService.getRefund(refund.id);
    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(refund.status).toBe(RefundStatusEnum.PENDING);
    expect(settledRefund.status).toBe(RefundStatusEnum.SUCCEEDED);
    expect(refund.amount).toBe(200_000);
    expect(refund.chargeId).toBe(chargeId);
    expect(refund.pspReference).toMatch(/^mockpsp_/);
    expect(invoice.amountRefunded).toBe(200_000);
    expect(await readReceivable(customerId)).toBe(0);
  });

  it('refunds the whole charge when no amount is given', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const chargeId = await settleCharge(invoiceId);

    const refund = await fastify.refundService.createRefund({ chargeId, reason: 'Hoàn toàn bộ' });

    expect(refund.amount).toBe(BASE_AMOUNT);
  });

  it('takes a second refund on the same charge while there is money left', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const chargeId = await settleCharge(invoiceId);

    await fastify.refundService.createRefund({ chargeId, amount: 100_000, reason: 'Phần một' });
    await fastify.paymentService.drainProviderEvents();

    const second = await fastify.refundService.createRefund({
      chargeId,
      amount: 50_000,
      reason: 'Phần hai',
    });

    await fastify.paymentService.drainProviderEvents();

    const invoice = await fastify.invoiceService.getInvoice(invoiceId);

    expect(second.amount).toBe(50_000);
    expect(invoice.amountRefunded).toBe(150_000);
  });

  it('refuses to refund more than the charge took', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const chargeId = await settleCharge(invoiceId);

    await fastify.refundService.createRefund({
      chargeId,
      amount: BASE_AMOUNT,
      reason: 'Hoàn toàn bộ',
    });

    await expect(
      fastify.refundService.createRefund({ chargeId, amount: 1, reason: 'Một đồng nữa' }),
    ).rejects.toThrow(BadRequestError);
  });

  it('refuses to refund a charge that never took money', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice();
    const paymentIntent = await fastify.paymentService.createPaymentIntent({ invoiceId });
    const chargeId = generateGid(ObjectPrefixEnum.CHARGE);

    await fastify.paymentIntentRepository.createCharge({
      id: chargeId,
      paymentIntentId: paymentIntent.id,
      customerId,
      paymentMethodId: null,
      currency: CurrencyEnum.VND,
      amount: BASE_AMOUNT,
      amountCaptured: 0,
      amountRefunded: 0,
      captured: false,
      status: ChargeStatusEnum.FAILED,
      outcome: ChargeOutcomeEnum.DECLINED,
      balanceTransactionId: null,
      paymentMethodDetails: {},
      failureCode: null,
      declineCode: null,
      failureMessage: null,
      pspReference: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      fastify.refundService.createRefund({ chargeId, amount: 1, reason: 'Chưa thu được đồng nào' }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('refund records are append-only in the database', () => {
  it('rejects a direct rewrite of a refund', async () => {
    const { invoiceId } = await makeOpenInvoice();
    const chargeId = await settleCharge(invoiceId);

    const refund = await fastify.refundService.createRefund({
      chargeId,
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
