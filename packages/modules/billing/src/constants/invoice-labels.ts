import type { InvoiceStatus } from '@contracts/invoices.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [InvoiceStatusEnum.DRAFT]: 'Bản nháp',
  [InvoiceStatusEnum.OPEN]: 'Chưa thanh toán',
  [InvoiceStatusEnum.PAID]: 'Đã thanh toán',
  [InvoiceStatusEnum.VOID]: 'Đã hủy',
  [InvoiceStatusEnum.UNCOLLECTIBLE]: 'Không thu được',
};

export const OVERDUE_INVOICE_LABEL = 'Quá hạn';
