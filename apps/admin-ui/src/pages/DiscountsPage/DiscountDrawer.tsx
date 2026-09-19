import ConfirmDialog from '@components/ConfirmDialog';
import DetailList from '@components/DetailList';
import DiscountNoteForm from '@components/DiscountNoteForm';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import type { DiscountNoteFormData } from '@forms/discount-note-form';
import {
  discountNoteFormDataToPayload,
  discountNoteFormDefaultValues,
  discountNoteFormResolver,
  discountToNoteFormData,
} from '@forms/discount-note-form';
import { Button } from '@heroui/react';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { PermissionEnum } from '@pinstripe/core/contracts';
import {
  useDeleteDiscountMutation,
  useDiscountQuery,
  useUpdateDiscountMutation,
} from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

interface DiscountDrawerProps {
  discountId: string;
  onClose: () => void;
}

export default function DiscountDrawer({ discountId, onClose }: DiscountDrawerProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: discount } = useDiscountQuery(discountId);
  const { mutateAsync: updateDiscount, isPending: isSaving } = useUpdateDiscountMutation({
    successMessage: 'Đã cập nhật ghi chú giảm giá.',
  });
  const { mutateAsync: deleteDiscount, isPending: isDeleting } = useDeleteDiscountMutation({
    successMessage: 'Đã gỡ giảm giá.',
  });

  const form = useForm<DiscountNoteFormData>({
    resolver: discountNoteFormResolver,
    defaultValues: discountNoteFormDefaultValues,
  });

  useEffect(() => {
    if (discount) {
      form.reset(discountToNoteFormData(discount));
    }
  }, [discount, form]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await updateDiscount({ id: discountId, payload: discountNoteFormDataToPayload(formData) });
  });

  const handleOnDelete = async () => {
    await deleteDiscount(discountId);
    setIsDeleteOpen(false);
    onClose();
  };

  const endAt = get(discount, 'endAt');

  return (
    <EntityDrawer
      isOpen
      title={discountId}
      description={get(discount, 'couponId', '')}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Đóng
          </Button>
          {canWrite ? (
            <Button
              variant="danger"
              onPress={() => {
                setIsDeleteOpen(true);
              }}
            >
              Gỡ giảm giá
            </Button>
          ) : null}
        </>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'Coupon', value: get(discount, 'couponId', '—') },
              { label: 'Khách hàng', value: get(discount, 'customerId', '—') },
              { label: 'Mức', value: get(discount, 'level', '—') },
              { label: 'Subscription', value: get(discount, 'subscriptionId') ?? '—' },
              { label: 'Bắt đầu', value: formatDate(get(discount, 'startAt', '')) },
              { label: 'Kết thúc', value: endAt ? formatDate(endAt) : '—' },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Ghi chú">
            <DiscountNoteForm form={form} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Gỡ giảm giá"
        description="Giảm giá bị gỡ sẽ không áp cho hoá đơn kỳ sau. Thao tác này không đảo lại được."
        confirmLabel="Gỡ"
        isConfirming={isDeleting}
        onConfirm={handleOnDelete}
        onOpenChange={setIsDeleteOpen}
      />
    </EntityDrawer>
  );
}
