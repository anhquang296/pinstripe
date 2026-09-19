'use client';

import PageCard from '@common/components/PageCard';
import InvoiceDetail from '@features/portal/components/InvoiceDetail';
import { Alert, Link, Spinner } from '@heroui/react';
import { usePortalInvoiceQuery } from '@pinstripe/sdk/react/portal';
import { use } from 'react';

interface InvoicePageProps {
  params: Promise<{ invoiceId: string }>;
}

export default function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceId } = use(params);
  const { data: invoice, isPending } = usePortalInvoiceQuery(invoiceId);

  if (invoice) {
    return <InvoiceDetail invoice={invoice} />;
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
