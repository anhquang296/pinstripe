import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { parseAsBoolean } from 'nuqs';

export const taxRateSearchParams = {
  ...cursorSearchParams,
  active: parseAsBoolean,
};
