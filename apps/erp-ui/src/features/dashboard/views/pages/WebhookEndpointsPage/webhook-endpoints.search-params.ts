import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { WebhookEndpointStatusEnum } from '@vxrerp/core/contracts';
import { values } from 'lodash-es';
import { parseAsStringEnum } from 'nuqs';

export const webhookEndpointSearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(WebhookEndpointStatusEnum)),
};
