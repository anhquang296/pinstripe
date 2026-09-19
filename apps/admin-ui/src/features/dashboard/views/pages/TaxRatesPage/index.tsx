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
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { TaxRateFormData } from '@common/forms/tax-rate-form';
import {
  taxRateFormDataToPayload,
  taxRateFormDefaultValues,
  taxRateFormResolver,
} from '@common/forms/tax-rate-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { formatDate } from '@common/utils/format';
import TaxRateForm from '@features/dashboard/components/TaxRateForm';
import { SUBSCRIPTION_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
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
