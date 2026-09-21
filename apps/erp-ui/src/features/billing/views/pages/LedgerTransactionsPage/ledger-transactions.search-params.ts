import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { parseAsString } from 'nuqs';

export const ledgerTransactionSearchParams = {
  ...cursorSearchParams,
  customerId: parseAsString,
};
