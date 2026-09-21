import {
  DOMAIN_EVENT_MODULES,
  ErpModuleEnum,
  WebhookEndpointStatusEnum,
} from '@vxrerp/platform/contracts';
import { keys, map, pickBy } from 'lodash-es';

const BILLING_EVENT_TYPES = keys(
  pickBy(DOMAIN_EVENT_MODULES, (eventModule) => {
    return eventModule === ErpModuleEnum.BILLING;
  }),
);

export const EVENT_OPTIONS = map(BILLING_EVENT_TYPES, (eventType) => {
  return { value: eventType, label: eventType };
});

export const STATUS_OPTIONS = [
  { value: WebhookEndpointStatusEnum.ENABLED, label: 'enabled — đang nhận event' },
  { value: WebhookEndpointStatusEnum.DISABLED, label: 'disabled — tạm ngừng' },
];
