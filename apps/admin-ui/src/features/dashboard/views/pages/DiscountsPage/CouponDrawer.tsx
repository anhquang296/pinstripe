import ConfirmDialog from '@common/components/ConfirmDialog';
import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { CouponFormData } from '@common/forms/coupon-form';
import {
  couponFormDataToUpdatePayload,
  couponFormDefaultValues,
  couponFormResolver,
  couponToFormData,
} from '@common/forms/coupon-form';
import type { PromotionCodeFormData } from '@common/forms/promotion-code-form';
import {
  promotionCodeFormDataToPayload,
  promotionCodeFormDefaultValues,
  promotionCodeFormResolver,
} from '@common/forms/promotion-code-form';
import { formatDate } from '@common/utils/format';
import CouponForm from '@features/dashboard/components/CouponForm';
import PromotionCodeForm from '@features/dashboard/components/PromotionCodeForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCouponQuery,
  useCreatePromotionCodeMutation,
  useDeleteCouponMutation,
  usePromotionCodeQuery,
  usePromotionCodesQuery,
  useUpdateCouponMutation,
  useUpdatePromotionCodeMutation,
} from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

interface CouponDrawerProps {
  couponId: string;
  onClose: () => void;
}

export default function CouponDrawer({ couponId, onClose }: CouponDrawerProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPromotionCodeId, setSelectedPromotionCodeId] = useState('');
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: coupon } = useCouponQuery(couponId);
  const { data: promotionCodes } = usePromotionCodesQuery({ couponId, limit: PAGE_LIMIT });
  const { data: promotionCode } = usePromotionCodeQuery(selectedPromotionCodeId, {
    enabled: Boolean(selectedPromotionCodeId),
  });

  const { mutateAsync: updateCoupon, isPending: isSaving } = useUpdateCouponMutation({
    successMessage: 'Đã cập nhật coupon.',
  });
  const { mutateAsync: deleteCoupon, isPending: isDeleting } = useDeleteCouponMutation({
    successMessage: 'Đã xoá coupon.',
  });
  const { mutateAsync: createPromotionCode, isPending: isCreatingCode } =
    useCreatePromotionCodeMutation({ successMessage: 'Đã tạo promotion code.' });
  const { mutate: updatePromotionCode } = useUpdatePromotionCodeMutation({
    successMessage: 'Đã cập nhật promotion code.',
  });

  const couponForm = useForm<CouponFormData>({
    resolver: couponFormResolver,
    defaultValues: couponFormDefaultValues,
  });
  const promotionCodeForm = useForm<PromotionCodeFormData>({
    resolver: promotionCodeFormResolver,
    defaultValues: { ...promotionCodeFormDefaultValues, couponId },
  });

  useEffect(() => {
    if (coupon) {
      couponForm.reset(couponToFormData(coupon));
    }
  }, [coupon, couponForm]);

  const handleOnSave = couponForm.handleSubmit(async (formData) => {
    await updateCoupon({ id: couponId, payload: couponFormDataToUpdatePayload(formData) });
  });

  const handleOnCreatePromotionCode = promotionCodeForm.handleSubmit(async (formData) => {
    await createPromotionCode(promotionCodeFormDataToPayload({ ...formData, couponId }));
    promotionCodeForm.reset({ ...promotionCodeFormDefaultValues, couponId });
  });

  const handleOnDelete = async () => {
    await deleteCoupon(couponId);
    setIsDeleteOpen(false);
    onClose();
  };

  return (
    <EntityDrawer
      isOpen
      title={get(coupon, 'name') || couponId}
      description={couponId}
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
              Xoá coupon
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
              { label: 'ID', value: couponId },
              { label: 'Thời hạn', value: get(coupon, 'duration', '—') },
              { label: 'Số tháng', value: get(coupon, 'durationInMonths') ?? '—' },
              { label: 'Đã dùng', value: get(coupon, 'timesRedeemed', 0) },
              { label: 'Giới hạn', value: get(coupon, 'maxRedemptions') ?? 'không giới hạn' },
              {
                label: 'Hiệu lực',
                value: <StatusChip status={get(coupon, 'valid', false) ? 'active' : 'void'} />,
              },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Sửa coupon">
            <CouponForm mode="edit" form={couponForm} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}

        <DrawerSection title="Promotion code">
          <DataTable
            label="Promotion code của coupon"
            rows={get(promotionCodes, 'data', [])}
            emptyMessage="Coupon này chưa có mã khuyến mãi."
            onRowAction={(row) => {
              setSelectedPromotionCodeId(row.id);
            }}
            columns={[
              {
                key: 'code',
                label: 'Mã',
                isRowHeader: true,
                renderCell: (row) => {
                  return row.code;
                },
              },
              {
                key: 'active',
                label: 'Trạng thái',
                renderCell: (row) => {
                  return <StatusChip status={row.active ? 'active' : 'void'} />;
                },
              },
              {
                key: 'timesRedeemed',
                label: 'Đã dùng',
                renderCell: (row) => {
                  return row.timesRedeemed;
                },
              },
              {
                key: 'actions',
                label: 'Thao tác',
                renderCell: (row) => {
                  if (!canWrite) {
                    return null;
                  }

                  return (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        updatePromotionCode({ id: row.id, payload: { active: !row.active } });
                      }}
                    >
                      {row.active ? 'Tắt' : 'Bật'}
                    </Button>
                  );
                },
              },
            ]}
          />
        </DrawerSection>

        {promotionCode ? (
          <DrawerSection title={`Chi tiết ${promotionCode.code}`}>
            <DetailList
              items={[
                { label: 'ID', value: promotionCode.id },
                { label: 'Khách hàng', value: promotionCode.customerId ?? '—' },
                { label: 'Hoá đơn tối thiểu', value: promotionCode.minimumAmount ?? '—' },
                {
                  label: 'Hết hạn',
                  value:
                    promotionCode.expiresAt === null ? '—' : formatDate(promotionCode.expiresAt),
                },
              ]}
            />
          </DrawerSection>
        ) : null}

        {canWrite ? (
          <DrawerSection title="Tạo promotion code">
            <PromotionCodeForm
              form={promotionCodeForm}
              couponOptions={[{ value: couponId, label: get(coupon, 'name') || couponId }]}
              isSaving={isCreatingCode}
              onSave={handleOnCreatePromotionCode}
            />
          </DrawerSection>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Xoá coupon"
        description="Coupon bị xoá sẽ không áp được cho hoá đơn mới. Thao tác này không đảo lại được."
        confirmLabel="Xoá"
        isConfirming={isDeleting}
        onConfirm={handleOnDelete}
        onOpenChange={setIsDeleteOpen}
      />
    </EntityDrawer>
  );
}
