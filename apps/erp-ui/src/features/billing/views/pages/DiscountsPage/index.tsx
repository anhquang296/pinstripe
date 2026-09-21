import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityCell from '@common/components/EntityCell';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import type { CouponFormData } from '@common/forms/coupon-form';
import {
  couponFormDataToPayload,
  couponFormDefaultValues,
  couponFormResolver,
} from '@common/forms/coupon-form';
import type { DiscountFormData } from '@common/forms/discount-form';
import {
  discountFormDataToPayload,
  discountFormDefaultValues,
  discountFormResolver,
} from '@common/forms/discount-form';
import { cursorSearchParams, useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import CouponForm from '@features/billing/components/CouponForm';
import DiscountForm from '@features/billing/components/DiscountForm';
import { SUBSCRIPTION_TABS } from '@features/billing/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { CouponResponse } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import {
  useCouponsQuery,
  useCreateCouponMutation,
  useCreateDiscountMutation,
  useCustomersQuery,
  useDiscountsQuery,
  useSubscriptionsQuery,
} from '@vxrerp/sdk/react';
import { filter, get, last, map, size } from 'lodash-es';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import CouponDrawer from './CouponDrawer';
import DiscountDrawer from './DiscountDrawer';

export default function DiscountsPage() {
  const { couponId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [selectedDiscountId, setSelectedDiscountId] = useState('');

  const [search, setSearch] = useQueryStates(cursorSearchParams);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: coupons, isPending } = useCouponsQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
    { hasPlaceholder: true },
  );

  const { data: discounts } = useDiscountsQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });

  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });

  const { data: subscriptions } = useSubscriptionsQuery({ limit: OPTION_LIMIT });

  const { mutateAsync: createCoupon, isPending: isSaving } = useCreateCouponMutation({
    successMessage: 'Đã tạo coupon.',
  });

  const { mutateAsync: createDiscount, isPending: isApplying } = useCreateDiscountMutation({
    successMessage: 'Đã áp giảm giá.',
  });

  const couponForm = useForm<CouponFormData>({
    resolver: couponFormResolver,
    defaultValues: couponFormDefaultValues,
  });

  const discountForm = useForm<DiscountFormData>({
    resolver: discountFormResolver,
    defaultValues: discountFormDefaultValues,
  });

  const rows = get(coupons, 'data', []);
  const hasMore = get(coupons, 'hasMore', false);

  const couponOptions = [
    { value: '', label: '— chọn coupon —' },
    ...map(rows, (coupon) => {
      const { percentOff } = coupon;

      const off = percentOff === null ? `${coupon.amountOff}` : `${percentOff}%`;

      return { value: coupon.id, label: `${coupon.name || coupon.id} (${off})` };
    }),
  ];

  const customerOptions = [
    { value: '', label: '— không gắn khách hàng —' },
    ...map(get(customers, 'data', []), (customer) => {
      return { value: customer.id, label: customer.name || customer.id };
    }),
  ];

  const subscriptionOptions = [
    { value: '', label: '— không gắn subscription —' },
    ...map(get(subscriptions, 'data', []), (subscription) => {
      return { value: subscription.id, label: subscription.id };
    }),
  ];

  const handleOnSaveCoupon = couponForm.handleSubmit(async (formData) => {
    await createCoupon(couponFormDataToPayload(formData));
    couponForm.reset(couponFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnApplyDiscount = discountForm.handleSubmit(async (formData) => {
    await createDiscount(discountFormDataToPayload(formData));
    discountForm.reset(discountFormDefaultValues);
  });

  const handleOnNext = () => {
    const lastCoupon = last(rows);

    if (lastCoupon) {
      advancePage(lastCoupon.id);
    }
  };

  const handleOnRowAction = (coupon: CouponResponse) => {
    navigate(`/subscriptions/discounts/${coupon.id}`);
  };

  return (
    <PageCard
      title="Coupons & mã khuyến mãi"
      description="Giảm giá trừ vào từng dòng hoá đơn, trước thuế, theo thứ tự tạo."
      tabs={<PageTabs items={SUBSCRIPTION_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo coupon
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Coupon trang này" value={size(rows)} />
        <StatItem label="Còn hiệu lực" value={size(filter(rows, 'valid'))} />
        <StatItem
          label="Giảm theo phần trăm"
          value={size(
            filter(rows, (coupon) => {
              return coupon.percentOff !== null;
            }),
          )}
        />
        <StatItem label="Giảm giá đang áp" value={size(get(discounts, 'data', []))} />
      </StatGrid>

      <DataTable
        toolbar={<FilterBar itemCount={size(rows)} />}
        label="Danh sách coupon"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'name',
            label: 'Coupon',
            isRowHeader: true,
            renderCell: (coupon) => {
              return <EntityCell id={coupon.id} name={coupon.name || undefined} />;
            },
          },
          {
            key: 'off',
            label: 'Mức giảm',
            renderCell: (coupon) => {
              const { percentOff } = coupon;

              if (percentOff === null) {
                return `${coupon.amountOff}`;
              }

              return `${percentOff}%`;
            },
          },
          {
            key: 'duration',
            label: 'Thời hạn',
            renderCell: (coupon) => {
              return coupon.duration;
            },
          },
          {
            key: 'timesRedeemed',
            label: 'Đã dùng',
            renderCell: (coupon) => {
              return coupon.timesRedeemed;
            },
          },
          {
            key: 'valid',
            label: 'Hiệu lực',
            renderCell: (coupon) => {
              return <StatusChip status={coupon.valid ? 'active' : 'void'} />;
            },
          },
        ]}
      />

      {canWrite ? (
        <DrawerSection title="Áp giảm giá cho khách hoặc thuê bao">
          <DiscountForm
            form={discountForm}
            couponOptions={couponOptions}
            customerOptions={customerOptions}
            subscriptionOptions={subscriptionOptions}
            isSaving={isApplying}
            onSave={handleOnApplyDiscount}
          />
        </DrawerSection>
      ) : null}

      <DataTable
        label="Giảm giá đang áp"
        rows={get(discounts, 'data', [])}
        emptyMessage="Chưa có giảm giá nào được áp."
        onRowAction={(discount) => {
          setSelectedDiscountId(discount.id);
        }}
        columns={[
          {
            key: 'id',
            label: 'Discount',
            isRowHeader: true,
            renderCell: (discount) => {
              return discount.id;
            },
          },
          {
            key: 'couponId',
            label: 'Coupon',
            renderCell: (discount) => {
              return discount.couponId;
            },
          },
          {
            key: 'level',
            label: 'Mức',
            renderCell: (discount) => {
              return discount.level;
            },
          },
          {
            key: 'startAt',
            label: 'Bắt đầu',
            renderCell: (discount) => {
              return formatDate(discount.startAt);
            },
          },
          {
            key: 'endAt',
            label: 'Kết thúc',
            renderCell: (discount) => {
              const { endAt } = discount;

              if (endAt === null) {
                return '—';
              }

              return formatDate(endAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo coupon"
        description="Coupon là mức giảm; promotion code là cách khách nhập nó."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin coupon">
          <CouponForm
            mode="create"
            form={couponForm}
            isSaving={isSaving}
            onSave={handleOnSaveCoupon}
          />
        </DrawerSection>
      </EntityDrawer>

      {couponId ? (
        <CouponDrawer
          couponId={couponId}
          onClose={() => {
            navigate('/subscriptions/discounts');
          }}
        />
      ) : null}

      {selectedDiscountId ? (
        <DiscountDrawer
          discountId={selectedDiscountId}
          onClose={() => {
            setSelectedDiscountId('');
          }}
        />
      ) : null}
    </PageCard>
  );
}
