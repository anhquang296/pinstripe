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
import type { PriceFormData } from '@common/forms/price-form';
import {
  priceFormDataToPayload,
  priceFormDefaultValues,
  priceFormResolver,
} from '@common/forms/price-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { formatPriceAmount } from '@common/utils/price';
import { toBooleanFilter, toBooleanSelectValue, toQuery } from '@common/utils/search-params';
import PriceForm from '@features/billing/components/PriceForm';
import { CATALOG_TABS } from '@features/billing/constants/tabs';
import { billingPaths } from '@features/billing/routes/paths';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { PriceResponse } from '@vxrerp/billing/contracts';
import { BillingSchemeEnum, MeterStatusEnum } from '@vxrerp/billing/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import {
  useCreatePriceMutation,
  useMetersQuery,
  usePricesQuery,
  useProductsQuery,
} from '@vxrerp/sdk/react';
import { filter, get, last, map, reject, size } from 'lodash-es';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { generatePath, useParams } from 'react-router-dom';

import PriceDrawer from './PriceDrawer';
import { priceSearchParams } from './prices.search-params';

const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Đang bán' },
  { value: 'false', label: 'Ngừng bán' },
];

export default function PricesPage() {
  const { priceId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(priceSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: prices, isPending } = usePricesQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
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

  const handleOnActiveSelect = (value: string | null) => {
    setSearch({ active: toBooleanFilter(value), after: null });
  };

  const handleOnNext = () => {
    const lastPrice = last(rows);

    if (lastPrice) {
      advancePage(lastPrice.id);
    }
  };

  const handleOnRowAction = (price: PriceResponse) => {
    navigate(generatePath(billingPaths.CATALOG_PRICE, { priceId: price.id }));
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
              placeholder="Tất cả trạng thái"
              options={ACTIVE_OPTIONS}
              selectedValue={toBooleanSelectValue(search.active)}
              onSelect={handleOnActiveSelect}
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
            key: 'nickname',
            label: 'Nickname',
            isRowHeader: true,
            renderCell: (price) => {
              const { nickname } = price;

              return <EntityCell id={price.id} name={nickname || undefined} />;
            },
          },
          {
            key: 'lookupKey',
            label: 'Lookup key',
            renderCell: (price) => {
              const { lookupKey } = price;

              if (lookupKey) {
                return <span className="font-mono text-xs">{lookupKey}</span>;
              }

              return '—';
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
            navigate(billingPaths.CATALOG_PRICES);
          }}
        />
      ) : null}
    </PageCard>
  );
}
