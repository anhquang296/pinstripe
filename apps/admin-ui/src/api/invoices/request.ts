import { Endpoint, Method, Params, Request } from '@api/client';

import type { GetUpcomingInvoiceQuery, RatedInvoiceResponse } from './type';

const UPCOMING_INVOICE_PATH = '/v1/invoices/upcoming';

export function getUpcomingInvoice(query: GetUpcomingInvoiceQuery): Promise<RatedInvoiceResponse> {
  return Request<RatedInvoiceResponse>(
    Endpoint(UPCOMING_INVOICE_PATH),
    Method('GET'),
    Params(query),
  );
}
