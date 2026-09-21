import { DeclineCodeEnum } from '@contracts/payments.types';
import { NotificationKindEnum } from '@queues/notification.queue';
import { CurrencyEnum } from '@utils/currency';
import { describe, expect, it } from 'vitest';

import type { NotificationContext } from './notification-template';
import { buildNotificationEmail } from './notification-template';

function makeContext(overrides: Partial<NotificationContext> = {}): NotificationContext {
  return {
    customerName: 'Nhà xe Hà Linh',
    invoiceNumber: 'INV-000001',
    amount: 500_000,
    currency: CurrencyEnum.VND,
    declineCode: null,
    nextAttemptAt: null,
    dueAt: null,
    url: null,
    message: null,
    ...overrides,
  };
}

describe('buildNotificationEmail', () => {
  it('names the invoice and the amount in a finalized notice', () => {
    const email = buildNotificationEmail(NotificationKindEnum.INVOICE_FINALIZED, makeContext());

    expect(email.subject).toBe('Vexere đã phát hành hóa đơn INV-000001');
    expect(email.text).toContain('500.000');
  });

  it('greets the customer by name and keeps the html and text in step', () => {
    const email = buildNotificationEmail(NotificationKindEnum.PAYMENT_SUCCEEDED, makeContext());

    expect(email.text).toContain('Kính gửi Nhà xe Hà Linh,');
    expect(email.html).toContain('<p>Kính gửi Nhà xe Hà Linh,</p>');
  });

  it('greets a nameless customer without a dangling name', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_SUCCEEDED,
      makeContext({ customerName: '' }),
    );

    expect(email.text).toContain('Kính gửi quý khách,');
  });

  it('escapes markup in the customer name rather than rendering it', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_SUCCEEDED,
      makeContext({ customerName: '<b>Nhà xe</b>' }),
    );

    expect(email.html).toContain('&lt;b&gt;Nhà xe&lt;/b&gt;');
    expect(email.html).not.toContain('<b>');
  });

  it('reports the decline code and the next attempt on a failure notice', () => {
    const nextAttemptAt = new Date('2026-03-01T00:00:00.000Z');

    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_FAILED,
      makeContext({ declineCode: DeclineCodeEnum.INSUFFICIENT_FUNDS, nextAttemptAt }),
    );

    expect(email.subject).toBe('Thanh toán cho hóa đơn INV-000001 bị từ chối');
    expect(email.text).toContain('insufficient_funds');
    expect(email.text).toContain(nextAttemptAt.toISOString());
  });

  it('says the card will not be tried again when no retry is scheduled', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_FAILED,
      makeContext({ declineCode: DeclineCodeEnum.STOLEN_CARD }),
    );

    expect(email.text).toContain('Vexere sẽ không thử lại với thẻ này.');
  });

  it('falls back to the account when there is no invoice behind the notice', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PAYMENT_ABANDONED,
      makeContext({ invoiceNumber: null }),
    );

    expect(email.subject).toBe('Không thu được tài khoản của quý khách');
  });

  it('names the due date in Vietnam time and links the portal in a due-soon reminder', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.INVOICE_DUE_SOON,
      makeContext({
        dueAt: new Date('2026-09-21T18:00:00.000Z'),
        url: 'https://portal.test/invoices/in_1',
      }),
    );

    expect(email.subject).toBe('Nhắc thanh toán: hóa đơn INV-000001 đến hạn ngày 22/09/2026');
    expect(email.text).toContain('https://portal.test/invoices/in_1');
  });

  it('asks the customer to pay an overdue invoice and to ignore the mail if already paid', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.INVOICE_OVERDUE,
      makeContext({ dueAt: new Date('2026-09-10T00:00:00.000Z') }),
    );

    expect(email.subject).toBe('Hóa đơn INV-000001 đã quá hạn thanh toán');
    expect(email.text).toContain('xin bỏ qua thư này');
  });

  it('marks the internal overdue notice as internal and names the operator', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.INVOICE_OVERDUE_INTERNAL,
      makeContext({ dueAt: new Date('2026-09-10T00:00:00.000Z') }),
    );

    expect(email.subject).toBe('[Nội bộ] Nhà xe Hà Linh: hóa đơn INV-000001 quá hạn');
    expect(email.text).toContain('Kính gửi bộ phận kế toán Vexere,');
  });

  it('carries the operator message into a plan change request', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PORTAL_PLAN_CHANGE_REQUEST,
      makeContext({ message: 'Nhà xe muốn lên gói Pro từ tháng sau' }),
    );

    expect(email.subject).toBe('[Cổng nhà xe] Nhà xe Hà Linh yêu cầu đổi gói');
    expect(email.text).toContain('Nội dung yêu cầu: Nhà xe muốn lên gói Pro từ tháng sau');
  });

  it('says the operator left no message when a profile update request is empty', () => {
    const email = buildNotificationEmail(
      NotificationKindEnum.PORTAL_PROFILE_UPDATE_REQUEST,
      makeContext(),
    );

    expect(email.subject).toBe('[Cổng nhà xe] Nhà xe Hà Linh yêu cầu cập nhật hồ sơ');
    expect(email.text).toContain('Nhà xe không ghi nội dung yêu cầu.');
  });
});
