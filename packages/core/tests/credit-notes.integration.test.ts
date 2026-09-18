import { CreditNoteStatusEnum, CreditNoteTypeEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { RefundStatusEnum } from '@contracts/payments.types';
import { ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice, settleInvoice } from './factories';

const BASE_AMOUNT = 500_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function readCreditBalance(customerId: string): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
    CurrencyEnum.VND,
    customerId,
  );

  return account.balance;
}

describe('CreditNoteService.createCreditNote after the invoice was paid', () => {
  it('splits the credit between a refund, an out of band return and the customer balance', async () => {
    const { invoiceId, customerId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });

    await settleInvoice(fastify, invoiceId);

    const cashBefore = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.CASH,
      CurrencyEnum.VND,
    );
    const creditNote = await fastify.creditNoteService.createCreditNote({
      invoiceId,
      lines: [
        { amount: 120_000, description: 'Một ngày không dùng' },
        { amount: 80_000, description: 'Phí kích hoạt tính thừa' },
      ],
      refundAmount: 100_000,
      outOfBandAmount: 40_000,
      reason: 'Điều chỉnh sau khi đã thu tiền',
    });

    await fastify.paymentService.drainProviderEvents();

    const { refundId: creditNoteRefundId } = creditNote;
    const refundId = creditNoteRefundId === null ? '' : creditNoteRefundId;

    const refund = await fastify.refundService.getRefund(refundId);
    const cashAfter = await fastify.ledgerService.ensureAccount(
      LedgerAccountCodeEnum.CASH,
      CurrencyEnum.VND,
    );

    expect(creditNote.type).toBe(CreditNoteTypeEnum.POST_PAYMENT);
    expect(creditNote.amount).toBe(200_000);
    expect(creditNote.lines).toHaveLength(2);
    expect(creditNote.refundAmount).toBe(100_000);
    expect(creditNote.outOfBandAmount).toBe(40_000);
    expect(creditNote.creditAmount).toBe(60_000);
    expect(refund.status).toBe(RefundStatusEnum.SUCCEEDED);
    expect(refund.creditNoteId).toBe(creditNote.id);
    expect(await readCreditBalance(customerId)).toBe(60_000);
    expect(cashAfter.balance).toBe(cashBefore.balance - 40_000);
  });

  it('refuses to return more than the credit note is worth', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });

    await settleInvoice(fastify, invoiceId);

    await expect(
      fastify.creditNoteService.createCreditNote({
        invoiceId,
        lines: [{ amount: 50_000 }],
        refundAmount: 60_000,
        reason: 'Hoàn quá tay',
      }),
    ).rejects.toThrow(/cannot return/);
  });

  it('refuses to void a credit note that has already returned money', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });

    await settleInvoice(fastify, invoiceId);

    const creditNote = await fastify.creditNoteService.createCreditNote({
      invoiceId,
      lines: [{ amount: 30_000 }],
      refundAmount: 30_000,
      reason: 'Đã hoàn tiền',
    });

    await fastify.paymentService.drainProviderEvents();

    await expect(fastify.creditNoteService.voidCreditNote(creditNote.id, {})).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('CreditNoteService.voidCreditNote', () => {
  it('refuses to void the same credit note twice', async () => {
    const { invoiceId } = await makeOpenInvoice(fastify, { unitAmount: BASE_AMOUNT });

    const creditNote = await fastify.creditNoteService.createCreditNote({
      invoiceId,
      lines: [{ amount: 10_000 }],
      reason: 'Ghi nhầm',
    });
    const voided = await fastify.creditNoteService.voidCreditNote(creditNote.id, {});

    expect(voided.status).toBe(CreditNoteStatusEnum.VOID);

    await expect(fastify.creditNoteService.voidCreditNote(creditNote.id, {})).rejects.toThrow(
      ConflictError,
    );
  });
});
