import { DomainEventTypeEnum, WebhookEndpointStatusEnum } from '@vxrerp/platform/contracts';
import { map, values } from 'lodash-es';

export const EVENT_OPTIONS = map(values(DomainEventTypeEnum), (eventType) => {
  return { value: eventType, label: eventType };
});

export const STATUS_OPTIONS = [
  { value: WebhookEndpointStatusEnum.ENABLED, label: 'enabled — đang nhận event' },
  { value: WebhookEndpointStatusEnum.DISABLED, label: 'disabled — tạm ngừng' },
];
