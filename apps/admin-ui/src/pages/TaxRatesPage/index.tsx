import DataTable from '@components/DataTable';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import TaxRateForm from '@components/TaxRateForm';
import { PAGE_LIMIT } from '@constants/pagination';
import { SUBSCRIPTION_TABS } from '@constants/tabs';
import type { TaxRateFormData } from '@forms/tax-rate-form';
import {
  taxRateFormDataToPayload,
  taxRateFormDefaultValues,
  taxRateFormResolver,
} from '@forms/tax-rate-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { TaxRateResponse } from '@pinstripe/core/contracts';
import { PermissionEnum, TaxTypeEnum } from '@pinstripe/core/contracts';
import { useCreateTaxRateMutation, useTaxRatesQuery } from '@pinstripe/sdk/react';
import { filter, get, last, reject, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import TaxRateDrawer from './TaxRateDrawer';

const ACTIVE_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang áp dụng' },
  { value: 'inactive', label: 'Đã ngừng' },
];

export default function TaxRatesPage() {
  const { taxRateId } = useParams();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: taxRates, isPending } = useTaxRatesQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      active: activeFilter === 'all' ? undefined : activeFilter === 'active',
    },
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

  const handleOnFilterSelect = (nextActiveFilter: string) => {
    setActiveFilter(nextActiveFilter);
    resetPage();
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
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{taxRate.displayName}</span>
                    <span className="text-app-label font-mono text-[11px]">{taxRate.id}</span>
                  </div>
                );
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
      </div>

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo tax rate"
        description="Thuế suất và cách tính; gắn vào subscription hoặc hoá đơn khi cần."
        onOpenChange={setIsCreateOpen}
      >
        <TaxRateForm mode="create" form={form} isSaving={isSaving} onSave={handleOnSave} />
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
