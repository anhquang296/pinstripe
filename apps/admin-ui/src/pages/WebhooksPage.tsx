import PageCard from '@components/PageCard';
import WebhookEndpointItem from '@components/WebhookEndpointItem';
import { PAGE_LIMIT } from '@constants/pagination';
import { Button, Input, Label, ListBox, Select, TextField } from '@heroui/react';
import type { WebhookEndpointStatus } from '@pinstripe/core/contracts';
import { DomainEventTypeEnum, WebhookDeliveryStatusEnum } from '@pinstripe/core/contracts';
import {
  useCreateWebhookEndpointMutation,
  useUpdateWebhookEndpointMutation,
  useWebhookDeliveriesQuery,
  useWebhookEndpointsQuery,
} from '@pinstripe/sdk/react';
import { map, toString, values } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

const DEFAULT_URL = 'http://localhost:4100/hooks';

const DELIVERY_STATUS_CLASSES: Record<string, string> = {
  [WebhookDeliveryStatusEnum.PENDING]: 'bg-default text-foreground',
  [WebhookDeliveryStatusEnum.SUCCEEDED]: 'bg-success-soft text-success-soft-foreground',
  [WebhookDeliveryStatusEnum.FAILED]: 'bg-danger-soft text-danger-soft-foreground',
};

export default function WebhooksPage() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [selectedEvent, setSelectedEvent] = useState<string>(DomainEventTypeEnum.INVOICE_FINALIZED);

  const { data: endpoints, error } = useWebhookEndpointsQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { data: deliveries } = useWebhookDeliveriesQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { mutate: createEndpoint, isPending: isCreating } = useCreateWebhookEndpointMutation({
    successMessage: (webhookEndpoint) => {
      return `Đã tạo endpoint. Secret chỉ hiện một lần: ${webhookEndpoint.secret}`;
    },
  });
  const { mutate: updateEndpoint, isPending: isUpdating } = useUpdateWebhookEndpointMutation({
    successMessage: 'Đã cập nhật endpoint.',
  });

  const eventOptions = useMemo(() => {
    return map(values(DomainEventTypeEnum), (eventType) => {
      return { value: eventType, label: eventType };
    });
  }, []);

  const handleOnEventChange = useCallback((key: unknown) => {
    setSelectedEvent(toString(key));
  }, []);

  const handleOnCreate = useCallback(() => {
    createEndpoint({ url, enabledEvents: [selectedEvent], description: 'Tạo từ admin' });
  }, [createEndpoint, selectedEvent, url]);

  const handleOnToggle = useCallback(
    (endpointId: string, status: string) => {
      updateEndpoint({ id: endpointId, payload: { status: status as WebhookEndpointStatus } });
    },
    [updateEndpoint],
  );

  return (
    <PageCard
      title="Webhooks"
      description="Mỗi event mang một id cố định qua mọi lần thử, nên bên nhận tự chặn trùng được. Payload ký bằng HMAC-SHA256, header pinstripe-signature."
    >
      <div className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-surface p-4">
        <TextField className="flex w-80 flex-col gap-1" value={url} onChange={setUrl}>
          <Label>URL</Label>
          <Input />
        </TextField>
        <Select
          className="flex flex-col gap-1"
          selectedKey={selectedEvent}
          onSelectionChange={handleOnEventChange}
        >
          <Label>Event</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {map(eventOptions, (eventOption) => {
                return (
                  <ListBox.Item key={eventOption.value} id={eventOption.value}>
                    {eventOption.label}
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button onPress={handleOnCreate} isDisabled={isCreating}>
          Đăng ký endpoint
        </Button>
      </div>

      <div className="border-app-border-soft overflow-x-auto rounded-md border bg-surface">
        <table className="w-full min-w-[56rem] text-left text-[12px]">
          <thead className="text-app-description bg-background text-[11px] uppercase">
            <tr>
              <th className="px-3 py-2.5">ID</th>
              <th className="px-3 py-2.5">URL</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5">Event đăng ký</th>
              <th className="px-3 py-2.5">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {map(endpoints?.data, (endpoint) => {
              return (
                <WebhookEndpointItem
                  key={endpoint.id}
                  endpoint={endpoint}
                  isBusy={isUpdating}
                  onToggle={handleOnToggle}
                />
              );
            })}
          </tbody>
        </table>
        {error ? <p className="px-3 py-2.5 text-danger">{error.message}</p> : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-app-description text-[11px] font-semibold uppercase">
          Lần giao gần nhất
        </h2>
        <div className="border-app-border-soft overflow-x-auto rounded-md border bg-surface">
          <table className="w-full min-w-[48rem] text-left text-[12px]">
            <thead className="text-app-description bg-background text-[11px] uppercase">
              <tr>
                <th className="px-3 py-2.5">Event</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5 text-right">Số lần thử</th>
                <th className="px-3 py-2.5 text-right">HTTP</th>
                <th className="px-3 py-2.5">Lỗi gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {map(deliveries?.data, (delivery) => {
                const { responseStatus, lastError } = delivery;

                return (
                  <tr key={delivery.id} className="border-app-border-soft border-t">
                    <td className="px-3 py-2.5">{delivery.eventType}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-xs px-2 py-0.5 text-[11px] font-medium ${DELIVERY_STATUS_CLASSES[delivery.status] ?? ''}`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{delivery.attemptCount}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {responseStatus === null ? '—' : responseStatus}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-danger">{lastError}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PageCard>
  );
}
