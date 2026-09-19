import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import type { PortalConfigurationFormData } from '@common/forms/portal-configuration-form';
import {
  portalConfigurationFormDataToUpdatePayload,
  portalConfigurationFormDefaultValues,
  portalConfigurationFormResolver,
  portalConfigurationToFormData,
} from '@common/forms/portal-configuration-form';
import { formatDate } from '@common/utils/format';
import PortalConfigurationForm from '@features/dashboard/components/PortalConfigurationForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { PermissionEnum } from '@pinstripe/core/contracts';
import {
  useBillingPortalConfigurationQuery,
  useUpdateBillingPortalConfigurationMutation,
} from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface PortalConfigurationDrawerProps {
  configurationId: string;
  onClose: () => void;
}

export default function PortalConfigurationDrawer({
  configurationId,
  onClose,
}: PortalConfigurationDrawerProps) {
  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: configuration } = useBillingPortalConfigurationQuery(configurationId);
  const { mutateAsync: updateConfiguration, isPending: isSaving } =
    useUpdateBillingPortalConfigurationMutation({ successMessage: 'Đã cập nhật cấu hình portal.' });

  const form = useForm<PortalConfigurationFormData>({
    resolver: portalConfigurationFormResolver,
    defaultValues: portalConfigurationFormDefaultValues,
  });

  useEffect(() => {
    if (configuration) {
      form.reset(portalConfigurationToFormData(configuration));
    }
  }, [configuration, form]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await updateConfiguration({
      id: configurationId,
      payload: portalConfigurationFormDataToUpdatePayload(formData),
    });
  });

  return (
    <EntityDrawer
      isOpen
      title={get(configuration, 'businessName', configurationId)}
      description={configurationId}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'URL quay lại', value: get(configuration, 'defaultReturnUrl') ?? '—' },
              { label: 'Mặc định', value: get(configuration, 'isDefault', false) ? 'có' : '—' },
              {
                label: 'Trạng thái',
                value: (
                  <StatusChip
                    status={get(configuration, 'isActive', false) ? 'active' : 'inactive'}
                  />
                ),
              },
              {
                label: 'Xem hoá đơn',
                value: get(configuration, 'features.canViewInvoiceHistory', false) ? 'có' : '—',
              },
              {
                label: 'Đổi phương thức',
                value: get(configuration, 'features.canUpdatePaymentMethod', false) ? 'có' : '—',
              },
              {
                label: 'Tự hủy thuê bao',
                value: get(configuration, 'features.canCancelSubscription', false) ? 'có' : '—',
              },
              { label: 'Tạo lúc', value: formatDate(get(configuration, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Sửa cấu hình">
            <PortalConfigurationForm
              mode="edit"
              form={form}
              isSaving={isSaving}
              onSave={handleOnSave}
            />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
