import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import type { CheckoutSessionFormData } from '@common/forms/checkout-session-form';
import {
  checkoutSessionFormDataToPayload,
  checkoutSessionFormDefaultValues,
  checkoutSessionFormResolver,
} from '@common/forms/checkout-session-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { toEnumMember } from '@common/utils/enum';
import { formatCurrency, formatDate } from '@common/utils/format';
import { formatPriceAmount } from '@common/utils/price';
import CheckoutSessionForm from '@features/dashboard/components/CheckoutSessionForm';
import { CHECKOUT_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { CheckoutSessionResponse } from '@pinstripe/core/contracts';
import { CheckoutSessionStatusEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCheckoutSessionsQuery,
  useCreateCheckoutSessionMutation,
  useCustomersQuery,
  usePricesQuery,
} from '@pinstripe/sdk/react';
import { filter, get, last, map, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import CheckoutSessionDrawer from './CheckoutSessionDrawer';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...map(CheckoutSessionStatusEnum, (status) => {
    return { value: status, label: status };
  }),
];

export default function CheckoutSessionsPage() {
  const { checkoutSessionId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: checkoutSessions, isPending } = useCheckoutSessionsQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      status:
        statusFilter === 'all'
          ? undefined
          : toEnumMember(CheckoutSessionStatusEnum, statusFilter, CheckoutSessionStatusEnum.OPEN),
    },
    { hasPlaceholder: true },
  );
  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });
  const { data: prices } = usePricesQuery({ limit: OPTION_LIMIT, active: true });

  const { mutateAsync: createCheckoutSession, isPending: isSaving } =
    useCreateCheckoutSessionMutation({ successMessage: 'Đã tạo phiên checkout.' });

  const form = useForm<CheckoutSessionFormData>({
    resolver: checkoutSessionFormResolver,
    defaultValues: checkoutSessionFormDefaultValues,
  });

  const rows = get(checkoutSessions, 'data', []);
  const hasMore = get(checkoutSessions, 'hasMore', false);

  const customerOptions = [
    { value: '', label: '— chọn khách hàng —' },
    ...map(get(customers, 'data', []), (customer) => {
      return { value: customer.id, label: customer.name || customer.id };
    }),
  ];
  const priceOptions = [
    { value: '', label: '— không gắn bảng giá —' },
    ...map(get(prices, 'data', []), (price) => {
      const { lookupKey } = price;
      const priceName = lookupKey === null ? price.id : lookupKey;

      return { value: price.id, label: `${priceName} · ${formatPriceAmount(price)}` };
    }),
  ];

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createCheckoutSession(checkoutSessionFormDataToPayload(formData));
    form.reset(checkoutSessionFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnFilterSelect = (nextStatusFilter: string) => {
    setStatusFilter(nextStatusFilter);
    resetPage();
  };

  const handleOnNext = () => {
    const lastCheckoutSession = last(rows);

    if (lastCheckoutSession) {
      advancePage(lastCheckoutSession.id);
    }
  };

  const handleOnRowAction = (checkoutSession: CheckoutSessionResponse) => {
    navigate(`/checkout/sessions/${checkoutSession.id}`);
  };

  return (
    <PageCard
      title="Checkout & Portal"
      description="Một phiên checkout là một lần khách trả tiền; hết hạn thì tạo phiên mới."
      tabs={<PageTabs items={CHECKOUT_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo phiên checkout
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Phiên trang này" value={size(rows)} />
        <StatItem
          label="Đang mở"
          value={size(filter(rows, { status: CheckoutSessionStatusEnum.OPEN }))}
        />
        <StatItem
          label="Đã hoàn tất"
          value={size(filter(rows, { status: CheckoutSessionStatusEnum.COMPLETE }))}
        />
        <StatItem
          label="Đã hết hạn"
          value={size(filter(rows, { status: CheckoutSessionStatusEnum.EXPIRED }))}
        />
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
        label="Danh sách phiên checkout"
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
            label: 'Phiên',
            isRowHeader: true,
            renderCell: (checkoutSession) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{checkoutSession.id}</span>
                  <span className="text-app-label font-mono text-[11px]">
                    {checkoutSession.customerId}
                  </span>
                </div>
              );
            },
          },
          {
            key: 'mode',
            label: 'Chế độ',
            renderCell: (checkoutSession) => {
              return checkoutSession.mode;
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (checkoutSession) => {
              return <StatusChip status={checkoutSession.status} />;
            },
          },
          {
            key: 'paymentStatus',
            label: 'Thanh toán',
            renderCell: (checkoutSession) => {
              return <StatusChip status={checkoutSession.paymentStatus} />;
            },
          },
          {
            key: 'amountTotal',
            label: 'Tổng',
            renderCell: (checkoutSession) => {
              return formatCurrency(checkoutSession.amountTotal, checkoutSession.currency);
            },
          },
          {
            key: 'expiresAt',
            label: 'Hết hạn',
            renderCell: (checkoutSession) => {
              return formatDate(checkoutSession.expiresAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo phiên checkout"
        description="Phiên checkout gắn với một khách hàng và một bảng giá."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin phiên checkout">
          <CheckoutSessionForm
            form={form}
            customerOptions={customerOptions}
            priceOptions={priceOptions}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
      </EntityDrawer>

      {checkoutSessionId ? (
        <CheckoutSessionDrawer
          checkoutSessionId={checkoutSessionId}
          onClose={() => {
            navigate('/checkout/sessions');
          }}
        />
      ) : null}
    </PageCard>
  );
}
