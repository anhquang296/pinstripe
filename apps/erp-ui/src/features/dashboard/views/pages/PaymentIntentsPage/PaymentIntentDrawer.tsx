import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import type { CancelPaymentIntentFormData } from '@common/forms/cancel-payment-intent-form';
import {
  cancelPaymentIntentFormDataToPayload,
  cancelPaymentIntentFormDefaultValues,
  cancelPaymentIntentFormResolver,
} from '@common/forms/cancel-payment-intent-form';
import { formatCurrency, formatDate } from '@common/utils/format';
import CancelPaymentIntentForm from '@features/dashboard/components/CancelPaymentIntentForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { CurrencyEnum, PaymentIntentStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import { useCancelPaymentIntentMutation, usePaymentIntentQuery } from '@vxrerp/sdk/react';
import { get, includes } from 'lodash-es';
import { useForm } from 'react-hook-form';

const CANCELABLE_STATUSES = [
  PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
  PaymentIntentStatusEnum.REQUIRES_CONFIRMATION,
  PaymentIntentStatusEnum.REQUIRES_ACTION,
  PaymentIntentStatusEnum.PROCESSING,
  PaymentIntentStatusEnum.REQUIRES_CAPTURE,
];

interface PaymentIntentDrawerProps {
  paymentIntentId: string;
  onClose: () => void;
}

export default function PaymentIntentDrawer({
  paymentIntentId,
  onClose,
}: PaymentIntentDrawerProps) {
  const canRefund = useCan(PermissionEnum.REFUND_WRITE);

  const { data: paymentIntent } = usePaymentIntentQuery(paymentIntentId);

  const { mutateAsync: cancelPaymentIntent, isPending: isCanceling } =
    useCancelPaymentIntentMutation({ successMessage: 'Đã huỷ payment intent.' });

  const form = useForm<CancelPaymentIntentFormData>({
    resolver: cancelPaymentIntentFormResolver,
    defaultValues: cancelPaymentIntentFormDefaultValues,
  });

  const currency = get(paymentIntent, 'currency', CurrencyEnum.VND);
  const status = get(paymentIntent, 'status', PaymentIntentStatusEnum.PROCESSING);
  const isCancelable = includes(CANCELABLE_STATUSES, status);

  const handleOnCancel = form.handleSubmit(async (formData) => {
    await cancelPaymentIntent({
      id: paymentIntentId,
      payload: cancelPaymentIntentFormDataToPayload(formData),
    });
    onClose();
  });

  return (
    <EntityDrawer
      isOpen
      title={paymentIntentId}
      description={get(paymentIntent, 'invoiceId') ?? get(paymentIntent, 'customerId', '')}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'Trạng thái', value: <StatusChip status={status} /> },
              { label: 'Khách hàng', value: get(paymentIntent, 'customerId', '—') },
              { label: 'Hoá đơn', value: get(paymentIntent, 'invoiceId') ?? '—' },
              {
                label: 'Số tiền',
                value: formatCurrency(get(paymentIntent, 'amount', 0), currency),
              },
              {
                label: 'Đã nhận',
                value: formatCurrency(get(paymentIntent, 'amountReceived', 0), currency),
              },
              { label: 'Cách thu', value: get(paymentIntent, 'captureMethod', '—') },
              { label: 'Mã PSP', value: get(paymentIntent, 'pspReference') ?? '—' },
              { label: 'Lý do thất bại', value: get(paymentIntent, 'failureMessage') ?? '—' },
              { label: 'Lý do huỷ', value: get(paymentIntent, 'cancellationReason') ?? '—' },
              { label: 'Tạo lúc', value: formatDate(get(paymentIntent, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        <DataTable
          label="Các lần thử"
          rows={get(paymentIntent, 'charges', [])}
          emptyMessage="Intent này chưa có lần thử nào."
          columns={[
            {
              key: 'id',
              label: 'Charge',
              isRowHeader: true,
              renderCell: (charge) => {
                return <span className="font-mono text-[11px]">{charge.id}</span>;
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              renderCell: (charge) => {
                return <StatusChip status={charge.status} />;
              },
            },
            {
              key: 'outcome',
              label: 'Kết quả',
              renderCell: (charge) => {
                return charge.outcome;
              },
            },
            {
              key: 'amount',
              label: 'Số tiền',
              renderCell: (charge) => {
                return formatCurrency(charge.amount, charge.currency);
              },
            },
            {
              key: 'amountRefunded',
              label: 'Đã hoàn',
              renderCell: (charge) => {
                return formatCurrency(charge.amountRefunded, charge.currency);
              },
            },
            {
              key: 'declineCode',
              label: 'Mã từ chối',
              renderCell: (charge) => {
                return charge.declineCode ?? '—';
              },
            },
          ]}
        />

        {canRefund && isCancelable ? (
          <DrawerSection title="Huỷ payment intent">
            <CancelPaymentIntentForm form={form} isSaving={isCanceling} onSave={handleOnCancel} />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
