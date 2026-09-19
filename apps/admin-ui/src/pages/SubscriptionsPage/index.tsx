import DataTable from '@components/DataTable';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import SubscriptionForm from '@components/SubscriptionForm';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import { SUBSCRIPTION_TABS } from '@constants/tabs';
import type { SubscriptionFormData } from '@forms/subscription-form';
import {
  subscriptionFormDataToPayload,
  subscriptionFormDefaultValues,
  subscriptionFormResolver,
} from '@forms/subscription-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { toEnumMember } from '@lib/enum';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { formatPriceAmount } from '@lib/price';
import type { SubscriptionResponse } from '@pinstripe/core/contracts';
import { PermissionEnum, PriceTypeEnum, SubscriptionStatusEnum } from '@pinstripe/core/contracts';
import {
  useCreateSubscriptionMutation,
  useCustomersQuery,
  usePricesQuery,
  useSubscriptionsQuery,
} from '@pinstripe/sdk/react';
import { filter, get, last, map, size, toUpper } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import SubscriptionDrawer from './SubscriptionDrawer';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...map(SubscriptionStatusEnum, (status) => {
    return { value: status, label: status };
  }),
];

export default function SubscriptionsPage() {
  const { subscriptionId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: subscriptions, isPending } = useSubscriptionsQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      status:
        statusFilter === 'all'
          ? undefined
          : toEnumMember(SubscriptionStatusEnum, statusFilter, SubscriptionStatusEnum.ACTIVE),
    },
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

  const handleOnFilterSelect = (nextStatusFilter: string) => {
    setStatusFilter(nextStatusFilter);
    resetPage();
  };

  const handleOnNext = () => {
    const lastSubscription = last(rows);

    if (lastSubscription) {
      advancePage(lastSubscription.id);
    }
  };

  const handleOnRowAction = (subscription: SubscriptionResponse) => {
    navigate(`/subscriptions/list/${subscription.id}`);
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
              options={STATUS_OPTIONS}
              selectedValue={statusFilter}
              onSelect={handleOnFilterSelect}
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
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{subscription.id}</span>
                  <span className="text-app-label font-mono text-[11px]">
                    {subscription.customerId}
                  </span>
                </div>
              );
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
            navigate('/subscriptions/list');
          }}
        />
      ) : null}
    </PageCard>
  );
}
