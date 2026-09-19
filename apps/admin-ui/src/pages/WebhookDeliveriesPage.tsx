import DataTable from '@components/DataTable';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { PAGE_LIMIT } from '@constants/pagination';
import { WEBHOOK_TABS } from '@constants/tabs';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { toEnumMember } from '@lib/enum';
import { formatDate } from '@lib/format';
import { WebhookDeliveryStatusEnum } from '@pinstripe/core/contracts';
import { useWebhookDeliveriesQuery } from '@pinstripe/sdk/react';
import { filter, get, last, size } from 'lodash-es';
import { useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: WebhookDeliveryStatusEnum.PENDING, label: 'pending' },
  { value: WebhookDeliveryStatusEnum.SUCCEEDED, label: 'succeeded' },
  { value: WebhookDeliveryStatusEnum.FAILED, label: 'failed' },
  { value: WebhookDeliveryStatusEnum.EXHAUSTED, label: 'exhausted' },
];

export default function WebhookDeliveriesPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchEndpointId, setSearchEndpointId] = useState('');
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();

  const { data: webhookDeliveries, isPending } = useWebhookDeliveriesQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      endpointId: searchEndpointId || undefined,
      status:
        statusFilter === 'all'
          ? undefined
          : toEnumMember(
              WebhookDeliveryStatusEnum,
              statusFilter,
              WebhookDeliveryStatusEnum.PENDING,
            ),
    },
    { hasPlaceholder: true },
  );

  const rows = get(webhookDeliveries, 'data', []);
  const hasMore = get(webhookDeliveries, 'hasMore', false);

  const handleOnStatusSelect = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    resetPage();
  };

  const handleOnSearchChange = (nextEndpointId: string) => {
    setSearchEndpointId(nextEndpointId);
    resetPage();
  };

  const handleOnNext = () => {
    const lastDelivery = last(rows);

    if (lastDelivery) {
      advancePage(lastDelivery.id);
    }
  };

  return (
    <PageCard
      title="Webhooks"
      description="Mỗi lần giao là một dòng: trạng thái, số lần thử, mã HTTP và lỗi gần nhất."
      tabs={<PageTabs items={WEBHOOK_TABS} />}
    >
      <StatGrid>
        <StatItem label="Lần giao trang này" value={size(rows)} />
        <StatItem
          label="Thành công"
          value={size(filter(rows, { status: WebhookDeliveryStatusEnum.SUCCEEDED }))}
        />
        <StatItem
          label="Thất bại"
          value={size(filter(rows, { status: WebhookDeliveryStatusEnum.FAILED }))}
        />
        <StatItem
          label="Hết lượt thử"
          value={size(filter(rows, { status: WebhookDeliveryStatusEnum.EXHAUSTED }))}
        />
      </StatGrid>

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar
          itemCount={size(rows)}
          searchValue={searchEndpointId}
          searchPlaceholder="Lọc theo endpoint id"
          onSearchChange={handleOnSearchChange}
        >
          <FilterSelect
            label="Trạng thái"
            options={STATUS_OPTIONS}
            selectedValue={statusFilter}
            onSelect={handleOnStatusSelect}
          />
        </FilterBar>

        <DataTable
          label="Danh sách lần giao"
          rows={rows}
          isLoading={isPending}
          hasMore={hasMore}
          hasPrevious={hasPrevious}
          emptyMessage="Chưa có lần giao nào."
          onNext={handleOnNext}
          onPrevious={revertPage}
          columns={[
            {
              key: 'eventType',
              label: 'Event',
              isRowHeader: true,
              renderCell: (webhookDelivery) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{webhookDelivery.eventType}</span>
                    <span className="text-app-label font-mono text-[11px]">
                      {webhookDelivery.eventId}
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'endpointId',
              label: 'Endpoint',
              renderCell: (webhookDelivery) => {
                return <span className="font-mono text-[11px]">{webhookDelivery.endpointId}</span>;
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              renderCell: (webhookDelivery) => {
                return <StatusChip status={webhookDelivery.status} />;
              },
            },
            {
              key: 'attemptCount',
              label: 'Số lần thử',
              renderCell: (webhookDelivery) => {
                return webhookDelivery.attemptCount;
              },
            },
            {
              key: 'responseStatus',
              label: 'HTTP',
              renderCell: (webhookDelivery) => {
                const { responseStatus } = webhookDelivery;

                return responseStatus === null ? '—' : responseStatus;
              },
            },
            {
              key: 'lastError',
              label: 'Lỗi gần nhất',
              renderCell: (webhookDelivery) => {
                const { lastError } = webhookDelivery;

                if (lastError === null) {
                  return '—';
                }

                return <span className="text-[11px] text-danger">{lastError}</span>;
              },
            },
            {
              key: 'createdAt',
              label: 'Tạo lúc',
              renderCell: (webhookDelivery) => {
                return formatDate(webhookDelivery.createdAt);
              },
            },
          ]}
        />
      </div>
    </PageCard>
  );
}
