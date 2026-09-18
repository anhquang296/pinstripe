import DataTable from '@components/DataTable';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import PageCard from '@components/PageCard';
import PageTabs from '@components/PageTabs';
import PortalConfigurationForm from '@components/PortalConfigurationForm';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { PAGE_LIMIT } from '@constants/pagination';
import { CHECKOUT_TABS } from '@constants/tabs';
import type { PortalConfigurationFormData } from '@forms/portal-configuration-form';
import {
  portalConfigurationFormDataToPayload,
  portalConfigurationFormDefaultValues,
  portalConfigurationFormResolver,
} from '@forms/portal-configuration-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { BillingPortalConfigurationResponse } from '@pinstripe/core/contracts';
import { PermissionEnum } from '@pinstripe/core/contracts';
import {
  useBillingPortalConfigurationsQuery,
  useCreateBillingPortalConfigurationMutation,
} from '@pinstripe/sdk/react';
import { filter, get, last, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import PortalConfigurationDrawer from './PortalConfigurationDrawer';

export default function PortalConfigurationsPage() {
  const { configurationId } = useParams();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: configurations, isPending } = useBillingPortalConfigurationsQuery(
    { limit: PAGE_LIMIT, startingAfter },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createConfiguration, isPending: isSaving } =
    useCreateBillingPortalConfigurationMutation({ successMessage: 'Đã tạo cấu hình portal.' });

  const form = useForm<PortalConfigurationFormData>({
    resolver: portalConfigurationFormResolver,
    defaultValues: portalConfigurationFormDefaultValues,
  });

  const rows = get(configurations, 'data', []);
  const hasMore = get(configurations, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createConfiguration(portalConfigurationFormDataToPayload(formData));
    form.reset(portalConfigurationFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnNext = () => {
    const lastConfiguration = last(rows);

    if (lastConfiguration) {
      advancePage(lastConfiguration.id);
    }
  };

  const handleOnRowAction = (configuration: BillingPortalConfigurationResponse) => {
    navigate(`/checkout/portal/${configuration.id}`);
  };

  return (
    <PageCard
      title="Checkout & Portal"
      description="Cấu hình portal quyết định khách tự làm được gì: xem hoá đơn, đổi thẻ, tự hủy."
      tabs={<PageTabs items={CHECKOUT_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo cấu hình
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Cấu hình trang này" value={size(rows)} />
        <StatItem label="Đang bật" value={size(filter(rows, 'isActive'))} />
        <StatItem label="Mặc định" value={size(filter(rows, 'isDefault'))} />
        <StatItem
          label="Cho khách tự hủy"
          value={size(
            filter(rows, (configuration) => {
              return configuration.features.canCancelSubscription;
            }),
          )}
        />
      </StatGrid>

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
        <FilterBar itemCount={size(rows)} />

        <DataTable
          label="Danh sách cấu hình portal"
          rows={rows}
          isLoading={isPending}
          hasMore={hasMore}
          hasPrevious={hasPrevious}
          onRowAction={handleOnRowAction}
          onNext={handleOnNext}
          onPrevious={revertPage}
          columns={[
            {
              key: 'businessName',
              label: 'Cấu hình',
              isRowHeader: true,
              renderCell: (configuration) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{configuration.businessName}</span>
                    <span className="text-app-label font-mono text-[11px]">{configuration.id}</span>
                  </div>
                );
              },
            },
            {
              key: 'isDefault',
              label: 'Mặc định',
              renderCell: (configuration) => {
                return configuration.isDefault ? 'có' : '—';
              },
            },
            {
              key: 'isActive',
              label: 'Trạng thái',
              renderCell: (configuration) => {
                return <StatusChip status={configuration.isActive ? 'active' : 'inactive'} />;
              },
            },
            {
              key: 'createdAt',
              label: 'Tạo lúc',
              renderCell: (configuration) => {
                return formatDate(configuration.createdAt);
              },
            },
          ]}
        />
      </div>

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo cấu hình portal"
        description="Quyền của khách trong billing portal."
        onOpenChange={setIsCreateOpen}
      >
        <PortalConfigurationForm
          mode="create"
          form={form}
          isSaving={isSaving}
          onSave={handleOnSave}
        />
      </EntityDrawer>

      {configurationId ? (
        <PortalConfigurationDrawer
          configurationId={configurationId}
          onClose={() => {
            navigate('/checkout/portal');
          }}
        />
      ) : null}
    </PageCard>
  );
}
