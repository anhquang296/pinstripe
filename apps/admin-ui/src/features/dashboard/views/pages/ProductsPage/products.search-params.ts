import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { parseAsBoolean } from 'nuqs';

export const productSearchParams = {
  ...cursorSearchParams,
  active: parseAsBoolean,
};
