import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityCell from '@common/components/EntityCell';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { PortalConfigurationFormData } from '@common/forms/portal-configuration-form';
import {
  portalConfigurationFormDataToPayload,
  portalConfigurationFormDefaultValues,
  portalConfigurationFormResolver,
} from '@common/forms/portal-configuration-form';
import { cursorSearchParams, useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import PortalConfigurationForm from '@features/dashboard/components/PortalConfigurationForm';
import { CHECKOUT_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { BillingPortalConfigurationResponse } from '@vxrerp/core/contracts';
import { PermissionEnum } from '@vxrerp/core/contracts';
import {
  useBillingPortalConfigurationsQuery,
  useCreateBillingPortalConfigurationMutation,
} from '@vxrerp/sdk/react';
import { filter, get, last, size } from 'lodash-es';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import PortalConfigurationDrawer from './PortalConfigurationDrawer';

export default function PortalConfigurationsPage() {
  const { configurationId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [search, setSearch] = useQueryStates(cursorSearchParams);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: configurations, isPending } = useBillingPortalConfigurationsQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
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

      <DataTable
        toolbar={<FilterBar itemCount={size(rows)} />}
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
              return <EntityCell id={configuration.id} name={configuration.businessName} />;
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

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo cấu hình portal"
        description="Quyền của khách trong billing portal."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin cấu hình">
          <PortalConfigurationForm
            mode="create"
            form={form}
            isSaving={isSaving}
            onSave={handleOnSave}
          />
        </DrawerSection>
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
