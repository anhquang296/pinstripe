import { Button } from '@heroui/react';
import type { WebhookEndpointResponse } from '@pinstripe/core/contracts';
import { WebhookEndpointStatusEnum } from '@pinstripe/core/contracts';
import { join } from 'lodash-es';
import { useCallback } from 'react';

interface WebhookEndpointItemProps {
  endpoint: WebhookEndpointResponse;
  isBusy: boolean;
  onToggle: (endpointId: string, status: string) => void;
}

export default function WebhookEndpointItem({
  endpoint,
  isBusy,
  onToggle,
}: WebhookEndpointItemProps) {
  const isEnabled = endpoint.status === WebhookEndpointStatusEnum.ENABLED;
  const nextStatus = isEnabled
    ? WebhookEndpointStatusEnum.DISABLED
    : WebhookEndpointStatusEnum.ENABLED;

  const handleOnToggle = useCallback(() => {
    onToggle(endpoint.id, nextStatus);
  }, [endpoint.id, nextStatus, onToggle]);

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{endpoint.id}</td>
      <td className="px-4 py-3">{endpoint.url}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
          }`}
        >
          {endpoint.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{join(endpoint.enabledEvents, ', ')}</td>
      <td className="px-4 py-3">
        <Button variant="ghost" onPress={handleOnToggle} isDisabled={isBusy}>
          {isEnabled ? 'Tắt' : 'Bật'}
        </Button>
      </td>
    </tr>
  );
}
