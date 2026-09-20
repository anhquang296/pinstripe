import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { parseAsBoolean } from 'nuqs';

export const paymentLinkSearchParams = {
  ...cursorSearchParams,
  isActive: parseAsBoolean,
};
