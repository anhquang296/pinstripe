'use client';

import PageCard from '@common/components/PageCard';
import InvoiceDetail from '@features/portal/components/InvoiceDetail';
import { Alert, Link, Spinner } from '@heroui/react';
import { InvoiceStatusEnum } from '@pinstripe/core/contracts';
import {
  usePortalBankTransferQuery,
  usePortalInvoiceComparisonQuery,
  usePortalInvoiceQuery,
  usePortalInvoiceRemindersQuery,
  usePortalPaymentsQuery,
} from '@pinstripe/sdk/react/portal';
import { get } from 'lodash-es';
import { use } from 'react';

interface InvoicePageProps {
  params: Promise<{ invoiceId: string }>;
}

export default function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceId } = use(params);

  const { data: invoice, isPending } = usePortalInvoiceQuery(invoiceId);

  const isOpen = get(invoice, 'status') === InvoiceStatusEnum.OPEN;

  const { data: bankTransfer } = usePortalBankTransferQuery(invoiceId, { enabled: isOpen });

  const { data: payments, isPending: isPaymentsPending } = usePortalPaymentsQuery({ invoiceId });

  const { data: comparison } = usePortalInvoiceComparisonQuery(invoiceId);

  const { data: reminders } = usePortalInvoiceRemindersQuery(invoiceId);

  if (invoice) {
    const payableBankTransfer = isOpen && bankTransfer ? bankTransfer : null;

    return (
      <InvoiceDetail
        invoice={invoice}
        bankTransfer={payableBankTransfer}
        comparison={comparison ?? null}
        reminders={get(reminders, 'reminders', [])}
        payments={get(payments, 'data', [])}
        isPaymentsLoading={isPaymentsPending}
      />
    );
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <PageCard title="Hóa đơn" actions={<Link href="/invoices">Quay lại danh sách</Link>}>
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Không tìm thấy hóa đơn</Alert.Title>
          <Alert.Description>
            Hóa đơn này không tồn tại hoặc không thuộc nhà xe của bạn.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </PageCard>
  );
}
