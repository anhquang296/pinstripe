import { DeclineCodeEnum } from '@contracts/payments.types';
import { NotificationKindEnum } from '@queues/notification.queue';
import { CurrencyEnum } from '@utils/currency';
import { describe, expect, it } from 'vitest';

import type { NotificationContext } from './notification-template';
import { buildNotificationEmail } from './notification-template';

function makeContext(overrides: Partial<NotificationContext> = {}): NotificationContext {
  return {
    customerName: 'Ha Linh',
    invoiceNumber: 'IN-0001',
    amount: 500_000,
    currency: CurrencyEnum.VND,
    declineCode: null,
    nextAttemptAt: null,
    url: null,
    ...overrides,
  };
}

describe('buildNotificationEmail', () => {
  it('names the invoice and the amount in a finalized notice', () => {
    const email = buildNotificationEmail(NotificationKindEnum.INVOICE_FINALIZED, makeContext());

    expect(email.subject).toBe('Your invoice IN-0001 is ready');
    expect(email.text).toContain('500000 VND');
  });

  it('greets the customer by name and keeps the html and text in step', () => {
    const email = buildNotificationEmail(NotificationKindEnum.PAYMENT_SUCCEEDED, makeContext());

    expect(email.text).toContain('Hello Ha Linh,');
    expect(email.html).toContain('<p>Hello Ha Linh,</p>');
  });

  it('greets a nameless customer without a dangling name', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_SUCCEEDED,
      makeContext({ customerName: '' }),
    );

    expect(email.text).toContain('Hello,');
  });

  it('reports the decline code and the next attempt on a failure notice', () => {
    const nextAttemptAt = new Date('2026-03-01T00:00:00.000Z');
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_FAILED,
      makeContext({ declineCode: DeclineCodeEnum.INSUFFICIENT_FUNDS, nextAttemptAt }),
    );

    expect(email.subject).toBe('Your payment for invoice IN-0001 was declined');
    expect(email.text).toContain('insufficient_funds');
    expect(email.text).toContain(nextAttemptAt.toISOString());
  });

  it('says the card will not be tried again when no retry is scheduled', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_FAILED,
      makeContext({ declineCode: DeclineCodeEnum.STOLEN_CARD }),
    );

    expect(email.text).toContain('We will not try this card again.');
  });

  it('falls back to the account when there is no invoice behind the notice', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_ABANDONED,
      makeContext({ invoiceNumber: null }),
    );

    expect(email.subject).toBe('We could not collect your account');
  });
});
