import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { parseAsString } from 'nuqs';

export const customerSearchParams = {
  ...cursorSearchParams,
  email: parseAsString,
};
