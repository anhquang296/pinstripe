import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { WebhookEndpointFormData } from '@common/forms/webhook-endpoint-form';
import {
  webhookEndpointFormDataToUpdatePayload,
  webhookEndpointFormDefaultValues,
  webhookEndpointFormResolver,
  webhookEndpointToFormData,
} from '@common/forms/webhook-endpoint-form';
import { formatDate } from '@common/utils/format';
import WebhookEndpointForm from '@features/dashboard/components/WebhookEndpointForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { PermissionEnum } from '@pinstripe/core/contracts';
import {
  useUpdateWebhookEndpointMutation,
  useWebhookDeliveriesQuery,
  useWebhookEndpointQuery,
} from '@pinstripe/sdk/react';
import { get, join, size } from 'lodash-es';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface WebhookEndpointDrawerProps {
  webhookEndpointId: string;
  onClose: () => void;
}

export default function WebhookEndpointDrawer({
  webhookEndpointId,
  onClose,
}: WebhookEndpointDrawerProps) {
  const canWrite = useCan(PermissionEnum.INTEGRATION_WRITE);

  const { data: webhookEndpoint } = useWebhookEndpointQuery(webhookEndpointId);
  const { data: webhookDeliveries } = useWebhookDeliveriesQuery({
    endpointId: webhookEndpointId,
    limit: PAGE_LIMIT,
  });

  const { mutateAsync: updateWebhookEndpoint, isPending: isSaving } =
    useUpdateWebhookEndpointMutation({ successMessage: 'Đã cập nhật endpoint.' });

  const form = useForm<WebhookEndpointFormData>({
    resolver: webhookEndpointFormResolver,
    defaultValues: webhookEndpointFormDefaultValues,
  });

  useEffect(() => {
    if (webhookEndpoint) {
      form.reset(webhookEndpointToFormData(webhookEndpoint));
    }
  }, [webhookEndpoint, form]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await updateWebhookEndpoint({
      id: webhookEndpointId,
      payload: webhookEndpointFormDataToUpdatePayload(formData),
    });
  });

  return (
    <EntityDrawer
      isOpen
      title={get(webhookEndpoint, 'url', webhookEndpointId)}
      description={webhookEndpointId}
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
              {
                label: 'Trạng thái',
                value: <StatusChip status={get(webhookEndpoint, 'status', 'disabled')} />,
              },
              { label: 'Mô tả', value: get(webhookEndpoint, 'description') || '—' },
              {
                label: 'Số event đăng ký',
                value: size(get(webhookEndpoint, 'enabledEvents', [])),
              },
              { label: 'Tạo lúc', value: formatDate(get(webhookEndpoint, 'createdAt', '')) },
              { label: 'Cập nhật lúc', value: formatDate(get(webhookEndpoint, 'updatedAt', '')) },
              {
                label: 'Event',
                value: (
                  <span className="font-mono text-[11px]">
                    {join(get(webhookEndpoint, 'enabledEvents', []), ', ') || '—'}
                  </span>
                ),
              },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Sửa endpoint">
            <WebhookEndpointForm
              mode="edit"
              form={form}
              isSaving={isSaving}
              onSave={handleOnSave}
            />
          </DrawerSection>
        ) : null}

        <DataTable
          label="Lần giao gần đây"
          rows={get(webhookDeliveries, 'data', [])}
          emptyMessage="Endpoint này chưa có lần giao nào."
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
          ]}
        />
      </div>
    </EntityDrawer>
  );
}
