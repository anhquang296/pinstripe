import CouponForm from '@components/CouponForm';
import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import type { CouponFormData } from '@forms/coupon-form';
import {
  couponFormDataToPayload,
  couponFormDefaultValues,
  couponFormResolver,
} from '@forms/coupon-form';
import {
  useCouponsQuery,
  useCreateCouponMutation,
  useCreateDiscountMutation,
  useDeleteDiscountMutation,
  useDiscountsQuery,
  useSubscriptionsQuery,
} from '@pinstripe/sdk/react';
import { map } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

export default function DiscountsPage() {
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState('');

  const { data: coupons, error } = useCouponsQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { data: discounts } = useDiscountsQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { data: subscriptions } = useSubscriptionsQuery({ limit: OPTION_LIMIT });

  const { mutate: createCoupon, isPending: isSaving } = useCreateCouponMutation({
    successMessage: 'Đã tạo coupon.',
  });
  const { mutate: createDiscount, isPending: isApplying } = useCreateDiscountMutation({
    successMessage: 'Đã áp giảm giá.',
  });
  const { mutate: deleteDiscount, isPending: isDeleting } = useDeleteDiscountMutation({
    successMessage: 'Đã gỡ giảm giá.',
  });

  const form = useForm<CouponFormData>({
    resolver: couponFormResolver,
    defaultValues: couponFormDefaultValues,
  });

  const couponOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn coupon —' },
      ...map(coupons?.data, (coupon) => {
        const off = coupon.percentOff === null ? `${coupon.amountOff}` : `${coupon.percentOff}%`;

        return { value: coupon.id, label: `${coupon.name || coupon.id} (${off})` };
      }),
    ];
  }, [coupons]);

  const subscriptionOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn subscription —' },
      ...map(subscriptions?.data, (subscription) => {
        return { value: subscription.id, label: subscription.id };
      }),
    ];
  }, [subscriptions]);

  const handleOnSave = form.handleSubmit((formData) => {
    createCoupon(couponFormDataToPayload(formData));
  });

  const handleOnCouponChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCouponId(event.target.value);
  }, []);

  const handleOnSubscriptionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubscriptionId(event.target.value);
  }, []);

  const handleOnApply = useCallback(() => {
    createDiscount({ couponId: selectedCouponId, subscriptionId: selectedSubscriptionId });
  }, [createDiscount, selectedCouponId, selectedSubscriptionId]);

  const handleOnDelete = useCallback(
    (discountId: string) => {
      deleteDiscount(discountId);
    },
    [deleteDiscount],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Giảm giá</h1>
        <p className="text-sm text-slate-500">
          Giảm giá trừ vào từng dòng hoá đơn, trước thuế, theo thứ tự tạo. Một coupon repeating tính
          hạn từ lúc discount được tạo.
        </p>
      </div>

      <CouponForm form={form} isSaving={isSaving} onSave={handleOnSave} />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <SelectField
          label="Coupon"
          options={couponOptions}
          value={selectedCouponId}
          onChange={handleOnCouponChange}
        />
        <SelectField
          label="Subscription"
          options={subscriptionOptions}
          value={selectedSubscriptionId}
          onChange={handleOnSubscriptionChange}
        />
        <Button
          onClick={handleOnApply}
          disabled={isApplying || !selectedCouponId || !selectedSubscriptionId}
        >
          Áp giảm giá
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Coupon</th>
              <th className="px-4 py-3">Mức</th>
              <th className="px-4 py-3">Bắt đầu</th>
              <th className="px-4 py-3">Kết thúc</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {map(discounts?.data, (discount) => {
              return (
                <tr key={discount.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{discount.id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{discount.couponId}</td>
                  <td className="px-4 py-3">{discount.level}</td>
                  <td className="px-4 py-3">{discount.startAt}</td>
                  <td className="px-4 py-3">{discount.endAt ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      disabled={isDeleting}
                      onClick={() => {
                        handleOnDelete(discount.id);
                      }}
                    >
                      Gỡ
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>
    </div>
  );
}
