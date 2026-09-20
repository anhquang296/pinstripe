import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { createSerializer, parseAsString } from 'nuqs';

export const invoiceSearchParams = {
  ...cursorSearchParams,
  customerId: parseAsString,
};

export const serializeInvoiceSearch = createSerializer(invoiceSearchParams);
