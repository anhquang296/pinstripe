import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityCell from '@common/components/EntityCell';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import type { SubscriptionFormData } from '@common/forms/subscription-form';
import {
  subscriptionFormDataToPayload,
  subscriptionFormDefaultValues,
  subscriptionFormResolver,
} from '@common/forms/subscription-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { formatPriceAmount } from '@common/utils/price';
import { toQuery } from '@common/utils/search-params';
import SubscriptionForm from '@features/billing/components/SubscriptionForm';
import { SUBSCRIPTION_TABS } from '@features/billing/constants/tabs';
import { billingPaths } from '@features/billing/routes/paths';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { SubscriptionResponse } from '@vxrerp/billing/contracts';
import { PriceTypeEnum, SubscriptionStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import {
  useCreateSubscriptionMutation,
  useCustomersQuery,
  usePricesQuery,
  useSubscriptionsQuery,
} from '@vxrerp/sdk/react';
import { filter, get, isNull, last, map, size, toUpper, values } from 'lodash-es';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { generatePath, useParams } from 'react-router-dom';

import SubscriptionDrawer from './SubscriptionDrawer';
import { subscriptionSearchParams } from './subscriptions.search-params';

const STATUS_OPTIONS = map(values(SubscriptionStatusEnum), (status) => {
  return { value: status, label: status };
});

export default function SubscriptionsPage() {
  const { subscriptionId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(subscriptionSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: subscriptions, isPending } = useSubscriptionsQuery(
    { limit: PAGE_LIMIT, expand: ['customer'], ...toQuery(search) },
    { hasPlaceholder: true },
  );

  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });

  const { data: prices } = usePricesQuery({ limit: OPTION_LIMIT, active: true });

  const { mutateAsync: createSubscription, isPending: isSaving } = useCreateSubscriptionMutation({
    successMessage: 'Đã tạo subscription.',
  });

  const form = useForm<SubscriptionFormData>({
    resolver: subscriptionFormResolver,
    defaultValues: subscriptionFormDefaultValues,
  });

  const rows = get(subscriptions, 'data', []);
  const hasMore = get(subscriptions, 'hasMore', false);

  const customerOptions = [
    { value: '', label: '— chọn khách hàng —' },
    ...map(get(customers, 'data', []), (customer) => {
      return {
        value: customer.id,
        label: `${customer.name || customer.id} (${toUpper(customer.currency)})`,
      };
    }),
  ];

  const priceOptions = [
    { value: '', label: '— chọn bảng giá —' },
    ...map(filter(get(prices, 'data', []), { type: PriceTypeEnum.RECURRING }), (price) => {
      const { lookupKey } = price;

      const priceName = lookupKey === null ? price.id : lookupKey;

      return {
        value: price.id,
        label: `${priceName} · v${price.version} · ${formatPriceAmount(price)}`,
      };
    }),
  ];

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createSubscription(subscriptionFormDataToPayload(formData));
    form.reset(subscriptionFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnStatusSelect = (value: string | null) => {
    const status = isNull(value) ? null : subscriptionSearchParams.status.parse(value);

    setSearch({ status, after: null });
  };

  const handleOnNext = () => {
    const lastSubscription = last(rows);

    if (lastSubscription) {
      advancePage(lastSubscription.id);
    }
  };

  const handleOnRowAction = (subscription: SubscriptionResponse) => {
    navigate(generatePath(billingPaths.SUBSCRIPTION, { subscriptionId: subscription.id }));
  };

  return (
    <PageCard
      title="Subscriptions"
      description="Quyền dùng tách khỏi chu kỳ tính tiền: hủy cuối kỳ thì khách vẫn dùng tới hết kỳ."
      tabs={<PageTabs items={SUBSCRIPTION_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo subscription
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Thuê bao trang này" value={size(rows)} />
        <StatItem
          label="Đang chạy"
          value={size(filter(rows, { status: SubscriptionStatusEnum.ACTIVE }))}
        />
        <StatItem
          label="Đang trial"
          value={size(filter(rows, { status: SubscriptionStatusEnum.TRIALING }))}
        />
        <StatItem label="Hủy cuối kỳ" value={size(filter(rows, 'cancelAtPeriodEnd'))} />
      </StatGrid>

      <DataTable
        toolbar={
          <FilterBar itemCount={size(rows)}>
            <FilterSelect
              label="Trạng thái"
              placeholder="Tất cả trạng thái"
              options={STATUS_OPTIONS}
              selectedValue={search.status}
              onSelect={handleOnStatusSelect}
            />
          </FilterBar>
        }
        label="Danh sách subscription"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'id',
            label: 'Subscription',
            isRowHeader: true,
            renderCell: (subscription) => {
              return <EntityCell id={subscription.id} />;
            },
          },
          {
            key: 'customerId',
            label: 'Khách hàng',
            renderCell: (subscription) => {
              const customerName = get(subscription, 'customer.name', '');

              return <EntityCell id={subscription.customerId} name={customerName || undefined} />;
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (subscription) => {
              return <StatusChip status={subscription.status} />;
            },
          },
          {
            key: 'items',
            label: 'Số dòng',
            renderCell: (subscription) => {
              return size(subscription.items);
            },
          },
          {
            key: 'currentPeriod',
            label: 'Kỳ hiện tại',
            renderCell: (subscription) => {
              return `${formatDate(subscription.currentPeriodStart)} → ${formatDate(subscription.currentPeriodEnd)}`;
            },
          },
          {
            key: 'collectionMethod',
            label: 'Thu tiền',
            renderCell: (subscription) => {
              return subscription.collectionMethod;
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo subscription"
        description="Một thuê bao mới cho khách hàng đã chọn."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin thuê bao">
          <SubscriptionForm
            form={form}
            customerOptions={customerOptions}
            priceOptions={priceOptions}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
      </EntityDrawer>

      {subscriptionId ? (
        <SubscriptionDrawer
          subscriptionId={subscriptionId}
          onClose={() => {
            navigate(billingPaths.SUBSCRIPTIONS_LIST);
          }}
        />
      ) : null}
    </PageCard>
  );
}
