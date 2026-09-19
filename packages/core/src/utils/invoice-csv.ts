import { INVOICE_STATUS_LABELS, OVERDUE_INVOICE_LABEL } from '@constants/invoice-labels';
import type { InvoiceResponse } from '@contracts/invoices.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { Money } from '@utils/money';
import _ from 'lodash';

const BYTE_ORDER_MARK = '﻿';
const LINE_BREAK = '\r\n';
const HEADER = [
  'Số hóa đơn',
  'Kỳ từ',
  'Kỳ đến',
  'Ngày phát hành',
  'Hạn thanh toán',
  'Trạng thái',
  'Tổng tiền',
  'Đã thanh toán',
  'Còn phải trả',
  'Tiền tệ',
];

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatCsvDate(isoDate: string | null): string {
  if (isoDate) {
    return dateFormatter.format(new Date(isoDate));
  }

  return '';
}

function formatCsvAmount(minorAmount: number, invoice: InvoiceResponse): string {
  return String(Money.of(minorAmount, invoice.currency).toMajorUnit());
}

function resolveStatusLabel(invoice: InvoiceResponse, now: Date): string {
  const { dueAt } = invoice;
  const isOverdue =
    invoice.status === InvoiceStatusEnum.OPEN && dueAt !== null && new Date(dueAt) < now;

  if (isOverdue) {
    return OVERDUE_INVOICE_LABEL;
  }

  return INVOICE_STATUS_LABELS[invoice.status];
}

export function buildInvoicesCsv(invoices: readonly InvoiceResponse[], now: Date): string {
  const rows = _.map(invoices, (invoice) => {
    const { number } = invoice;

    return [
      number || invoice.id,
      formatCsvDate(invoice.periodStart),
      formatCsvDate(invoice.periodEnd),
      formatCsvDate(invoice.finalizedAt),
      formatCsvDate(invoice.dueAt),
      resolveStatusLabel(invoice, now),
      formatCsvAmount(invoice.total, invoice),
      formatCsvAmount(invoice.amountPaid, invoice),
      formatCsvAmount(invoice.amountRemaining, invoice),
      _.toUpper(invoice.currency),
    ];
  });

  const lines = _.map([HEADER, ...rows], (cells) => {
    return _.map(cells, escapeCell).join(',');
  });

  return `${BYTE_ORDER_MARK}${lines.join(LINE_BREAK)}${LINE_BREAK}`;
}
