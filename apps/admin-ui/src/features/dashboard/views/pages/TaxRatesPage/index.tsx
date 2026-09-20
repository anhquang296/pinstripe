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
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { TaxRateFormData } from '@common/forms/tax-rate-form';
import {
  taxRateFormDataToPayload,
  taxRateFormDefaultValues,
  taxRateFormResolver,
} from '@common/forms/tax-rate-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { toBooleanFilter, toBooleanSelectValue, toQuery } from '@common/utils/search-params';
import TaxRateForm from '@features/dashboard/components/TaxRateForm';
import { SUBSCRIPTION_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { TaxRateResponse } from '@pinstripe/core/contracts';
import { PermissionEnum, TaxTypeEnum } from '@pinstripe/core/contracts';
import { useCreateTaxRateMutation, useTaxRatesQuery } from '@pinstripe/sdk/react';
import { filter, get, last, reject, size } from 'lodash-es';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import { taxRateSearchParams } from './tax-rates.search-params';
import TaxRateDrawer from './TaxRateDrawer';

const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Đang áp dụng' },
  { value: 'false', label: 'Đã ngừng' },
];

export default function TaxRatesPage() {
  const { taxRateId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(taxRateSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: taxRates, isPending } = useTaxRatesQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createTaxRate, isPending: isSaving } = useCreateTaxRateMutation({
    successMessage: 'Đã tạo tax rate.',
  });

  const form = useForm<TaxRateFormData>({
    resolver: taxRateFormResolver,
    defaultValues: taxRateFormDefaultValues,
  });

  const rows = get(taxRates, 'data', []);
  const hasMore = get(taxRates, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createTaxRate(taxRateFormDataToPayload(formData));
    form.reset(taxRateFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnActiveSelect = (value: string | null) => {
    setSearch({ active: toBooleanFilter(value), after: null });
  };

  const handleOnNext = () => {
    const lastTaxRate = last(rows);

    if (lastTaxRate) {
      advancePage(lastTaxRate.id);
    }
  };

  const handleOnRowAction = (taxRate: TaxRateResponse) => {
    navigate(`/subscriptions/tax/${taxRate.id}`);
  };

  return (
    <PageCard
      title="Thuế"
      description="Tax rate là bất biến về thuế suất: đổi thuế suất là tạo bản mới, bản cũ vẫn giữ hoá đơn cũ đúng."
      tabs={<PageTabs items={SUBSCRIPTION_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo tax rate
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Tax rate trang này" value={size(rows)} />
        <StatItem label="Đang áp dụng" value={size(filter(rows, 'active'))} />
        <StatItem label="Đã ngừng" value={size(reject(rows, 'active'))} />
        <StatItem label="VAT" value={size(filter(rows, { taxType: TaxTypeEnum.VAT }))} />
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
        label="Danh sách tax rate"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'displayName',
            label: 'Tax rate',
            isRowHeader: true,
            renderCell: (taxRate) => {
              return <EntityCell id={taxRate.id} name={taxRate.displayName} />;
            },
          },
          {
            key: 'percentage',
            label: 'Thuế suất',
            renderCell: (taxRate) => {
              return `${taxRate.percentage}%`;
            },
          },
          {
            key: 'taxType',
            label: 'Loại',
            renderCell: (taxRate) => {
              return taxRate.taxType;
            },
          },
          {
            key: 'inclusive',
            label: 'Gồm trong giá',
            renderCell: (taxRate) => {
              return taxRate.inclusive ? 'có' : 'không';
            },
          },
          {
            key: 'active',
            label: 'Trạng thái',
            renderCell: (taxRate) => {
              return <StatusChip status={taxRate.active ? 'active' : 'inactive'} />;
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (taxRate) => {
              return formatDate(taxRate.createdAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo tax rate"
        description="Thuế suất và cách tính; gắn vào subscription hoặc hoá đơn khi cần."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin tax rate">
          <TaxRateForm mode="create" form={form} isSaving={isSaving} onSave={handleOnSave} />
        </DrawerSection>
      </EntityDrawer>

      {taxRateId ? (
        <TaxRateDrawer
          taxRateId={taxRateId}
          onClose={() => {
            navigate('/subscriptions/tax');
          }}
        />
      ) : null}
    </PageCard>
  );
}
