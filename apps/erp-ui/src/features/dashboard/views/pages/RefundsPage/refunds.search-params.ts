import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { RefundStatusEnum } from '@vxrerp/core/contracts';
import { values } from 'lodash-es';
import { parseAsString, parseAsStringEnum } from 'nuqs';

export const refundSearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(RefundStatusEnum)),
  invoiceId: parseAsString,
};
