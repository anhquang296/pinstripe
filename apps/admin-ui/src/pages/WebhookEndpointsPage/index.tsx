import DataTable from '@components/DataTable';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import FilterSelect from '@components/FilterSelect';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import WebhookEndpointForm from '@components/WebhookEndpointForm';
import { PAGE_LIMIT } from '@constants/pagination';
import { WEBHOOK_TABS } from '@constants/tabs';
import type { WebhookEndpointFormData } from '@forms/webhook-endpoint-form';
import {
  webhookEndpointFormDataToPayload,
  webhookEndpointFormDefaultValues,
  webhookEndpointFormResolver,
} from '@forms/webhook-endpoint-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { toEnumMember } from '@lib/enum';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { WebhookEndpointResponse } from '@pinstripe/core/contracts';
import { PermissionEnum, WebhookEndpointStatusEnum } from '@pinstripe/core/contracts';
import { useCreateWebhookEndpointMutation, useWebhookEndpointsQuery } from '@pinstripe/sdk/react';
import { filter, get, last, size, sumBy } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import WebhookEndpointDrawer from './WebhookEndpointDrawer';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: WebhookEndpointStatusEnum.ENABLED, label: 'enabled' },
  { value: WebhookEndpointStatusEnum.DISABLED, label: 'disabled' },
];

export default function WebhookEndpointsPage() {
  const { webhookEndpointId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.INTEGRATION_WRITE);

  const { data: webhookEndpoints, isPending } = useWebhookEndpointsQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      status:
        statusFilter === 'all'
          ? undefined
          : toEnumMember(
              WebhookEndpointStatusEnum,
              statusFilter,
              WebhookEndpointStatusEnum.ENABLED,
            ),
    },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createWebhookEndpoint, isPending: isSaving } =
    useCreateWebhookEndpointMutation({
      successMessage: (webhookEndpoint) => {
        return `Đã tạo endpoint. Secret chỉ hiện một lần: ${webhookEndpoint.secret}`;
      },
    });

  const form = useForm<WebhookEndpointFormData>({
    resolver: webhookEndpointFormResolver,
    defaultValues: webhookEndpointFormDefaultValues,
  });

  const rows = get(webhookEndpoints, 'data', []);
  const hasMore = get(webhookEndpoints, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createWebhookEndpoint(webhookEndpointFormDataToPayload(formData));
    form.reset(webhookEndpointFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnStatusSelect = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    resetPage();
  };

  const handleOnNext = () => {
    const lastEndpoint = last(rows);

    if (lastEndpoint) {
      advancePage(lastEndpoint.id);
    }
  };

  const handleOnRowAction = (webhookEndpoint: WebhookEndpointResponse) => {
    navigate(`/webhooks/endpoints/${webhookEndpoint.id}`);
  };

  return (
    <PageCard
      title="Webhooks"
      description="Mỗi event mang một id cố định qua mọi lần thử, nên bên nhận tự chặn trùng được. Payload ký bằng HMAC-SHA256, header pinstripe-signature."
      tabs={<PageTabs items={WEBHOOK_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Đăng ký endpoint
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Endpoint trang này" value={size(rows)} />
        <StatItem
          label="Đang bật"
          value={size(filter(rows, { status: WebhookEndpointStatusEnum.ENABLED }))}
        />
        <StatItem
          label="Đang tắt"
          value={size(filter(rows, { status: WebhookEndpointStatusEnum.DISABLED }))}
        />
        <StatItem
          label="Tổng event đăng ký"
          value={sumBy(rows, (webhookEndpoint) => {
            return size(webhookEndpoint.enabledEvents);
          })}
        />
      </StatGrid>

      <DataTable
        toolbar={
          <FilterBar itemCount={size(rows)}>
            <FilterSelect
              label="Trạng thái"
              options={STATUS_OPTIONS}
              selectedValue={statusFilter}
              onSelect={handleOnStatusSelect}
            />
          </FilterBar>
        }
        label="Danh sách endpoint"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        emptyMessage="Chưa có endpoint nào."
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'url',
            label: 'Endpoint',
            isRowHeader: true,
            renderCell: (webhookEndpoint) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{webhookEndpoint.url}</span>
                  <span className="text-app-label font-mono text-[11px]">{webhookEndpoint.id}</span>
                </div>
              );
            },
          },
          {
            key: 'description',
            label: 'Mô tả',
            renderCell: (webhookEndpoint) => {
              return webhookEndpoint.description || '—';
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (webhookEndpoint) => {
              return <StatusChip status={webhookEndpoint.status} />;
            },
          },
          {
            key: 'enabledEvents',
            label: 'Event đăng ký',
            renderCell: (webhookEndpoint) => {
              return size(webhookEndpoint.enabledEvents);
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (webhookEndpoint) => {
              return formatDate(webhookEndpoint.createdAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Đăng ký endpoint"
        description="Secret ký payload chỉ hiện một lần, ngay sau khi tạo."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin endpoint">
          <WebhookEndpointForm
            mode="create"
            form={form}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
      </EntityDrawer>

      {webhookEndpointId ? (
        <WebhookEndpointDrawer
          webhookEndpointId={webhookEndpointId}
          onClose={() => {
            navigate('/webhooks/endpoints');
          }}
        />
      ) : null}
    </PageCard>
  );
}
