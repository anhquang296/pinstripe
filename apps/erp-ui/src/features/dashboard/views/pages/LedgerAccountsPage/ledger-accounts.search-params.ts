import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { LedgerAccountCodeEnum } from '@vxrerp/core/contracts';
import { values } from 'lodash-es';
import { parseAsString, parseAsStringEnum } from 'nuqs';

export const ledgerAccountSearchParams = {
  ...cursorSearchParams,
  code: parseAsStringEnum(values(LedgerAccountCodeEnum)),
  customerId: parseAsString,
};
