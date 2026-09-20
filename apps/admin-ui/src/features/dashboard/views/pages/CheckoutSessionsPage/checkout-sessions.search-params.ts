import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { CheckoutSessionStatusEnum } from '@pinstripe/core/contracts';
import { values } from 'lodash-es';
import { parseAsStringEnum } from 'nuqs';

export const checkoutSessionSearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(CheckoutSessionStatusEnum)),
};
