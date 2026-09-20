import DataTable from '@common/components/DataTable';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import { SEARCH_DEBOUNCE_MS } from '@common/constants/time';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import { WEBHOOK_TABS } from '@features/dashboard/constants/tabs';
import { WebhookDeliveryStatusEnum } from '@pinstripe/core/contracts';
import { useWebhookDeliveriesQuery } from '@pinstripe/sdk/react';
import { filter, get, isEmpty, isNull, last, size } from 'lodash-es';
import { debounce, useQueryStates } from 'nuqs';

import { webhookDeliverySearchParams } from './webhook-deliveries.search-params';

const STATUS_OPTIONS = [
  { value: WebhookDeliveryStatusEnum.PENDING, label: 'pending' },
  { value: WebhookDeliveryStatusEnum.SUCCEEDED, label: 'succeeded' },
  { value: WebhookDeliveryStatusEnum.FAILED, label: 'failed' },
  { value: WebhookDeliveryStatusEnum.EXHAUSTED, label: 'exhausted' },
];

export default function WebhookDeliveriesPage() {
  const [search, setSearch] = useQueryStates(webhookDeliverySearchParams);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const { data: webhookDeliveries, isPending } = useWebhookDeliveriesQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
    { hasPlaceholder: true },
  );

  const rows = get(webhookDeliveries, 'data', []);
  const hasMore = get(webhookDeliveries, 'hasMore', false);

  const handleOnStatusSelect = (value: string | null) => {
    const status = isNull(value) ? null : webhookDeliverySearchParams.status.parse(value);

    setSearch({ status, after: null });
  };

  const handleOnEndpointIdChange = (endpointId: string) => {
    setSearch(
      { endpointId: isEmpty(endpointId) ? null : endpointId, after: null },
      { limitUrlUpdates: isEmpty(endpointId) ? undefined : debounce(SEARCH_DEBOUNCE_MS) },
    );
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

      <DataTable
        toolbar={
          <FilterBar
            itemCount={size(rows)}
            searchValue={search.endpointId}
            searchPlaceholder="Lọc theo endpoint id"
            onSearchChange={handleOnEndpointIdChange}
          >
            <FilterSelect
              label="Trạng thái"
              placeholder="Tất cả trạng thái"
              options={STATUS_OPTIONS}
              selectedValue={search.status}
              onSelect={handleOnStatusSelect}
            />
          </FilterBar>
        }
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
    </PageCard>
  );
}
