import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { WebhookDeliveryStatusEnum } from '@pinstripe/core/contracts';
import { values } from 'lodash-es';
import { parseAsString, parseAsStringEnum } from 'nuqs';

export const webhookDeliverySearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(WebhookDeliveryStatusEnum)),
  endpointId: parseAsString,
};
