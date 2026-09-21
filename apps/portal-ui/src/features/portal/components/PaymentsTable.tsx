'use client';

import DataTable from '@common/components/DataTable';
import { formatCurrency, formatDateTime } from '@common/utils/format';
import { PAYMENT_CHANNEL_LABELS } from '@features/portal/constants/labels';
import type { PortalPaymentResponse } from '@vxrerp/sdk';

interface PaymentsTableProps {
  payments: PortalPaymentResponse[];
  isLoading: boolean;
  emptyMessage?: string;
  onPaymentSelect?: (payment: PortalPaymentResponse) => void;
}

const COLUMNS = [
  {
    key: 'paidAt',
    label: 'Thời gian',
    isRowHeader: true,
    renderCell: (payment: PortalPaymentResponse) => {
      return <span className="whitespace-nowrap">{formatDateTime(payment.paidAt)}</span>;
    },
  },
  {
    key: 'invoice',
    label: 'Hóa đơn',
    renderCell: (payment: PortalPaymentResponse) => {
      const { invoiceNumber } = payment;

      return <span className="whitespace-nowrap">{invoiceNumber || payment.invoiceId}</span>;
    },
  },
  {
    key: 'channel',
    label: 'Hình thức',
    renderCell: (payment: PortalPaymentResponse) => {
      return PAYMENT_CHANNEL_LABELS[payment.channel];
    },
  },
  {
    key: 'amount',
    label: 'Số tiền',
    align: 'end' as const,
    renderCell: (payment: PortalPaymentResponse) => {
      return formatCurrency(payment.amount, payment.currency);
    },
  },
];

export default function PaymentsTable({
  payments,
  isLoading,
  emptyMessage = 'Chưa có khoản thanh toán nào.',
  onPaymentSelect,
}: PaymentsTableProps) {
  return (
    <DataTable
      label="Lịch sử thanh toán"
      columns={COLUMNS}
      rows={payments}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      onRowAction={onPaymentSelect}
    />
  );
}
