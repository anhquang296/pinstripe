'use client';

import PageCard from '@common/components/PageCard';
import PaymentsTable from '@features/portal/components/PaymentsTable';
import type { PortalPaymentResponse } from '@pinstripe/sdk';
import { usePortalPaymentsQuery } from '@pinstripe/sdk/react/portal';
import { get } from 'lodash-es';
import { useRouter } from 'next/navigation';

const PAYMENT_HISTORY_LIMIT = 100;

export default function PaymentsPage() {
  const router = useRouter();
  const { data: payments, isPending } = usePortalPaymentsQuery({ limit: PAYMENT_HISTORY_LIMIT });

  const handleOnPaymentSelect = (payment: PortalPaymentResponse) => {
    router.push(`/invoices/${payment.invoiceId}`);
  };

  return (
    <PageCard
      title="Lịch sử thanh toán"
      description="Các khoản Vexere đã ghi nhận cho hóa đơn của nhà xe, mới nhất trước."
    >
      <PaymentsTable
        payments={get(payments, 'data', [])}
        isLoading={isPending}
        onPaymentSelect={handleOnPaymentSelect}
      />
    </PageCard>
  );
}
