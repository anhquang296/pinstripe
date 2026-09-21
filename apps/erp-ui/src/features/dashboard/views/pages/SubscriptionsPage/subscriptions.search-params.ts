import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { SubscriptionStatusEnum } from '@vxrerp/core/contracts';
import { values } from 'lodash-es';
import { parseAsStringEnum } from 'nuqs';

export const subscriptionSearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(SubscriptionStatusEnum)),
};
