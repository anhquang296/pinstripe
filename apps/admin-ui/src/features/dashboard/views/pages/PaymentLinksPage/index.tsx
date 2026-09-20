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
import type { PaymentLinkFormData } from '@common/forms/payment-link-form';
import {
  paymentLinkFormDataToPayload,
  paymentLinkFormDefaultValues,
  paymentLinkFormResolver,
} from '@common/forms/payment-link-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { formatPriceAmount } from '@common/utils/price';
import { toBooleanFilter, toBooleanSelectValue, toQuery } from '@common/utils/search-params';
import PaymentLinkForm from '@features/dashboard/components/PaymentLinkForm';
import { CHECKOUT_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { PaymentLinkResponse } from '@pinstripe/core/contracts';
import { CheckoutSessionModeEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCreatePaymentLinkMutation,
  usePaymentLinksQuery,
  usePricesQuery,
} from '@pinstripe/sdk/react';
import { filter, get, last, map, reject, size } from 'lodash-es';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import { paymentLinkSearchParams } from './payment-links.search-params';
import PaymentLinkDrawer from './PaymentLinkDrawer';

const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Đang mở' },
  { value: 'false', label: 'Đã đóng' },
];

export default function PaymentLinksPage() {
  const { paymentLinkId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(paymentLinkSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: paymentLinks, isPending } = usePaymentLinksQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
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

  const handleOnActiveSelect = (value: string | null) => {
    setSearch({ isActive: toBooleanFilter(value), after: null });
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

      <DataTable
        toolbar={
          <FilterBar itemCount={size(rows)}>
            <FilterSelect
              label="Trạng thái"
              placeholder="Tất cả trạng thái"
              options={ACTIVE_OPTIONS}
              selectedValue={toBooleanSelectValue(search.isActive)}
              onSelect={handleOnActiveSelect}
            />
          </FilterBar>
        }
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

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo payment link"
        description="Một URL bán hàng cho bảng giá đã chọn."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin payment link">
          <PaymentLinkForm
            mode="create"
            form={form}
            priceOptions={priceOptions}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
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
