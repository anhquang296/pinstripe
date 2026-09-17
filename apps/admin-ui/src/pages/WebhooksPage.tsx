import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import WebhookEndpointItem from '@components/WebhookEndpointItem';
import { PAGE_LIMIT } from '@constants/pagination';
import type { WebhookEndpointStatus } from '@pinstripe/core/contracts';
import { DomainEventTypeEnum, WebhookDeliveryStatusEnum } from '@pinstripe/core/contracts';
import {
  useCreateWebhookEndpointMutation,
  useUpdateWebhookEndpointMutation,
  useWebhookDeliveriesQuery,
  useWebhookEndpointsQuery,
} from '@pinstripe/sdk/react';
import { map, values } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

const DEFAULT_URL = 'http://localhost:4100/hooks';

const DELIVERY_STATUS_CLASSES: Record<string, string> = {
  [WebhookDeliveryStatusEnum.PENDING]: 'bg-slate-100 text-slate-600',
  [WebhookDeliveryStatusEnum.SUCCEEDED]: 'bg-emerald-100 text-emerald-700',
  [WebhookDeliveryStatusEnum.FAILED]: 'bg-red-100 text-red-700',
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

  const handleOnUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  }, []);

  const handleOnEventChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEvent(event.target.value);
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="text-sm text-slate-500">
          Mỗi event mang một `id` cố định qua mọi lần thử, nên bên nhận tự chặn trùng được. Payload
          ký bằng HMAC-SHA256, header `pinstripe-signature`.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <TextField label="URL" className="w-80" value={url} onChange={handleOnUrlChange} />
        <SelectField
          label="Event"
          options={eventOptions}
          value={selectedEvent}
          onChange={handleOnEventChange}
        />
        <Button onClick={handleOnCreate} disabled={isCreating}>
          Đăng ký endpoint
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Event đăng ký</th>
              <th className="px-4 py-3">Thao tác</th>
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
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Lần giao gần nhất
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Số lần thử</th>
                <th className="px-4 py-3 text-right">HTTP</th>
                <th className="px-4 py-3">Lỗi gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {map(deliveries?.data, (delivery) => {
                return (
                  <tr key={delivery.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{delivery.eventType}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_CLASSES[delivery.status] ?? ''}`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{delivery.attemptCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {delivery.responseStatus ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600">{delivery.lastError ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
