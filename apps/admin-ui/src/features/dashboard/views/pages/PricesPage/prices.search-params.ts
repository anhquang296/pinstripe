import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { parseAsBoolean } from 'nuqs';

export const priceSearchParams = {
  ...cursorSearchParams,
  active: parseAsBoolean,
};
