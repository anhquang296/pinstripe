import DataTable from '@components/DataTable';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import PaymentLinkForm from '@components/PaymentLinkForm';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import { CHECKOUT_TABS } from '@constants/tabs';
import type { PaymentLinkFormData } from '@forms/payment-link-form';
import {
  paymentLinkFormDataToPayload,
  paymentLinkFormDefaultValues,
  paymentLinkFormResolver,
} from '@forms/payment-link-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { formatPriceAmount } from '@lib/price';
import type { PaymentLinkResponse } from '@pinstripe/core/contracts';
import { CheckoutSessionModeEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCreatePaymentLinkMutation,
  usePaymentLinksQuery,
  usePricesQuery,
} from '@pinstripe/sdk/react';
import { filter, get, last, map, reject, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import PaymentLinkDrawer from './PaymentLinkDrawer';

const ACTIVE_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang mở' },
  { value: 'inactive', label: 'Đã đóng' },
];

export default function PaymentLinksPage() {
  const { paymentLinkId } = useParams();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: paymentLinks, isPending } = usePaymentLinksQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
    },
    { hasPlaceholder: true },
  );
  const { data: prices } = usePricesQuery({ limit: OPTION_LIMIT, active: true });

  const { mutateAsync: createPaymentLink, isPending: isSaving } = useCreatePaymentLinkMutation({
    successMessage: 'Đã tạo payment link.',
  });

  const form = useForm<PaymentLinkFormData>({
    resolver: paymentLinkFormResolver,
    defaultValues: paymentLinkFormDefaultValues,
  });

  const rows = get(paymentLinks, 'data', []);
  const hasMore = get(paymentLinks, 'hasMore', false);

  const priceOptions = [
    { value: '', label: '— chọn bảng giá —' },
    ...map(get(prices, 'data', []), (price) => {
      const { lookupKey } = price;
      const priceName = lookupKey === null ? price.id : lookupKey;

      return { value: price.id, label: `${priceName} · ${formatPriceAmount(price)}` };
    }),
  ];

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createPaymentLink(paymentLinkFormDataToPayload(formData));
    form.reset(paymentLinkFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnFilterSelect = (nextActiveFilter: string) => {
    setActiveFilter(nextActiveFilter);
    resetPage();
  };

  const handleOnNext = () => {
    const lastPaymentLink = last(rows);

    if (lastPaymentLink) {
      advancePage(lastPaymentLink.id);
    }
  };

  const handleOnRowAction = (paymentLink: PaymentLinkResponse) => {
    navigate(`/checkout/payment-links/${paymentLink.id}`);
  };

  return (
    <PageCard
      title="Checkout & Portal"
      description="Payment link là một URL bán hàng dùng lại được; mỗi lần khách mở là một phiên checkout."
      tabs={<PageTabs items={CHECKOUT_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo payment link
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Link trang này" value={size(rows)} />
        <StatItem label="Đang mở" value={size(filter(rows, 'isActive'))} />
        <StatItem label="Đã đóng" value={size(reject(rows, 'isActive'))} />
        <StatItem
          label="Mở thuê bao"
          value={size(filter(rows, { mode: CheckoutSessionModeEnum.SUBSCRIPTION }))}
        />
      </StatGrid>

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar itemCount={size(rows)}>
          <FilterSelect
            label="Trạng thái"
            options={ACTIVE_OPTIONS}
            selectedValue={activeFilter}
            onSelect={handleOnFilterSelect}
          />
        </FilterBar>

        <DataTable
          label="Danh sách payment link"
          rows={rows}
          isLoading={isPending}
          hasMore={hasMore}
          hasPrevious={hasPrevious}
          onRowAction={handleOnRowAction}
          onNext={handleOnNext}
          onPrevious={revertPage}
          columns={[
            {
              key: 'url',
              label: 'Payment link',
              isRowHeader: true,
              renderCell: (paymentLink) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{paymentLink.url}</span>
                    <span className="text-app-label font-mono text-[11px]">{paymentLink.id}</span>
                  </div>
                );
              },
            },
            {
              key: 'mode',
              label: 'Chế độ',
              renderCell: (paymentLink) => {
                return paymentLink.mode;
              },
            },
            {
              key: 'lineItems',
              label: 'Số dòng',
              renderCell: (paymentLink) => {
                return size(paymentLink.lineItems);
              },
            },
            {
              key: 'isActive',
              label: 'Trạng thái',
              renderCell: (paymentLink) => {
                return <StatusChip status={paymentLink.isActive ? 'active' : 'inactive'} />;
              },
            },
            {
              key: 'createdAt',
              label: 'Tạo lúc',
              renderCell: (paymentLink) => {
                return formatDate(paymentLink.createdAt);
              },
            },
          ]}
        />
      </div>

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo payment link"
        description="Một URL bán hàng cho bảng giá đã chọn."
        onOpenChange={setIsCreateOpen}
      >
        <PaymentLinkForm
          mode="create"
          form={form}
          priceOptions={priceOptions}
          isSaving={isSaving}
          onSave={handleOnSave}
        />
      </EntityDrawer>

      {paymentLinkId ? (
        <PaymentLinkDrawer
          paymentLinkId={paymentLinkId}
          priceOptions={priceOptions}
          onClose={() => {
            navigate('/checkout/payment-links');
          }}
        />
      ) : null}
    </PageCard>
  );
}
