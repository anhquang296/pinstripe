import DataTable from '@components/DataTable';
import DetailList from '@components/DetailList';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import PaymentLinkForm from '@components/PaymentLinkForm';
import StatusChip from '@components/StatusChip';
import type { PaymentLinkFormData } from '@forms/payment-link-form';
import {
  paymentLinkFormDataToUpdatePayload,
  paymentLinkFormDefaultValues,
  paymentLinkFormResolver,
  paymentLinkToFormData,
} from '@forms/payment-link-form';
import { Button } from '@heroui/react';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { PermissionEnum } from '@pinstripe/core/contracts';
import { usePaymentLinkQuery, useUpdatePaymentLinkMutation } from '@pinstripe/sdk/react';
import { get, toUpper } from 'lodash-es';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface PaymentLinkDrawerProps {
  paymentLinkId: string;
  priceOptions: { value: string; label: string }[];
  onClose: () => void;
}

export default function PaymentLinkDrawer({
  paymentLinkId,
  priceOptions,
  onClose,
}: PaymentLinkDrawerProps) {
  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: paymentLink } = usePaymentLinkQuery(paymentLinkId);
  const { mutateAsync: updatePaymentLink, isPending: isSaving } = useUpdatePaymentLinkMutation({
    successMessage: 'Đã cập nhật payment link.',
  });

  const form = useForm<PaymentLinkFormData>({
    resolver: paymentLinkFormResolver,
    defaultValues: paymentLinkFormDefaultValues,
  });

  useEffect(() => {
    if (paymentLink) {
      form.reset(paymentLinkToFormData(paymentLink));
    }
  }, [paymentLink, form]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await updatePaymentLink({
      id: paymentLinkId,
      payload: paymentLinkFormDataToUpdatePayload(formData),
    });
  });

  return (
    <EntityDrawer
      isOpen
      title={get(paymentLink, 'url', paymentLinkId)}
      description={paymentLinkId}
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
              { label: 'Chế độ', value: get(paymentLink, 'mode', '—') },
              { label: 'Tiền tệ', value: toUpper(get(paymentLink, 'currency', '')) },
              { label: 'URL thành công', value: get(paymentLink, 'successUrl', '—') },
              {
                label: 'Trạng thái',
                value: (
                  <StatusChip
                    status={get(paymentLink, 'isActive', false) ? 'active' : 'inactive'}
                  />
                ),
              },
              { label: 'Tạo lúc', value: formatDate(get(paymentLink, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Dòng hàng">
          <DataTable
            label="Dòng của payment link"
            rows={get(paymentLink, 'lineItems', [])}
            emptyMessage="Link này chưa có dòng hàng."
            columns={[
              {
                key: 'priceId',
                label: 'Bảng giá',
                isRowHeader: true,
                renderCell: (lineItem) => {
                  return lineItem.priceId;
                },
              },
              {
                key: 'quantity',
                label: 'Số lượng',
                renderCell: (lineItem) => {
                  return lineItem.quantity;
                },
              },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Sửa payment link">
            <PaymentLinkForm
              mode="edit"
              form={form}
              priceOptions={priceOptions}
              isSaving={isSaving}
              onSave={handleOnSave}
            />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
