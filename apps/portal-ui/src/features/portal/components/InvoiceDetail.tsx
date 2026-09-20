import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import PageCard from '@common/components/PageCard';
import StatusChip from '@common/components/StatusChip';
import { formatCurrency, formatDate } from '@common/utils/format';
import BankTransferCard from '@features/portal/components/BankTransferCard';
import InvoiceComparisonCard from '@features/portal/components/InvoiceComparisonCard';
import InvoiceRemindersCard from '@features/portal/components/InvoiceRemindersCard';
import PaymentsTable from '@features/portal/components/PaymentsTable';
import { COLLECTION_METHOD_LABELS } from '@features/portal/constants/labels';
import {
  resolveInvoiceStatusLabel,
  resolveOverdueDays,
} from '@features/portal/utils/invoice-state';
import { buttonVariants, Card, Link } from '@heroui/react';
import type {
  InvoiceResponse,
  PortalBankTransferResponse,
  PortalInvoiceComparisonResponse,
  PortalInvoiceRemindersResponse,
  PortalPaymentResponse,
} from '@pinstripe/sdk';
import { map } from 'lodash-es';

interface InvoiceDetailProps {
  invoice: InvoiceResponse;
  bankTransfer: PortalBankTransferResponse | null;
  comparison: PortalInvoiceComparisonResponse | null;
  reminders: PortalInvoiceRemindersResponse['reminders'];
  payments: PortalPaymentResponse[];
  isPaymentsLoading: boolean;
}

type InvoiceLineItem = InvoiceResponse['lineItems'][number];

function buildOptionalDate(isoDate: string | null): string {
  if (isoDate) {
    return formatDate(isoDate);
  }

  return '—';
}

export default function InvoiceDetail({
  invoice,
  bankTransfer,
  comparison,
  reminders,
  payments,
  isPaymentsLoading,
}: InvoiceDetailProps) {
  const now = new Date();

  const { number, currency } = invoice;

  const { label, tone } = resolveInvoiceStatusLabel(invoice, now);

  const overdueDays = resolveOverdueDays(invoice, now);
  const dueLabel = buildOptionalDate(invoice.dueAt);
  const overdueDescription = overdueDays > 0 ? `Đã quá hạn ${overdueDays} ngày.` : undefined;
  const pdfUrl = `/bff/v1/portal/invoices/${encodeURIComponent(invoice.id)}/pdf`;

  const amount = (value: number) => {
    return formatCurrency(value, currency);
  };

  const lineItemColumns = [
    {
      key: 'description',
      label: 'Dịch vụ',
      isRowHeader: true,
      renderCell: (lineItem: InvoiceLineItem) => {
        return lineItem.description;
      },
    },
    {
      key: 'period',
      label: 'Kỳ',
      renderCell: (lineItem: InvoiceLineItem) => {
        return `${formatDate(lineItem.periodStart)} – ${formatDate(lineItem.periodEnd)}`;
      },
    },
    {
      key: 'quantity',
      label: 'Số lượng',
      align: 'end' as const,
      renderCell: (lineItem: InvoiceLineItem) => {
        return lineItem.quantity;
      },
    },
    {
      key: 'unitAmount',
      label: 'Đơn giá',
      align: 'end' as const,
      renderCell: (lineItem: InvoiceLineItem) => {
        const { unitAmount } = lineItem;

        if (unitAmount === null) {
          return '—';
        }

        return amount(unitAmount);
      },
    },
    {
      key: 'amount',
      label: 'Thành tiền',
      align: 'end' as const,
      renderCell: (lineItem: InvoiceLineItem) => {
        return amount(lineItem.amount);
      },
    },
  ];

  const totals = [
    { label: 'Tạm tính', value: amount(invoice.subtotal) },
    { label: 'Giảm giá', value: amount(invoice.totalDiscountAmount) },
    { label: 'Thuế', value: amount(invoice.totalTaxAmount) },
    { label: 'Tổng cộng', value: amount(invoice.total) },
    { label: 'Đã thanh toán', value: amount(invoice.amountPaid) },
    { label: 'Còn phải trả', value: amount(invoice.amountRemaining) },
  ];

  return (
    <PageCard
      title={
        <span className="flex items-center gap-3">
          Hóa đơn {number || invoice.id}
          <StatusChip label={label} tone={tone} />
        </span>
      }
      description={overdueDescription}
      actions={
        <>
          <Link href="/invoices">Quay lại</Link>
          <a className={buttonVariants()} href={pdfUrl} download>
            Tải PDF
          </a>
        </>
      }
    >
      <Card>
        <Card.Content>
          <DetailList
            items={[
              {
                label: 'Kỳ dịch vụ',
                value: `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`,
              },
              { label: 'Ngày phát hành', value: buildOptionalDate(invoice.finalizedAt) },
              { label: 'Hạn thanh toán', value: dueLabel },
              { label: 'Ngày thanh toán', value: buildOptionalDate(invoice.paidAt) },
              {
                label: 'Hình thức thanh toán',
                value: COLLECTION_METHOD_LABELS[invoice.collectionMethod],
              },
            ]}
          />
        </Card.Content>
      </Card>

      <DataTable
        label="Chi tiết dịch vụ"
        columns={lineItemColumns}
        rows={invoice.lineItems}
        emptyMessage="Hóa đơn không có dòng dịch vụ."
      />

      <Card>
        <Card.Content>
          <dl className="ml-auto flex w-full max-w-sm flex-col gap-2">
            {map(totals, (total) => {
              return (
                <div key={total.label} className="flex justify-between gap-4">
                  <dt className="text-muted">{total.label}</dt>
                  <dd className="font-medium tabular-nums">{total.value}</dd>
                </div>
              );
            })}
          </dl>
        </Card.Content>
      </Card>

      {comparison ? <InvoiceComparisonCard comparison={comparison} /> : null}

      {bankTransfer ? <BankTransferCard bankTransfer={bankTransfer} /> : null}

      <InvoiceRemindersCard reminders={reminders} />

      <Card>
        <Card.Header>
          <Card.Title>Các lần thanh toán</Card.Title>
        </Card.Header>
      </Card>
      <PaymentsTable
        payments={payments}
        isLoading={isPaymentsLoading}
        emptyMessage="Hóa đơn này chưa ghi nhận khoản thanh toán nào."
      />
    </PageCard>
  );
}
