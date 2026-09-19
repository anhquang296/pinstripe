'use client';

import DataTable from '@common/components/DataTable';
import StatusChip from '@common/components/StatusChip';
import { formatCurrency, formatDate } from '@common/utils/format';
import {
  resolveInvoiceStatusLabel,
  resolveOverdueDays,
} from '@features/portal/utils/invoice-state';
import type { InvoiceResponse } from '@pinstripe/sdk';

interface InvoicesTableProps {
  invoices: InvoiceResponse[];
  isLoading: boolean;
  emptyMessage?: string;
  hasMore?: boolean;
  hasPrevious?: boolean;
  onInvoiceSelect: (invoice: InvoiceResponse) => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

function renderDueDate(invoice: InvoiceResponse) {
  const { dueAt } = invoice;
  const overdueDays = resolveOverdueDays(invoice, new Date());

  if (dueAt && overdueDays > 0) {
    return (
      <span className="flex flex-col whitespace-nowrap">
        <span>{formatDate(dueAt)}</span>
        <span className="text-xs text-danger">Trễ {overdueDays} ngày</span>
      </span>
    );
  }

  if (dueAt) {
    return formatDate(dueAt);
  }

  return '—';
}

const COLUMNS = [
  {
    key: 'number',
    label: 'Số hóa đơn',
    isRowHeader: true,
    renderCell: (invoice: InvoiceResponse) => {
      const { number } = invoice;

      return <span className="font-medium whitespace-nowrap">{number || invoice.id}</span>;
    },
  },
  {
    key: 'period',
    label: 'Kỳ dịch vụ',
    renderCell: (invoice: InvoiceResponse) => {
      return (
        <span className="whitespace-nowrap">
          {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
        </span>
      );
    },
  },
  {
    key: 'dueAt',
    label: 'Hạn thanh toán',
    renderCell: renderDueDate,
  },
  {
    key: 'status',
    label: 'Trạng thái',
    renderCell: (invoice: InvoiceResponse) => {
      const { label, tone } = resolveInvoiceStatusLabel(invoice, new Date());

      return <StatusChip label={label} tone={tone} />;
    },
  },
  {
    key: 'total',
    label: 'Tổng tiền',
    align: 'end' as const,
    renderCell: (invoice: InvoiceResponse) => {
      return formatCurrency(invoice.total, invoice.currency);
    },
  },
  {
    key: 'amountRemaining',
    label: 'Còn phải trả',
    align: 'end' as const,
    renderCell: (invoice: InvoiceResponse) => {
      return (
        <span className="font-medium">
          {formatCurrency(invoice.amountRemaining, invoice.currency)}
        </span>
      );
    },
  },
];

export default function InvoicesTable({
  invoices,
  isLoading,
  emptyMessage = 'Chưa có hóa đơn nào.',
  hasMore,
  hasPrevious,
  onInvoiceSelect,
  onNext,
  onPrevious,
}: InvoicesTableProps) {
  return (
    <DataTable
      label="Danh sách hóa đơn"
      columns={COLUMNS}
      rows={invoices}
      emptyMessage={emptyMessage}
      isLoading={isLoading}
      hasMore={hasMore}
      hasPrevious={hasPrevious}
      onRowAction={onInvoiceSelect}
      onNext={onNext}
      onPrevious={onPrevious}
    />
  );
}
