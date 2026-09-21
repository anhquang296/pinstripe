import type { StatusLabel } from '@features/portal/constants/labels';
import { INVOICE_STATUS_LABELS, OVERDUE_INVOICE_LABEL } from '@features/portal/constants/labels';
import { InvoiceStatusEnum } from '@vxrerp/billing/contracts';
import type { InvoiceResponse } from '@vxrerp/sdk';

const MILLISECONDS_PER_DAY = 86_400_000;

const calendarDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function readCalendarDay(date: Date): number {
  return Date.parse(`${calendarDayFormatter.format(date)}T00:00:00Z`) / MILLISECONDS_PER_DAY;
}

export function resolveOverdueDays(
  invoice: Pick<InvoiceResponse, 'status' | 'dueAt'>,
  now: Date,
): number {
  const { dueAt } = invoice;

  if (invoice.status === InvoiceStatusEnum.OPEN && dueAt && new Date(dueAt) < now) {
    const calendarDays = readCalendarDay(now) - readCalendarDay(new Date(dueAt));

    return Math.max(calendarDays, 1);
  }

  return 0;
}

export function resolveInvoiceStatusLabel(
  invoice: Pick<InvoiceResponse, 'status' | 'dueAt'>,
  now: Date,
): StatusLabel {
  if (resolveOverdueDays(invoice, now) > 0) {
    return OVERDUE_INVOICE_LABEL;
  }

  return INVOICE_STATUS_LABELS[invoice.status];
}
