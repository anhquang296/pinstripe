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
import type { MeterFormData } from '@common/forms/meter-form';
import {
  meterFormDataToPayload,
  meterFormDefaultValues,
  meterFormResolver,
} from '@common/forms/meter-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { toEnumMember } from '@common/utils/enum';
import { formatDate } from '@common/utils/format';
import MeterForm from '@features/dashboard/components/MeterForm';
import { SUBSCRIPTION_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { MeterResponse } from '@pinstripe/core/contracts';
import { MeterStatusEnum, PermissionEnum } from '@pinstripe/core/contracts';
import { useCreateMeterMutation, useMetersQuery } from '@pinstripe/sdk/react';
import { filter, get, last, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import MeterDrawer from './MeterDrawer';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: MeterStatusEnum.ACTIVE, label: 'Đang chạy' },
  { value: MeterStatusEnum.INACTIVE, label: 'Đã tắt' },
];

export default function MetersPage() {
  const { meterId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { after, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: meters, isPending } = useMetersQuery(
    {
      limit: PAGE_LIMIT,
      after,
      status:
        statusFilter === 'all'
          ? undefined
          : toEnumMember(MeterStatusEnum, statusFilter, MeterStatusEnum.ACTIVE),
    },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createMeter, isPending: isSaving } = useCreateMeterMutation({
    successMessage: 'Đã tạo meter.',
  });

  const form = useForm<MeterFormData>({
    resolver: meterFormResolver,
    defaultValues: meterFormDefaultValues,
  });

  const rows = get(meters, 'data', []);
  const hasMore = get(meters, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createMeter(meterFormDataToPayload(formData));
    form.reset(meterFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnFilterSelect = (nextStatusFilter: string) => {
    setStatusFilter(nextStatusFilter);
    resetPage();
  };

  const handleOnNext = () => {
    const lastMeter = last(rows);

    if (lastMeter) {
      advancePage(lastMeter.id);
    }
  };

  const handleOnRowAction = (meter: MeterResponse) => {
    navigate(`/subscriptions/usage/${meter.id}`);
  };

  return (
    <PageCard
      title="Usage-based billing"
      description="Event thô là append-only. Tổng hợp tính lúc đọc, nên đổi cách tính giá vẫn dựng lại được số cũ."
      tabs={<PageTabs items={SUBSCRIPTION_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo meter
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Meter trang này" value={size(rows)} />
        <StatItem
          label="Đang chạy"
          value={size(filter(rows, { status: MeterStatusEnum.ACTIVE }))}
        />
        <StatItem label="Đã tắt" value={size(filter(rows, { status: MeterStatusEnum.INACTIVE }))} />
        <StatItem label="Tổng hợp theo sum" value={size(filter(rows, { aggregation: 'sum' }))} />
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
        label="Danh sách meter"
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
            label: 'Meter',
            isRowHeader: true,
            renderCell: (meter) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{meter.displayName}</span>
                  <span className="text-app-label font-mono text-[11px]">{meter.id}</span>
                </div>
              );
            },
          },
          {
            key: 'eventName',
            label: 'Event',
            renderCell: (meter) => {
              return meter.eventName;
            },
          },
          {
            key: 'aggregation',
            label: 'Tổng hợp',
            renderCell: (meter) => {
              return meter.aggregation;
            },
          },
          {
            key: 'valueKey',
            label: 'Khóa giá trị',
            renderCell: (meter) => {
              return meter.valueKey;
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (meter) => {
              return <StatusChip status={meter.status} />;
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (meter) => {
              return formatDate(meter.createdAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo meter"
        description="Meter định nghĩa event nào được đếm và đếm thế nào."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin meter">
          <MeterForm mode="create" form={form} isSaving={isSaving} onSave={handleOnSave} />
        </DrawerSection>
      </EntityDrawer>

      {meterId ? (
        <MeterDrawer
          meterId={meterId}
          onClose={() => {
            navigate('/subscriptions/usage');
          }}
        />
      ) : null}
    </PageCard>
  );
}
