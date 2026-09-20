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
import type { PriceFormData } from '@common/forms/price-form';
import {
  priceFormDataToPayload,
  priceFormDefaultValues,
  priceFormResolver,
} from '@common/forms/price-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { formatDate } from '@common/utils/format';
import { formatPriceAmount } from '@common/utils/price';
import PriceForm from '@features/dashboard/components/PriceForm';
import { CATALOG_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { PriceResponse } from '@pinstripe/core/contracts';
import { BillingSchemeEnum, MeterStatusEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCreatePriceMutation,
  useMetersQuery,
  usePricesQuery,
  useProductsQuery,
} from '@pinstripe/sdk/react';
import { filter, get, last, map, reject, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import PriceDrawer from './PriceDrawer';

const ACTIVE_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Ngừng bán' },
];

export default function PricesPage() {
  const { priceId } = useParams();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { after, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: prices, isPending } = usePricesQuery(
    {
      limit: PAGE_LIMIT,
      after,
      active: activeFilter === 'all' ? undefined : activeFilter === 'active',
    },
    { hasPlaceholder: true },
  );
  const { data: products } = useProductsQuery({ limit: OPTION_LIMIT, active: true });
  const { data: meters } = useMetersQuery({ limit: OPTION_LIMIT, status: MeterStatusEnum.ACTIVE });

  const { mutateAsync: createPrice, isPending: isSaving } = useCreatePriceMutation({
    successMessage: 'Đã tạo price.',
  });

  const form = useForm<PriceFormData>({
    resolver: priceFormResolver,
    defaultValues: priceFormDefaultValues,
  });

  const rows = get(prices, 'data', []);
  const hasMore = get(prices, 'hasMore', false);

  const productOptions = [
    { value: '', label: '— chọn product —' },
    ...map(get(products, 'data', []), (product) => {
      return { value: product.id, label: `${product.name} (${product.id})` };
    }),
  ];
  const meterOptions = [
    { value: '', label: '— chọn meter —' },
    ...map(get(meters, 'data', []), (meter) => {
      return { value: meter.id, label: `${meter.displayName} (${meter.eventName})` };
    }),
  ];

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createPrice(priceFormDataToPayload(formData));
    form.reset(priceFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnFilterSelect = (nextActiveFilter: string) => {
    setActiveFilter(nextActiveFilter);
    resetPage();
  };

  const handleOnNext = () => {
    const lastPrice = last(rows);

    if (lastPrice) {
      advancePage(lastPrice.id);
    }
  };

  const handleOnRowAction = (price: PriceResponse) => {
    navigate(`/catalog/prices/${price.id}`);
  };

  return (
    <PageCard
      title="Products & Prices"
      description="Giá là bất biến: đổi giá sinh version mới, version cũ vẫn phục vụ hợp đồng cũ."
      tabs={<PageTabs items={CATALOG_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo price
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Price trang này" value={size(rows)} />
        <StatItem label="Đang bán" value={size(filter(rows, 'active'))} />
        <StatItem label="Ngừng bán" value={size(reject(rows, 'active'))} />
        <StatItem
          label="Tính theo bậc"
          value={size(filter(rows, { billingScheme: BillingSchemeEnum.TIERED }))}
        />
      </StatGrid>

      <DataTable
        toolbar={
          <FilterBar itemCount={size(rows)}>
            <FilterSelect
              label="Trạng thái"
              options={ACTIVE_OPTIONS}
              selectedValue={activeFilter}
              onSelect={handleOnFilterSelect}
            />
          </FilterBar>
        }
        label="Danh sách price"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'lookupKey',
            label: 'Lookup key',
            isRowHeader: true,
            renderCell: (price) => {
              const { lookupKey } = price;

              return (
                <div className="flex flex-col">
                  <span className="font-medium">
                    {lookupKey === null ? price.nickname || '—' : lookupKey}
                  </span>
                  <span className="text-app-label font-mono text-[11px]">{price.id}</span>
                </div>
              );
            },
          },
          {
            key: 'version',
            label: 'Version',
            renderCell: (price) => {
              return `v${price.version}`;
            },
          },
          {
            key: 'amount',
            label: 'Giá',
            renderCell: (price) => {
              return formatPriceAmount(price);
            },
          },
          {
            key: 'type',
            label: 'Loại',
            renderCell: (price) => {
              return price.type;
            },
          },
          {
            key: 'active',
            label: 'Trạng thái',
            renderCell: (price) => {
              return <StatusChip status={price.active ? 'active' : 'inactive'} />;
            },
          },
          {
            key: 'effectiveAt',
            label: 'Hiệu lực từ',
            renderCell: (price) => {
              return formatDate(price.effectiveAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo price"
        description="Một version giá mới cho product đã chọn."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin price">
          <PriceForm
            form={form}
            productOptions={productOptions}
            meterOptions={meterOptions}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
      </EntityDrawer>

      {priceId ? (
        <PriceDrawer
          priceId={priceId}
          onClose={() => {
            navigate('/catalog/prices');
          }}
        />
      ) : null}
    </PageCard>
  );
}
